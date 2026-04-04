/**
 * Sistema de notificaciones en tiempo real con Socket.io
 */

const { Server } = require('socket.io');

// Instancia del servidor HTTP
let io = null;

// Inicializar Socket.io
function initSocketIO(server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id);

    // Unirse a salas
    socket.on('subscribe', (room) => {
      socket.join(room);
      console.log(`📱 Cliente ${socket.id} unirse a: ${room}`);
    });

    socket.on('unsubscribe', (room) => {
      socket.leave(room);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Cliente desconectado:', socket.id);
    });
  });

  return io;
}

// Enviar notificación a todos los clientes
function emitNotification(type, message, data = {}) {
  if (io) {
    io.emit('notification', {
      id: Date.now(),
      type,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }
}

// Enviar a sala específica
function emitToRoom(room, type, message, data = {}) {
  if (io) {
    io.to(room).emit('notification', {
      id: Date.now(),
      type,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }
}

// Tipos de notificaciones
const NotificationTypes = {
  STOCK_LOW: 'stock_low',
  NEW_RESERVATION: 'new_reservation',
  RESERVATION_EXPIRING: 'reservation_expiring',
  RESERVATION_COMPLETED: 'reservation_completed',
  PRODUCT_EXPIRING: 'product_expiring'
};

module.exports = {
  initSocketIO,
  emitNotification,
  emitToRoom,
  NotificationTypes
};
