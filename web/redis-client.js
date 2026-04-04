/**
 * Cliente Redis - Una conexión por solicitud
 */

const Redis = require('ioredis');

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

// Claves de Redis
const REDIS_KEYS = {
  product: (code) => `product:${code}`,
  categories: 'categories',
  expiringProducts: 'expiring_products',
  productsByCategory: (category) => `products_by_category:${category}`,
  allProducts: 'all_products',
  
  // Reservas
  reservation: (id) => `reservation:${id}`,
  reservations: 'all_reservations',
  reservationsByCustomer: (customerId) => `reservations:customer:${customerId}`,
  reservationsByProduct: (productCode) => `reservations:product:${productCode}`,
  
  // Historial de movimientos
  stockMovements: 'stock_movements',
  stockMovementsByProduct: (productCode) => `stock_movements:product:${productCode}`,
};

// TTL por defecto para reservas (30 minutos en segundos)
const RESERVATION_TTL = 30 * 60;

// Función para obtener cliente - crea nuevo cada vez
function getRedisClient() {
  const client = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 200, 2000);
    },
    enableOfflineQueue: true,
  });
  
  client.on('error', (err) => {
    console.error('Redis error:', err.message);
  });
  
  return client;
}

module.exports = {
  getRedisClient,
  REDIS_KEYS,
  REDIS_HOST,
  REDIS_PORT,
  RESERVATION_TTL,
};
