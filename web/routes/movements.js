/**
 * Rutas API para historial de movimientos de stock
 * Sistema de trazabilidad de cambios en el inventario
 */

const express = require('express');
const { getRedisClient, REDIS_KEYS } = require('../redis-client');

const router = express.Router();

// Generar ID único para movimiento
function generateMovementId() {
  return 'mov_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Función auxiliar para registrar un movimiento
async function recordMovement(client, movement) {
  const id = generateMovementId();
  movement.id = id;
  movement.timestamp = new Date().toISOString();
  
  // Guardar en la lista principal (LPUSH para agregar al inicio)
  await client.lpush(REDIS_KEYS.stockMovements, JSON.stringify(movement));
  
  // También guardar por producto para búsquedas rápidas
  await client.lpush(REDIS_KEYS.stockMovementsByProduct(movement.productCode), JSON.stringify(movement));
  
  return movement;
}

// GET /api/movements - Listar movimientos
router.get('/', async (req, res) => {
  let client = null;
  try {
    const { productCode, type, limit = 50, offset = 0, dateFrom, dateTo } = req.query;
    client = getRedisClient();
    
    let movements = [];
    
    if (productCode) {
      // Movimientos de un producto específico
      const key = REDIS_KEYS.stockMovementsByProduct(productCode);
      const rawMovements = await client.lrange(key, offset, offset + parseInt(limit) - 1);
      movements = rawMovements.map(m => JSON.parse(m));
    } else {
      // Todos los movimientos
      const rawMovements = await client.lrange(REDIS_KEYS.stockMovements, offset, offset + parseInt(limit) - 1);
      movements = rawMovements.map(m => JSON.parse(m));
    }
    
    // Filtrar por tipo si se especifica
    if (type) {
      movements = movements.filter(m => m.type === type);
    }
    
    // Filtrar por fecha desde
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      movements = movements.filter(m => new Date(m.timestamp) >= fromDate);
    }
    
    // Filtrar por fecha hasta
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      movements = movements.filter(m => new Date(m.timestamp) <= toDate);
    }
    
    // Ordenar por timestamp (más recientes primero)
    movements.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({ movements, count: movements.length });
  } catch (err) {
    console.error('Error listando movimientos:', err);
    res.status(500).json({ error: 'Error al listar movimientos', details: err.message });
  }
});

// GET /api/movements/product/:code - Historial de un producto específico
router.get('/product/:code', async (req, res) => {
  let client = null;
  try {
    const { code } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    client = getRedisClient();
    
    const key = REDIS_KEYS.stockMovementsByProduct(code);
    const rawMovements = await client.lrange(key, offset, offset + parseInt(limit) - 1);
    const movements = rawMovements.map(m => JSON.parse(m));
    
    // Ordenar por timestamp
    movements.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({ movements, count: movements.length, productCode: code });
  } catch (err) {
    console.error('Error obteniendo historial del producto:', err);
    res.status(500).json({ error: 'Error al obtener historial', details: err.message });
  }
});

// GET /api/movements/export - Exportar movimientos
router.get('/export', async (req, res) => {
  let client = null;
  try {
    const { format = 'json', startDate, endDate } = req.query;
    client = getRedisClient();
    
    const rawMovements = await client.lrange(REDIS_KEYS.stockMovements, 0, -1);
    let movements = rawMovements.map(m => JSON.parse(m));
    
    // Filtrar por fecha si se especifica
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      
      movements = movements.filter(m => {
        const date = new Date(m.timestamp);
        return date >= start && date <= end;
      });
    }
    
    // Ordenar por timestamp
    movements.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (format === 'csv') {
      // Convertir a CSV
      const headers = ['ID', 'Fecha', 'Producto', 'Código', 'Tipo', 'Cantidad Anterior', 'Cantidad Nueva', 'Cambio', 'Usuario', 'Notas'];
      const rows = movements.map(m => [
        m.id,
        m.timestamp,
        m.productName,
        m.productCode,
        m.type,
        m.quantityBefore,
        m.quantityAfter,
        m.quantityChange,
        m.user || '',
        m.notes || ''
      ]);
      
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=movimientos_stock.csv');
      res.send(csv);
    } else {
      res.json({ movements, count: movements.length });
    }
  } catch (err) {
    console.error('Error exportando movimientos:', err);
    res.status(500).json({ error: 'Error al exportar movimientos', details: err.message });
  }
});

// POST /api/movements - Crear un movimiento manualmente (para testing)
router.post('/', async (req, res) => {
  let client = null;
  try {
    const { productCode, productName, type, quantityBefore, quantityAfter, quantityChange, user, notes, metadata } = req.body;
    client = getRedisClient();
    
    if (!productCode || !type || quantityBefore === undefined || quantityAfter === undefined) {
      return res.status(400).json({ error: 'Campos requeridos: productCode, type, quantityBefore, quantityAfter' });
    }
    
    const movement = {
      productCode,
      productName: productName || '',
      type,
      quantityBefore,
      quantityAfter,
      quantityChange: quantityChange || (quantityAfter - quantityBefore),
      user: user || 'system',
      notes: notes || '',
      metadata: metadata || {}
    };
    
    const savedMovement = await recordMovement(client, movement);
    
    res.status(201).json(savedMovement);
  } catch (err) {
    console.error('Error creando movimiento:', err);
    res.status(500).json({ error: 'Error al crear movimiento', details: err.message });
  }
});

module.exports = router;
