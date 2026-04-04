/**
 * Farmality Web Server
 * Express.js backend para pharmacy-stock
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');

// Importar Socket.io
const { initSocketIO, emitNotification, emitToRoom, NotificationTypes } = require('./notifications');

// Importar rutas
const productsRouter = require('./routes/products');
const alertsRouter = require('./routes/alerts');
const statsRouter = require('./routes/stats');
const reservationsRouter = require('./routes/reservations');
const movementsRouter = require('./routes/movements');
const reportsRouter = require('./routes/reports');
const salesRouter = require('./routes/sales');

const app = express();
const PORT = process.env.PORT || 3005;
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';

// Pasar configuración a procesos hijos
process.env.REDIS_HOST = REDIS_HOST;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Rutas API
app.use('/api/products', productsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/movements', movementsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/sales', salesRouter);

// Importar módulo de categorías
const categoriesRouter = require('./routes/categories');
app.use('/api/categories', categoriesRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback - cualquier ruta no-API va a index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Endpoint not found' });
  }
});

// Crear servidor HTTP y pasar a Socket.io
const server = http.createServer(app);

// Inicializar Socket.io
initSocketIO(server);

// Hacer disponibles las funciones de notificación en las rutas
app.set('emitNotification', emitNotification);
app.set('emitToRoom', emitToRoom);
app.set('NotificationTypes', NotificationTypes);

// Iniciar servidor
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🏥 Farmality Web Server`);
  console.log(`📡 Puerto: http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
  console.log(`🔌 Socket.io activo`);
});

// Manejo de errores
process.on('uncaughtException', (err) => {
  console.error('Error no manejado:', err);
});

module.exports = app;
