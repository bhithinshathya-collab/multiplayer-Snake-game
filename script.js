const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Track room states
const rooms = {};

// Generate 5-character room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

io.on('connection', (socket) => {

  // 1. Create Room
  socket.on('createRoom', () => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      players: {},
      food: { x: 15, y: 15 },
      maxPlayers: 3
    };

    socket.join(roomCode);
    socket.roomCode = roomCode;

    // First player setup
    rooms[roomCode].players[socket.id] = {
      id: socket.id,
      playerNum: 1,
      x: 5,
      y: 5,
      dir: 'RIGHT',
      body: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }]
    };

    socket.emit('roomCreated', { roomCode, playerNum: 1 });
  });

  // 2. Join Room
  socket.on('joinRoom', (roomCode) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];

    if (!room) {
      socket.emit('errorMsg', 'Room not found.');
      return;
    }

    const playerCount = Object.keys(room.players).length;
    if (playerCount >= room.maxPlayers) {
      socket.emit('errorMsg', 'Room is full (Max 3 players).');
      return;
    }

    socket.join(code);
    socket.roomCode = code;
    const playerNum = playerCount + 1;

    // Spawn points per player
    const spawnX = playerNum === 2 ? 25 : 15;
    const spawnY = playerNum === 2 ? 25 : 5;

    room.players[socket.id] = {
      id: socket.id,
      playerNum: playerNum,
      x: spawnX,
      y: spawnY,
      dir: 'DOWN',
      body: [{ x: spawnX, y: spawnY }]
    };

    socket.emit('roomJoined', { roomCode: code, playerNum });
    io.to(code).emit('updateGameState', room);
  });

  // 3. Receive Movement
  socket.on('playerMove', (dir) => {
    const room = rooms[socket.roomCode];
    if (room && room.players[socket.id]) {
      room.players[socket.id].dir = dir;
      io.to(socket.roomCode).emit('updateGameState', room);
    }
  });

  // Handle Disconnect
  socket.on('disconnect', () => {
    const room = rooms[socket.roomCode];
    if (room) {
      delete room.players[socket.id];
      if (Object.keys(room.players).length === 0) {
        delete rooms[socket.roomCode];
      } else {
        io.to(socket.roomCode).emit('updateGameState', room);
      }
    }
  });
});

server.listen(3000, () => {
  console.log('Snake Server running on port 3000');
});
