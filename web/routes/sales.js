/**
 * Sales Router - Farmality
 * Endpoints para el circuito de ventas
 */

const express = require('express');
const Redis = require('ioredis');

const router = express.Router();
const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: 6379
});

// Keys de Redis (mismo patrón que movements.js)
const SALES_KEY = 'sales';
const STOCK_MOVEMENTS = 'stock_movements';
const STOCK_MOVEMENTS_BY_PRODUCT = (code) => `stock_movements:product:${code}`;

// Helper: generar ID único para movimiento
function generateMovementId() {
  return 'mov_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Helper: generar ID único para venta
function generateSaleId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');
  return `sale_${date}_${time}`;
}

// Helper: generar número de ticket secuencial
async function getNextTicketNumber() {
  const key = 'ticket:counter';
  const ticketNum = await redis.incr(key);
  return ticketNum.toString().padStart(4, '0');
}

// Helper: registrar movimiento (mismo formato que movements.js)
async function registerMovement(productCode, productName, type, quantityBefore, quantityChange, quantityAfter, user = 'system') {
  const id = generateMovementId();
  const timestamp = new Date().toISOString();
  
  const movement = {
    id,
    timestamp,
    productCode,
    productName,
    type,
    quantityBefore,
    quantityChange,
    quantityAfter,
    user
  };
  
  // Guardar en la lista principal (LPUSH para agregar al inicio)
  await redis.lpush(STOCK_MOVEMENTS, JSON.stringify(movement));
  
  // También guardar por producto para búsquedas rápidas
  await redis.lpush(STOCK_MOVEMENTS_BY_PRODUCT(productCode), JSON.stringify(movement));
  
  return movement;
}

// Helper: generar número de ticket secuencial
async function getNextTicketNumber() {
  const key = 'ticket:counter';
  const ticketNum = await redis.incr(key);
  return ticketNum.toString().padStart(4, '0');
}

// Helper: registrar movimiento (same format as movements.js)
async function registerMovement(productCode, productName, type, quantityBefore, quantityChange, quantityAfter, user = 'system') {
  const id = 'mov_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const timestamp = new Date().toISOString();
  
  const movement = {
    id,
    timestamp,
    productCode,
    productName,
    type,
    quantityBefore,
    quantityChange,
    quantityAfter,
    user
  };
  
  // Guardar en la lista principal (LPUSH para agregar al inicio)
  await redis.lpush(STOCK_MOVEMENTS, JSON.stringify(movement));
  
  // También guardar por producto para búsquedas rápidas
  await redis.lpush(STOCK_MOVEMENTS_BY_PRODUCT(productCode), JSON.stringify(movement));
  
  return movement;
}

