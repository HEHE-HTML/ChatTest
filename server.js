const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the current directory
app.use(express.static('./'));

// Store rooms data
const rooms = {
  'general': { isPrivate: false, users: {}, bannedUsers: [] }
};

// Store active polls
const polls = {};

// Ban poll timeout in milliseconds (30 seconds)
const BAN_POLL_TIMEOUT = 30000;

io.on('connection', (socket) => {
  let currentRoom = null;
  let username = null;

  // Handle new user joining
  socket.on('join', (data) => {
    username = data.username;
    const roomName = data.room;
    const roomCode = data.roomCode;
    
    // Check if user is banned from this room
    if (rooms[roomName] && rooms[roomName].bannedUsers && 
        rooms[roomName].bannedUsers.includes(username)) {
      socket.emit('error', { message: 'You are banned from this room' });
      return;
    }
    
    // Handle room joining logic
    if (!rooms[roomName]) {
      // Create new room if it doesn't exist
      rooms[roomName] = {
        isPrivate: data.isPrivate,
        users: {},
        code: data.isPrivate ? roomCode : null,
        bannedUsers: []
      };
    }

    // Check if room is private and requires code
    if (rooms[roomName].isPrivate && rooms[roomName].code !== roomCode) {
      socket.emit('error', { message: 'Invalid room code' });
      return;
    }

    // Leave current room if already in one
    if (currentRoom) {
      socket.leave(currentRoom);
      delete rooms[currentRoom].users[socket.id];
      
      // Clean up empty rooms
      if (currentRoom !== 'general' && Object.keys(rooms[currentRoom].users).length === 0) {
        delete rooms[currentRoom];
      }
      
      io.to(currentRoom).emit('userLeft', { 
        username,
        users: Object.values(rooms[currentRoom].users)
      });
    }

    // Join new room
    currentRoom = roomName;
    socket.join(roomName);
    rooms[roomName].users[socket.id] = username;
    
    // Get list of users in the room
    const userList = Object.values(rooms[roomName].users);
    
    // Send welcome message and notify others
    socket.emit('roomJoined', { room: roomName, users: userList });
    socket.to(roomName).emit('userJoined', { 
      username, 
      users: userList 
    });
  });

  socket.on('leaveRoom', (data) => {
    if (currentRoom && rooms[currentRoom]) {
      // Remove user from room
      delete rooms[currentRoom].users[socket.id];
      
      // Notify others in the room
      socket.to(currentRoom).emit('userLeft', { 
        username: data.username,
        users: Object.values(rooms[currentRoom].users)
      });
      
      // Clean up empty rooms
      if (currentRoom !== 'general' && Object.keys(rooms[currentRoom].users).length === 0) {
        delete rooms[currentRoom];
      }
      
      // Leave the socket.io room
      socket.leave(currentRoom);
      currentRoom = null;
    }
  });

  // Handle chat messages
  socket.on('message', (data) => {
    if (!currentRoom || !username) return;
    
    io.to(currentRoom).emit('message', {
      username,
      text: data.text,
      time: new Date().toLocaleTimeString()
    });
  });

  // Handle get rooms list
  socket.on('getRooms', () => {
    const roomList = Object.keys(rooms).map(room => ({
      name: room,
      isPrivate: rooms[room].isPrivate,
      userCount: Object.keys(rooms[room].users).length
    }));
    socket.emit('roomList', { rooms: roomList });
  });
  
  // Handle ban poll
  socket.on('startBanPoll', (data) => {
    if (!currentRoom || !username) return;
    
    const target = data.target;
    // Check if target exists in room
    const userExists = Object.values(rooms[currentRoom].users).includes(target);
    if (!userExists) {
      socket.emit('error', { message: 'User not found' });
      return;
    }
    
    // Check if there's already an active poll for this user
    const existingPolls = Object.values(polls).filter(poll => 
      poll.room === currentRoom && poll.target === target && poll.active
    );
    
    if (existingPolls.length > 0) {
      socket.emit('error', { message: 'There is already an active poll for this user' });
      return;
    }
    
    // Create new poll
    const pollId = Date.now().toString();
    polls[pollId] = {
      id: pollId,
      room: currentRoom,
      target: target,
      initiator: username,
      active: true,
      votes: {},
      yesCount: 0,
      noCount: 0,
      createdAt: Date.now(),
      timeout: setTimeout(() => {
        // Auto-end poll after timeout
        if (polls[pollId] && polls[pollId].active) {
          endPoll(pollId, false, 'Poll timed out');
        }
      }, BAN_POLL_TIMEOUT)
    };
    
    // Get total users in room for majority calculation
    const totalUsers = Object.keys(rooms[currentRoom].users).length;
    
    // Notify room about new poll
    io.to(currentRoom).emit('banPollStarted', {
      pollId,
      target,
      initiator: username,
      totalUsers,
      duration: BAN_POLL_TIMEOUT
    });
  });
  
  // Handle voting
  socket.on('vote', (data) => {
    if (!currentRoom || !username || !polls[data.pollId]) return;
    
    const poll = polls[data.pollId];
    
    // Check if poll is active and in current room
    if (!poll.active || poll.room !== currentRoom) return;
    
    // Check if user already voted
    if (poll.votes[username]) return;
    
    // Record vote
    poll.votes[username] = data.vote;
    if (data.vote === 'yes') {
      poll.yesCount++;
    } else {
      poll.noCount++;
    }
    
    // Calculate total votes and required for majority
    const totalVotes = poll.yesCount + poll.noCount;
    const totalUsers = Object.keys(rooms[currentRoom].users).length;
    const requiredVotes = Math.ceil(totalUsers / 2);
    
    // Update everyone about poll progress
    io.to(currentRoom).emit('pollUpdate', {
      pollId: poll.id,
      yesVotes: poll.yesCount,
      noVotes: poll.noCount,
      totalVotes,
      required: requiredVotes
    });
    
    // Check if poll should end
    if (poll.yesCount >= requiredVotes) {
      endPoll(poll.id, true, 'Majority reached');
    } else if (poll.noCount > (totalUsers - requiredVotes)) {
      // Not enough possible yes votes remaining to reach majority
      endPoll(poll.id, false, 'Not enough yes votes possible');
    } else if (totalVotes >= totalUsers) {
      // Everyone voted but no majority reached
      endPoll(poll.id, false, 'No majority reached');
    }
  });
  
  // Helper function to end a poll
  function endPoll(pollId, result, reason = '') {
    const poll = polls[pollId];
    if (!poll || !poll.active) return;
    
    // Mark poll as inactive
    poll.active = false;
    
    // Clear timeout if poll ends early
    if (poll.timeout) {
      clearTimeout(poll.timeout);
    }
    
    // Notify room about poll result
    io.to(poll.room).emit('pollEnded', {
      pollId,
      target: poll.target,
      result,
      reason
    });
    
    // If poll passed, ban the user
    if (result) {
      // Add user to banned list for this room
      if (!rooms[poll.room].bannedUsers) {
        rooms[poll.room].bannedUsers = [];
      }
      rooms[poll.room].bannedUsers.push(poll.target);
      
      // Find socket id of target user
      const targetSocketId = Object.keys(rooms[poll.room].users).find(
        id => rooms[poll.room].users[id] === poll.target
      );
      
      if (targetSocketId) {
        // Remove user from room
        delete rooms[poll.room].users[targetSocketId];
        
        // Notify room about ban
        io.to(poll.room).emit('userBanned', { username: poll.target });
        
        // Notify target user
        io.to(targetSocketId).emit('userBanned', { username: poll.target });
      }
    }
    
    // Clean up poll after some time
    setTimeout(() => {
      delete polls[pollId];
    }, 5000);
  }

  // Handle disconnection
  socket.on('disconnect', () => {
    if (currentRoom && rooms[currentRoom]) {
      delete rooms[currentRoom].users[socket.id];
      
      // Clean up empty rooms
      if (currentRoom !== 'general' && Object.keys(rooms[currentRoom].users).length === 0) {
        delete rooms[currentRoom];
      } else {
        io.to(currentRoom).emit('userLeft', { 
          username,
          users: Object.values(rooms[currentRoom].users)
        });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));