/**
 * Rutas API para gestión de reservas
 * Sistema de reservas con TTL
 */

const express = require('express');
const { getRedisClient, REDIS_KEYS, RESERVATION_TTL } = require('../redis-client');

const router = express.Router();

// Funciones auxiliares
function generateReservationId() {
  return 'res_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(amount);
}

// Función auxiliar para registrar movimientos
async function recordStockMovement(client, productCode, productName, type, quantityBefore, quantityAfter, user = 'system', notes = '') {
  const quantityChange = quantityAfter - quantityBefore;
  const movement = {
    id: 'mov_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    productCode,
    productName,
    type,
    quantityBefore,
    quantityAfter,
    quantityChange,
    user,
    notes,
    timestamp: new Date().toISOString(),
    metadata: {}
  };
  
  // Guardar en la lista principal
  await client.lpush(REDIS_KEYS.stockMovements, JSON.stringify(movement));
  // Guardar por producto
  await client.lpush(REDIS_KEYS.stockMovementsByProduct(productCode), JSON.stringify(movement));
  
  return movement;
}

// POST /api/reservations - Crear una nueva reserva
router.post('/', async (req, res) => {
  let client = null;
  try {
    const { customerName, customerId, items } = req.body;
    
    if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Nombre del cliente y items son requeridos' });
    }
    
    client = getRedisClient();
    
    // Verificar stock disponible para cada item y calcular total
    let total = 0;
    const validatedItems = [];
    
    for (const item of items) {
      const product = await client.hgetall(REDIS_KEYS.product(item.code));
      
      if (!product || Object.keys(product).length === 0) {
        return res.status(404).json({ error: `Producto no encontrado: ${item.code}` });
      }
      
      const currentStock = parseInt(product.stock);
      if (currentStock < item.quantity) {
        return res.status(400).json({ 
          error: `Stock insuficiente para ${product.name}. Stock actual: ${currentStock}, solicitado: ${item.quantity}` 
        });
      }
      
      // Calcular total
      const price = parseFloat(product.price);
      total += price * item.quantity;
      
      validatedItems.push({
        code: item.code,
        name: product.name,
        quantity: item.quantity,
        price: price,
        subtotal: price * item.quantity
      });
    }
    
    // Crear la reserva
    const reservationId = generateReservationId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RESERVATION_TTL * 1000);
    
    const reservation = {
      id: reservationId,
      customerName,
      customerId: customerId || '',
      items: JSON.stringify(validatedItems),
      total: total.toString(),
      status: 'active',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      completedAt: '',
      cancelledAt: '',
    };
    
    // Guardar reserva en Redis con TTL
    await client.hset(REDIS_KEYS.reservation(reservationId), reservation);
    await client.expire(REDIS_KEYS.reservation(reservationId), RESERVATION_TTL);
    
    // Agregar a índices
    await client.sadd(REDIS_KEYS.reservations, reservationId);
    if (customerId) {
      await client.sadd(REDIS_KEYS.reservationsByCustomer(customerId), reservationId);
    }
    
    // Bloquear stock (decrementar)
    for (const item of validatedItems) {
      const product = await client.hgetall(REDIS_KEYS.product(item.code));
      const stockAntes = parseInt(product.stock);
      const stockDespues = stockAntes - item.quantity;
      
      await client.hincrby(REDIS_KEYS.product(item.code), 'stock', -item.quantity);
      
      // Registrar movimiento
      await recordStockMovement(client, item.code, item.name, 'reservation', stockAntes, stockDespues, 'system', 'Reserva creada');
      
      // Notificación: verificar stock bajo después de bloquear
      const nuevoStock = stockDespues;
      if (nuevoStock <= parseInt(product.minStock)) {
        const emitNotification = req.app.get('emitNotification');
        if (emitNotification) {
          emitNotification('stock_low', `Stock bajo para ${product.name}: ${nuevoStock} unidades`, { productCode: item.code, stock: nuevoStock });
        }
      }
    }
    
    // Notificación: nueva reserva
    const emitNotification = req.app.get('emitNotification');
    if (emitNotification) {
      emitNotification('new_reservation', `Nueva reserva de ${customerName} - ${formatCurrency(total)}`, { reservationId, total, items: validatedItems.length });
    }
    
    // Responder
    reservation.items = validatedItems;
    reservation.total = total;
    reservation.timeRemaining = RESERVATION_TTL;
    
    res.status(201).json(reservation);
  } catch (err) {
    console.error('Error creando reserva:', err);
    res.status(500).json({ error: 'Error al crear reserva', details: err.message });
  }
});

