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
      
      // Update users list by requesting room info again
      socket.emit('getRooms');
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
      
      socket.emit('message', { text: message });
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
        userItem.textContent = user;
        if (user === currentUsername) {
          userItem.style.fontWeight = 'bold';
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
  });