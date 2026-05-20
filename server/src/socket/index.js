const { Server } = require('socket.io');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    // Client joins their tenant room on connect
    socket.on('join:tenant', (tenantId) => {
      socket.join(`tenant:${tenantId}`);
      console.log(`Socket ${socket.id} joined tenant room: ${tenantId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket ${socket.id} disconnected`);
    });
  });

  console.log('Socket.io initialized');
  return io;
};

// Emit to a specific tenant room
const emitToTenant = (tenantId, event, data) => {
  if (io) {
    io.to(`tenant:${tenantId}`).emit(event, data);
  }
};

module.exports = initSocket;
module.exports.emitToTenant = emitToTenant;