// GET /api/reservations - Listar reservas
router.get('/', async (req, res) => {
  let client = null;
  try {
    const { status, customerId } = req.query;
    client = getRedisClient();
    
    let reservationIds;
    
    if (customerId) {
      reservationIds = await client.smembers(REDIS_KEYS.reservationsByCustomer(customerId));
    } else {
      reservationIds = await client.smembers(REDIS_KEYS.reservations);
    }
    
    const reservations = [];
    const now = new Date();
    
    for (const id of reservationIds) {
      const reservation = await client.hgetall(REDIS_KEYS.reservation(id));
      
      if (!reservation || Object.keys(reservation).length === 0) {
        continue; // Reserva expirada y eliminada
      }
      
      // Calcular tiempo restante PRIMERO (antes del filtro)
      const expiresAt = new Date(reservation.expiresAt);
      const timeRemaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      
      // Si la reserva está activa pero pasó el tiempo, marcarla como expirada
      if (reservation.status === 'active' && timeRemaining <= 0) {
        reservation.status = 'expired';
      }
      
      // Verificar si aplica el filtro de status
      if (status && reservation.status !== status) {
        continue;
      }
      
      reservation.id = id;
      reservation.items = JSON.parse(reservation.items || '[]');
      reservation.total = parseFloat(reservation.total);
      reservation.timeRemaining = timeRemaining;
      
      reservations.push(reservation);
    }
    
    // Ordenar por fecha de creación (más recientes primero)
    reservations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({ reservations, count: reservations.length });
  } catch (err) {
    console.error('Error listando reservas:', err);
    res.status(500).json({ error: 'Error al listar reservas', details: err.message });
  }
});

// GET /api/reservations/:id - Ver detalles de una reserva
router.get('/:id', async (req, res) => {
  let client = null;
  try {
    const { id } = req.params;
    client = getRedisClient();
    
    const reservation = await client.hgetall(REDIS_KEYS.reservation(id));
    
    if (!reservation || Object.keys(reservation).length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada o expirada' });
    }
    
    const now = new Date();
    const expiresAt = new Date(reservation.expiresAt);
    const timeRemaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
    
    reservation.id = id;
    reservation.items = JSON.parse(reservation.items || '[]');
    reservation.total = parseFloat(reservation.total);
    reservation.timeRemaining = timeRemaining;
    
    res.json(reservation);
  } catch (err) {
    console.error('Error obteniendo reserva:', err);
    res.status(500).json({ error: 'Error al obtener reserva', details: err.message });
  }
});

// GET /api/reservations/:id/time - Tiempo restante de la reserva
router.get('/:id/time', async (req, res) => {
  let client = null;
  try {
    const { id } = req.params;
    client = getRedisClient();
    
    const reservation = await client.hgetall(REDIS_KEYS.reservation(id));
    
    if (!reservation || Object.keys(reservation).length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada o expirada' });
    }
    
    const now = new Date();
    const expiresAt = new Date(reservation.expiresAt);
    const timeRemaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
    
    res.json({ 
      timeRemaining, 
      expiresAt: reservation.expiresAt,
      status: reservation.status 
    });
  } catch (err) {
    console.error('Error obteniendo tiempo:', err);
    res.status(500).json({ error: 'Error al obtener tiempo', details: err.message });
  }
});

