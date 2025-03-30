document.addEventListener('DOMContentLoaded', () => {
  // Create ban notifications container
  const banNotificationsContainer = document.createElement('div');
  banNotificationsContainer.className = 'ban-notifications';
  document.body.appendChild(banNotificationsContainer);
  
  // DOM elements (existing code)
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

  // Buttons (existing code)
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
  let activeNotifications = {};
  
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
    activeNotifications = {};
    
    // Clear all active ban notifications
    removeAllBanNotifications();
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
    
    // Clear all active ban notifications
    removeAllBanNotifications();
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
    
    // Remove any active ban notifications for users who left
    if (data.username && activeNotifications[data.username]) {
      removeBanNotification(data.username);
    }
  });
  
  // Handle ban poll events
  socket.on('banPollStarted', (data) => {
    const { pollId, target, initiator, totalUsers, duration } = data;
    
    // Calculate required votes (majority rule)
    const requiredVotes = Math.ceil(totalUsers / 2);
    
    // Create notification for ban poll
    createBanNotification({
      id: pollId,
      target,
      initiator,
      requiredVotes,
      duration
    });
    
    // Store in active notifications
    activeNotifications[target] = {
      id: pollId,
      element: document.querySelector(`.ban-notification[data-poll-id="${pollId}"]`)
    };
  });
  
  socket.on('pollUpdate', (data) => {
    const { pollId, yesVotes, noVotes, totalVotes, required } = data;
    
    // Find the notification element
    const notificationDiv = document.querySelector(`.ban-notification[data-poll-id="${pollId}"]`);
    if (!notificationDiv) return;
    
    // Update progress bar
    const percentage = (yesVotes / required) * 100;
    notificationDiv.querySelector('.ban-notification-bar').style.width = `${percentage > 100 ? 100 : percentage}%`;
    
    // Update vote count
    notificationDiv.querySelector('.ban-notification-votes').textContent = `${yesVotes}/${required} votes`;
    
    // Change bar color based on percentage
    const progressBar = notificationDiv.querySelector('.ban-notification-bar');
    if (percentage >= 75) {
      progressBar.className = 'ban-notification-bar critical';
    } else if (percentage >= 40) {
      progressBar.className = 'ban-notification-bar warning';
    } else {
      progressBar.className = 'ban-notification-bar';
    }
  });
  
  socket.on('pollEnded', (data) => {
    const { pollId, target, result } = data;
    
    // Find the notification element
    const notificationDiv = document.querySelector(`.ban-notification[data-poll-id="${pollId}"]`);
    if (!notificationDiv) return;
    
    // Update notification appearance
    notificationDiv.classList.add(result ? 'success' : 'fail');
    
    // Update notification content
    const titleElement = notificationDiv.querySelector('.ban-notification-title');
    titleElement.textContent = result ? 'User Banned' : 'Ban Failed';
    
    // Update notification description
    const contentElement = notificationDiv.querySelector('.ban-notification-content');
    contentElement.textContent = result 
      ? `${target} has been banned from the room.` 
      : `Ban poll for ${target} failed.`;
    
    // Remove timer and actions
    const actionsElement = notificationDiv.querySelector('.ban-notification-actions');
    if (actionsElement) actionsElement.remove();
    
    // Remove progress bar
    const progressElement = notificationDiv.querySelector('.ban-notification-progress');
    if (progressElement) progressElement.remove();
    
    // Schedule notification removal
    setTimeout(() => {
      if (notificationDiv) {
        notificationDiv.classList.add('closing');
        setTimeout(() => {
          notificationDiv.remove();
          delete activeNotifications[target];
        }, 300);
      }
    }, 3000);
    
    // Add result message to chat
    addSystemMessage(`Ban poll for ${target} ${result ? 'passed' : 'failed'}`);
  });
  
  socket.on('userBanned', (data) => {
    if (data.username === currentUsername) {
      alert('You have been banned from the room');
      leaveBtn.click();
    } else {
      addSystemMessage(`${data.username} has been banned from the room`);
      
      // Remove any active ban notifications for the banned user
      if (activeNotifications[data.username]) {
        removeBanNotification(data.username);
      }
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
        <button class="ban-btn" title="Start ban poll">X</button>
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
  
  function createBanNotification(data) {
    const { id, target, initiator, requiredVotes, duration } = data;
    
    // Create notification element
    const notificationDiv = document.createElement('div');
    notificationDiv.className = 'ban-notification';
    notificationDiv.setAttribute('data-poll-id', id);
    notificationDiv.setAttribute('data-user', target);
    
    // Build notification content without timer
    notificationDiv.innerHTML = `
      <div class="ban-notification-header">
        <span class="ban-notification-title">Ban Vote: ${target}</span>
      </div>
      <div class="ban-notification-content">
        Started by ${initiator}
      </div>
      <div class="ban-notification-progress">
        <div class="ban-notification-bar" style="width: 0%"></div>
      </div>
      <div class="ban-notification-votes">0/${requiredVotes} votes</div>
      <div class="ban-notification-actions">
        <button class="ban-notification-button ban-notification-yes">Ban</button>
        <button class="ban-notification-button ban-notification-no">Keep</button>
      </div>
    `;
    
    // Add to container
    banNotificationsContainer.appendChild(notificationDiv);
    
    // Event listeners for voting
    notificationDiv.querySelector('.ban-notification-yes').addEventListener('click', () => {
      socket.emit('vote', { pollId: id, vote: 'yes' });
      disableVoteButtons(notificationDiv);
    });
    
    notificationDiv.querySelector('.ban-notification-no').addEventListener('click', () => {
      socket.emit('vote', { pollId: id, vote: 'no' });
      disableVoteButtons(notificationDiv);
    });
    
    return notificationDiv;
  }
  
  function disableVoteButtons(element) {
    const yesButton = element.querySelector('.ban-notification-yes');
    const noButton = element.querySelector('.ban-notification-no');
    
    if (yesButton) yesButton.disabled = true;
    if (noButton) noButton.disabled = true;
    
    element.querySelector('.ban-notification-actions').classList.add('voted');
  }
  
  function removeBanNotification(username) {
    if (activeNotifications[username]) {
      const element = document.querySelector(`.ban-notification[data-user="${username}"]`);
      if (element) {
        element.classList.add('closing');
        setTimeout(() => element.remove(), 300);
      }
      delete activeNotifications[username];
    }
  }
  
  function removeAllBanNotifications() {
    const notifications = document.querySelectorAll('.ban-notification');
    notifications.forEach(notification => {
      notification.classList.add('closing');
      setTimeout(() => notification.remove(), 300);
    });
    activeNotifications = {};
  }
});
