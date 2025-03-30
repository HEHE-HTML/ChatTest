const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

// Store rooms data
const rooms = {
  'general': { isPrivate: false, users: {} }
};

io.on('connection', (socket) => {
  let currentRoom = null;
  let username = null;

  // Handle new user joining
  socket.on('join', (data) => {
    username = data.username;
    const roomName = data.room;
    const roomCode = data.roomCode;
    
    // Handle room joining logic
    if (!rooms[roomName]) {
      // Create new room if it doesn't exist
      rooms[roomName] = {
        isPrivate: data.isPrivate,
        users: {},
        code: data.isPrivate ? roomCode : null
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
      
      io.to(currentRoom).emit('userLeft', { username });
    }

    // Join new room
    currentRoom = roomName;
    socket.join(roomName);
    rooms[roomName].users[socket.id] = username;
    
    // Get list of users in the room
    const userList = Object.values(rooms[roomName].users);
    
    // Send welcome message and notify others
    socket.emit('roomJoined', { room: roomName, users: userList });
    socket.to(roomName).emit('userJoined', { username, users: userList });
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

  // Handle disconnection
  socket.on('disconnect', () => {
    if (currentRoom && rooms[currentRoom]) {
      delete rooms[currentRoom].users[socket.id];
      
      // Clean up empty rooms
      if (currentRoom !== 'general' && Object.keys(rooms[currentRoom].users).length === 0) {
        delete rooms[currentRoom];
      } else {
        io.to(currentRoom).emit('userLeft', { username });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