// POST /api/reservations/:id/complete - Completar reserva
router.post('/:id/complete', async (req, res) => {
  let client = null;
  try {
    const { id } = req.params;
    client = getRedisClient();
    
    const reservation = await client.hgetall(REDIS_KEYS.reservation(id));
    
    if (!reservation || Object.keys(reservation).length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada o expirada' });
    }
    
    if (reservation.status !== 'active') {
      return res.status(400).json({ error: `La reserva ya fue ${reservation.status}` });
    }
    
    // Verificar tiempo restante
    const now = new Date();
    const expiresAt = new Date(reservation.expiresAt);
    if (now > expiresAt) {
      // Reserva expirada, restaurar stock y marcar como expirada
      const items = JSON.parse(reservation.items || '[]');
      for (const item of items) {
        const product = await client.hgetall(REDIS_KEYS.product(item.code));
        const stockAntes = parseInt(product.stock);
        const stockDespues = stockAntes + item.quantity;
        
        await client.hincrby(REDIS_KEYS.product(item.code), 'stock', item.quantity);
        
        // Registrar movimiento
        await recordStockMovement(client, item.code, item.name, 'reservation_release', stockAntes, stockDespues, 'system', 'Reserva expirada - stock liberado');
      }
      await client.hset(REDIS_KEYS.reservation(id), 'status', 'expired');
      return res.status(400).json({ error: 'La reserva ha expirado' });
    }
    
    // Marcar como completada
    const completedAt = new Date().toISOString();
    await client.hset(REDIS_KEYS.reservation(id), 'status', 'completed');
    await client.hset(REDIS_KEYS.reservation(id), 'completedAt', completedAt);
    
    // Registrar movimiento de completado (el stock ya estaba bloqueado)
    const items = JSON.parse(reservation.items || '[]');
    for (const item of items) {
      const product = await client.hgetall(REDIS_KEYS.product(item.code));
      const stockActual = parseInt(product.stock);
      
      // Registrar movimiento
      await recordStockMovement(client, item.code, item.name, 'reservation_complete', stockActual, stockActual, 'system', 'Reserva completada - stock confirmado');
    }
    
    // Quitar TTL (mantener la reserva guardada)
    await client.persist(REDIS_KEYS.reservation(id));
    
    // Notificación: reserva completada
    const emitNotification = req.app.get('emitNotification');
    if (emitNotification) {
      emitNotification('reservation_completed', `Reserva de ${reservation.customerName} completada - ${formatCurrency(reservation.total)}`, { reservationId: id, total: reservation.total });
    }
    
    // Obtener reserva actualizada
    const updatedReservation = await client.hgetall(REDIS_KEYS.reservation(id));
    updatedReservation.id = id;
    updatedReservation.items = JSON.parse(updatedReservation.items || '[]');
    updatedReservation.total = parseFloat(updatedReservation.total);
    
    res.json(updatedReservation);
  } catch (err) {
    console.error('Error completando reserva:', err);
    res.status(500).json({ error: 'Error al completar reserva', details: err.message });
  }
});

// POST /api/reservations/:id/cancel - Cancelar reserva
router.post('/:id/cancel', async (req, res) => {
  let client = null;
  try {
    const { id } = req.params;
    client = getRedisClient();
    
    const reservation = await client.hgetall(REDIS_KEYS.reservation(id));
    
    if (!reservation || Object.keys(reservation).length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada o expirada' });
    }
    
    if (reservation.status !== 'active') {
      return res.status(400).json({ error: `La reserva ya fue ${reservation.status}` });
    }
    
    // Restaurar stock
    const items = JSON.parse(reservation.items || '[]');
    for (const item of items) {
      const product = await client.hgetall(REDIS_KEYS.product(item.code));
      const stockAntes = parseInt(product.stock);
      const stockDespues = stockAntes + item.quantity;
      
      await client.hincrby(REDIS_KEYS.product(item.code), 'stock', item.quantity);
      
      // Registrar movimiento
      await recordStockMovement(client, item.code, item.name, 'reservation_release', stockAntes, stockDespues, 'system', 'Reserva cancelada - stock liberado');
    }
    
    // Marcar como cancelada
    const cancelledAt = new Date().toISOString();
    await client.hset(REDIS_KEYS.reservation(id), 'status', 'cancelled');
    await client.hset(REDIS_KEYS.reservation(id), 'cancelledAt', cancelledAt);
    
    // Quitar TTL
    await client.persist(REDIS_KEYS.reservation(id));
    
    res.json({ message: 'Reserva cancelada correctamente', id });
  } catch (err) {
    console.error('Error cancelando reserva:', err);
    res.status(500).json({ error: 'Error al cancelar reserva', details: err.message });
  }
});

module.exports = router;