// POST /api/sales - Crear nueva venta
router.post('/', async (req, res) => {
  try {
    const { items, discountPercent = 0, paymentMethod = 'efectivo', reservationId = null } = req.body;
    
    // Validar datos básicos
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un producto' });
    }
    
    // Calcular totales
    let subtotal = 0;
    const processedItems = [];
    
    for (const item of items) {
      // Obtener producto actual
      const productData = await redis.hgetall(`product:${item.code}`);
      
      if (!productData || !productData.code) {
        return res.status(400).json({ error: `Producto no encontrado: ${item.code}` });
      }
      
      const currentStock = parseInt(productData.stock || 0);
      
      // Verificar stock disponible (si no es reserva)
      if (!reservationId && currentStock < item.quantity) {
        return res.status(400).json({ 
          error: `Stock insuficiente para ${productData.name}. Disponible: ${currentStock}` 
        });
      }
      
      const itemTotal = parseFloat(productData.price) * item.quantity;
      subtotal += itemTotal;
      
      processedItems.push({
        code: item.code,
        name: productData.name,
        quantity: item.quantity,
        price: parseFloat(productData.price),
        subtotal: itemTotal
      });
    }
    
    // Aplicar descuento
    const discountAmount = subtotal * (discountPercent / 100);
    const total = subtotal - discountAmount;
    
    // Generar IDs
    const saleId = generateSaleId();
    const ticketNumber = await getNextTicketNumber();
    
    // Procesar cada producto: descontar stock y registrar movimiento
    for (const item of processedItems) {
      const productData = await redis.hgetall(`product:${item.code}`);
      const quantityBefore = parseInt(productData.stock || 0);
      const quantityAfter = quantityBefore - item.quantity;
      
      // Actualizar stock en Redis
      await redis.hset(`product:${item.code}`, 'stock', quantityAfter);
      
      // Registrar movimiento de venta
      await registerMovement(
        item.code,
        item.name,
        'sale',
        quantityBefore,
        -item.quantity,
        quantityAfter,
        'vendedor'
      );
    }
    
    // Si hay reserva asociada, completarla
    if (reservationId) {
      const reservationData = await redis.hgetall(`reservation:${reservationId}`);
      if (reservationData && reservationData.id) {
        // Actualizar estado de reserva
        await redis.hset(`reservation:${reservationId}`, 'status', 'completed');
        await redis.hset(`reservation:${reservationId}`, 'completedAt', new Date().toISOString());
        
        // Notificación
        const emitNotification = req.app.get('emitNotification');
        if (emitNotification) {
          emitNotification({
            type: 'reservation_completed',
            message: `Reserva #${reservationId.slice(-8)} convertida en venta`,
            reservationId
          });
        }
      }
    }
    
    // Crear registro de venta
    const sale = {
      id: saleId,
      ticketNumber,
      items: JSON.stringify(processedItems),
      subtotal: subtotal.toString(),
      discountPercent: discountPercent.toString(),
      discountAmount: discountAmount.toString(),
      total: total.toString(),
      paymentMethod,
      status: 'completed',
      reservationId: reservationId || '',
      createdAt: new Date().toISOString()
    };
    
    // Guardar venta como hash
    await redis.hmset(`sale:${saleId}`, sale);
    
    // Agregar a lista de ventas
    await redis.lpush('all_sales', `sale:${saleId}`);
    await redis.lpush('recent_sales', `sale:${saleId}`);
    
    // Notificación de venta
    const emitNotification = req.app.get('emitNotification');
    if (emitNotification) {
      emitNotification({
        type: 'sale_completed',
        message: `Venta realizada: $${total.toFixed(2)}`,
        saleId,
        total
      });
    }
    
    res.status(201).json({
      success: true,
      saleId,
      ticketNumber,
      sale
    });
    
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({ error: 'Error al procesar la venta' });
  }
});

// GET /api/sales - Listar ventas
router.get('/', async (req, res) => {
  try {
    const { date, limit = 50, offset = 0 } = req.query;
    
    let saleIds;
    
    if (date) {
      // Filtrar por fecha (formato: YYYY-MM-DD)
      const startTimestamp = new Date(date).getTime();
      const endTimestamp = startTimestamp + 86400000; // 24 horas
      saleIds = await redis.zrangebyscore(SALES_KEY, startTimestamp, endTimestamp);
    } else {
      saleIds = await redis.zrevrange(SALES_KEY, 0, -1);
    }
    
    const total = saleIds.length;
    const paginatedIds = saleIds.slice(offset, offset + limit);
    
    const sales = await Promise.all(
      paginatedIds.map(async (id) => {
        const sale = await redis.hgetall(`${SALES_KEY}:${id}`);
        if (sale.items) {
          sale.items = JSON.parse(sale.items);
        }
        return sale;
      })
    );
    
    res.json({
      sales: sales.filter(s => s.id),
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
});

// GET /api/sales/:id - Obtener venta específica
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await redis.hgetall(`${SALES_KEY}:${id}`);
    
    if (!sale || !sale.id) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    if (sale.items) {
      sale.items = JSON.parse(sale.items);
    }
    
    res.json({ sale });
    
  } catch (error) {
    console.error('Error fetching sale:', error);
    res.status(500).json({ error: 'Error al obtener venta' });
  }
});

module.exports = router;
