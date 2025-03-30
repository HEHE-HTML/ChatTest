document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const loginScreen = document.getElementById('login-screen');
  const chatScreen = document.getElementById('chat-screen');
  const roomSelector = document.getElementById('room-selector');
  const createRoomScreen = document.getElementById('create-room');
  const joinPrivateScreen = document.getElementById('join-private');
  const usernameInput = document.getElementById('username-input');
  const roomNameInput = document.getElementById('room-name-input');
  const roomCodeInput = document.getElementById('room-code-input');
  const privateRoomCheck = document.getElementById('private-room-check');
  const privateRoomInput = document.getElementById('private-room-input');
  const privateCodeInput = document.getElementById('private-code-input');
  const messageInput = document.getElementById('message-input');
  const messagesContainer = document.getElementById('messages');
  const usersListContainer = document.getElementById('users-list');
  const roomNameDisplay = document.getElementById('room-name');
  const roomListContainer = document.getElementById('room-list');
  const pollContainer = document.getElementById('poll-container');

  // Buttons
  const joinPublicBtn = document.getElementById('join-public-btn');
  const createPrivateBtn = document.getElementById('create-private-btn');
  const joinPrivateBtn = document.getElementById('join-private-btn');
  const backBtn = document.getElementById('back-btn');
  const createRoomBtn = document.getElementById('create-room-btn');
  const backFromCreateBtn = document.getElementById('back-from-create-btn');
  const joinPrivateRoomBtn = document.getElementById('join-private-room-btn');
  const backFromPrivateBtn = document.getElementById('back-from-private-btn');
  const sendBtn = document.getElementById('send-btn');
  const leaveBtn = document.getElementById('leave-btn');

  // Connect to Socket.io server
  const socket = io();

  // Current state
  let currentUsername = '';
  let currentRoom = '';
  let activePolls = {};
  
  // Handle errors
  socket.on('error', (data) => {
    alert(data.message);
  });

  // Join public room button
  joinPublicBtn.addEventListener('click', () => {
    if (!validateUsername()) return;
    
    loginScreen.querySelector('.login-form').classList.add('hidden');
    roomSelector.classList.remove('hidden');
    
    // Get available rooms
    socket.emit('getRooms');
  });

  // Create private room button
  createPrivateBtn.addEventListener('click', () => {
    if (!validateUsername()) return;
    
    loginScreen.querySelector('.login-form').classList.add('hidden');
    createRoomScreen.classList.remove('hidden');
  });

  // Join private room button
  joinPrivateBtn.addEventListener('click', () => {
    if (!validateUsername()) return;
    
    loginScreen.querySelector('.login-form').classList.add('hidden');
    joinPrivateScreen.classList.remove('hidden');
  });

  // Back button from room selector
  backBtn.addEventListener('click', () => {
    roomSelector.classList.add('hidden');
    loginScreen.querySelector('.login-form').classList.remove('hidden');
  });

  // Back button from create room
  backFromCreateBtn.addEventListener('click', () => {
    createRoomScreen.classList.add('hidden');
    loginScreen.querySelector('.login-form').classList.remove('hidden');
  });

  // Back button from join private
  backFromPrivateBtn.addEventListener('click', () => {
    joinPrivateScreen.classList.add('hidden');
    loginScreen.querySelector('.login-form').classList.remove('hidden');
  });

  // Create and join room
  createRoomBtn.addEventListener('click', () => {
    const roomName = roomNameInput.value.trim();
    const roomCode = roomCodeInput.value.trim();
    const isPrivate = privateRoomCheck.checked;
    
    if (!roomName) {
      alert('Please enter a room name');
      return;
    }
    
    if (isPrivate && !roomCode) {
      alert('Private rooms require a code');
      return;
    }
    
    joinRoom(roomName, isPrivate, roomCode);
  });

  // Join private room
  joinPrivateRoomBtn.addEventListener('click', () => {
    const roomName = privateRoomInput.value.trim();
    const roomCode = privateCodeInput.value.trim();
    
    if (!roomName || !roomCode) {
      alert('Please enter both room name and code');
      return;
    }
    
    joinRoom(roomName, true, roomCode);
  });

  // Send message
  sendBtn.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  // Leave room
  leaveBtn.addEventListener('click', () => {
    // Notify server that user is leaving the room
    socket.emit('leaveRoom', {
      username: currentUsername,
      room: currentRoom
    });
    
    // Reset current room
    currentRoom = '';
    
    // Hide chat screen
    chatScreen.classList.add('hidden');
    
    // Show login screen with the login form visible
    loginScreen.classList.remove('hidden');
    loginScreen.querySelector('.login-form').classList.remove('hidden');
    
    // Make sure other screens are hidden
    roomSelector.classList.add('hidden');
    createRoomScreen.classList.add('hidden');
    joinPrivateScreen.classList.add('hidden');
    
    // Clear message input and messages container
    messageInput.value = '';
    messagesContainer.innerHTML = '';
    
    // Clear user list
    usersListContainer.innerHTML = '';
    
    // Clear poll container
    pollContainer.innerHTML = '';
    activePolls = {};
  });

  // Socket event handlers
  socket.on('roomList', (data) => {
    roomListContainer.innerHTML = '';
    
    if (data.rooms.length === 0) {
      roomListContainer.innerHTML = '<div class="room-item">No rooms available</div>';
      return;
    }
    
    data.rooms.forEach(room => {
      const roomItem = document.createElement('div');
      roomItem.className = 'room-item';
      roomItem.innerHTML = `
        <span>${room.name} (${room.userCount} users)</span>
        ${room.isPrivate ? '<span class="private-badge">Private</span>' : ''}
      `;
      
      if (!room.isPrivate) {
        roomItem.addEventListener('click', () => {
          joinRoom(room.name, false);
        });
      }
      
      roomListContainer.appendChild(roomItem);
    });
  });

  socket.on('roomJoined', (data) => {
    currentRoom = data.room;
    roomNameDisplay.textContent = `Room: ${currentRoom}`;
    
    // Switch to chat screen
    loginScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    
    // Clear message area
    messagesContainer.innerHTML = '';
    
    // Add system message
    addSystemMessage(`Welcome to ${currentRoom}!`);
    
    // Update users list
    updateUsersList(data.users);
  });

  socket.on('message', (data) => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${data.username === currentUsername ? 'self' : 'other'}`;
    
    messageDiv.innerHTML = `
      <div class="message-header">
        <span class="message-sender">${data.username}</span>
        <span class="message-time">${data.time}</span>
      </div>
      <div class="message-text">${escapeHTML(data.text)}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
  });

  socket.on('userJoined', (data) => {
    addSystemMessage(`${data.username} joined the room`);
    updateUsersList(data.users);
  });

  socket.on('userLeft', (data) => {
    addSystemMessage(`${data.username} left the room`);
    updateUsersList(data.users);
    
    // Remove any active polls for users who left
    if (data.username && activePolls[data.username]) {
      pollContainer.querySelector(`.poll[data-user="${data.username}"]`)?.remove();
      delete activePolls[data.username];
    }
  });
  
  // Handle ban poll events
  socket.on('banPollStarted', (data) => {
    const { pollId, target, initiator, totalUsers, duration } = data;
    
    // Create poll UI
    const pollDiv = document.createElement('div');
    pollDiv.className = 'poll ban-poll';
    pollDiv.setAttribute('data-poll-id', pollId);
    pollDiv.setAttribute('data-user', target);
    
    // Calculate required votes (majority rule)
    const requiredVotes = Math.ceil(totalUsers / 2);
    
    pollDiv.innerHTML = `
      <div class="poll-header">
        <span class="poll-title">Ban ${target}?</span>
        <span class="poll-timer">${Math.ceil(duration/1000)}s</span>
      </div>
      <div class="poll-info">Started by ${initiator}</div>
      <div class="poll-progress">
        <div class="poll-bar" style="width: 0%"></div>
        <span class="poll-count">0/${requiredVotes} votes</span>
      </div>
      <div class="poll-actions">
        <button class="vote-yes">Ban</button>
        <button class="vote-no">Keep</button>
      </div>
    `;
    
    // Add poll to container
    pollContainer.appendChild(pollDiv);
    
    // Store poll in active polls
    activePolls[target] = {
      id: pollId,
      timerInterval: setInterval(() => {
        const timerElement = pollDiv.querySelector('.poll-timer');
        let seconds = parseInt(timerElement.textContent);
        if (seconds > 1) {
          timerElement.textContent = `${seconds - 1}s`;
        } else {
          timerElement.textContent = 'Ending...';
        }
      }, 1000)
    };
    
    // Event listeners for voting
    pollDiv.querySelector('.vote-yes').addEventListener('click', () => {
      socket.emit('vote', { pollId, vote: 'yes' });
      disableVoteButtons(pollDiv);
    });
    
    pollDiv.querySelector('.vote-no').addEventListener('click', () => {
      socket.emit('vote', { pollId, vote: 'no' });
      disableVoteButtons(pollDiv);
    });
  });
  
  socket.on('pollUpdate', (data) => {
    const { pollId, yesVotes, noVotes, totalVotes, required } = data;
    
    // Find the poll element
    const pollDiv = pollContainer.querySelector(`.poll[data-poll-id="${pollId}"]`);
    if (!pollDiv) return;
    
    // Update progress bar
    const percentage = (yesVotes / required) * 100;
    pollDiv.querySelector('.poll-bar').style.width = `${percentage > 100 ? 100 : percentage}%`;
    
    // Update vote count
    pollDiv.querySelector('.poll-count').textContent = `${yesVotes}/${required} votes`;
    
    // Change bar color based on percentage
    const progressBar = pollDiv.querySelector('.poll-bar');
    if (percentage >= 75) {
      progressBar.className = 'poll-bar critical';
    } else if (percentage >= 40) {
      progressBar.className = 'poll-bar warning';
    } else {
      progressBar.className = 'poll-bar';
    }
  });
  
  socket.on('pollEnded', (data) => {
    const { pollId, target, result } = data;
    
    // Find the poll element
    const pollDiv = pollContainer.querySelector(`.poll[data-poll-id="${pollId}"]`);
    if (!pollDiv) return;
    
    // Clear timer interval
    if (activePolls[target] && activePolls[target].timerInterval) {
      clearInterval(activePolls[target].timerInterval);
    }
    
    // Remove poll from active polls
    delete activePolls[target];
    
    // Update poll appearance
    pollDiv.classList.add(result ? 'poll-passed' : 'poll-failed');
    pollDiv.querySelector('.poll-timer').textContent = result ? 'BANNED' : 'FAILED';
    
    // Add result message
    addSystemMessage(`Ban poll for ${target} ${result ? 'passed' : 'failed'}`);
    
    // Disable voting if not already done
    disableVoteButtons(pollDiv);
    
    // Remove poll after a short delay
    setTimeout(() => {
      pollDiv.remove();
    }, 3000);
  });
  
  socket.on('userBanned', (data) => {
    if (data.username === currentUsername) {
      alert('You have been banned from the room');
      leaveBtn.click();
    } else {
      addSystemMessage(`${data.username} has been banned from the room`);
    }
  });

  // Helper functions
  function validateUsername() {
    const username = usernameInput.value.trim();
    if (!username) {
      alert('Please enter a username');
      return false;
    }
    currentUsername = username;
    return true;
  }

  function joinRoom(room, isPrivate, code = '') {
    socket.emit('join', {
      username: currentUsername,
      room: room,
      isPrivate: isPrivate,
      roomCode: code
    });
  }

  function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Check for ban command
    if (message.startsWith('/ban ')) {
      const target = message.substring(5).trim();
      if (target === currentUsername) {
        addSystemMessage('You cannot ban yourself');
      } else {
        socket.emit('startBanPoll', { target });
      }
    } else {
      // Regular message
      socket.emit('message', { text: message });
    }
    
    messageInput.value = '';
  }

  function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = text;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
  }

  function updateUsersList(users) {
    usersListContainer.innerHTML = '';
    users.forEach(user => {
      const userItem = document.createElement('li');
      userItem.className = 'user-item';
      userItem.innerHTML = `
        <span class="user-name">${user}</span>
        <button class="ban-btn" title="Start ban poll">⊗</button>
      `;
      
      if (user === currentUsername) {
        userItem.classList.add('current-user');
        userItem.querySelector('.ban-btn').remove();
      } else {
        userItem.querySelector('.ban-btn').addEventListener('click', () => {
          socket.emit('startBanPoll', { target: user });
        });
      }
      
      usersListContainer.appendChild(userItem);
    });
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function escapeHTML(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  
  function disableVoteButtons(pollDiv) {
    pollDiv.querySelector('.vote-yes').disabled = true;
    pollDiv.querySelector('.vote-no').disabled = true;
    pollDiv.querySelector('.poll-actions').classList.add('voted');
  }
});