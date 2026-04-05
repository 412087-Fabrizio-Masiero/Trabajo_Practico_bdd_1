/**
 * Rutas API para alertas de stock y vencimiento
 * Con cliente Redis compartido
 */

const express = require('express');
const { getRedisClient, REDIS_KEYS } = require('../redis-client');

const router = express.Router();

// Calcular días hasta vencimiento
function calculateDaysUntilExpiry(expiryDate) {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// GET /api/alerts/low-stock - Productos con stock bajo
router.get('/low-stock', async (req, res) => {
  try {
    const { severity } = req.query;
    const client = getRedisClient();
    
    const codes = await client.smembers(REDIS_KEYS.allProducts);
    const alerts = [];
    
    for (const code of codes) {
      const product = await client.hgetall(REDIS_KEYS.product(code));
      
      if (product && Object.keys(product).length > 0) {
        const stock = parseInt(product.stock);
        const minStock = parseInt(product.minStock);
        
        if (stock <= minStock) {
          const alertSeverity = stock === 0 ? 'critical' : 'warning';
          
          if (severity && severity !== alertSeverity) continue;
          
          alerts.push({
            code: product.code,
            name: product.name,
            category: product.category,
            stock,
            minStock,
            message: `Stock bajo: ${stock} unidades (mínimo: ${minStock})`,
            type: 'low_stock',
            severity: alertSeverity,
          });
        }
      }
    }
    
    alerts.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (b.severity === 'critical' && a.severity !== 'critical') return 1;
      return a.stock - b.stock;
    });
    
    res.json({ alerts, count: alerts.length });
  } catch (err) {
    console.error('Error obteniendo alertas de stock:', err);
    res.status(500).json({ error: 'Error al obtener alertas', details: err.message });
  }
});

// GET /api/alerts/expiring - Productos próximos a vencer
router.get('/expiring', async (req, res) => {
  try {
    const { days } = req.query;
    const daysAhead = parseInt(days) || 30;
    const client = getRedisClient();
    
    const now = Date.now();
    const futureDate = now + daysAhead * 24 * 60 * 60 * 1000;
    
    const expiringCodes = await client.zrangebyscore(REDIS_KEYS.expiringProducts, now, futureDate);
    const expiredCodes = await client.zrangebyscore(REDIS_KEYS.expiringProducts, 0, now - 1);
    
    const alerts = [];
    
    for (const code of expiringCodes) {
      const product = await client.hgetall(REDIS_KEYS.product(code));
      
      if (product && Object.keys(product).length > 0) {
        const daysUntilExpiry = calculateDaysUntilExpiry(product.expiryDate);
        const severity = daysUntilExpiry <= 7 ? 'critical' : 'warning';
        
        alerts.push({
          code: product.code,
          name: product.name,
          category: product.category,
          expiryDate: product.expiryDate,
          daysUntilExpiry,
          message: `Próximo a vencer en ${daysUntilExpiry} días (${product.expiryDate})`,
          type: 'expiring_soon',
          severity,
        });
      }
    }
    
    for (const code of expiredCodes) {
      const product = await client.hgetall(REDIS_KEYS.product(code));
      
      if (product && Object.keys(product).length > 0) {
        alerts.push({
          code: product.code,
          name: product.name,
          category: product.category,
          expiryDate: product.expiryDate,
          daysUntilExpiry: -calculateDaysUntilExpiry(product.expiryDate),
          message: `VENCIDO desde ${product.expiryDate}`,
          type: 'expired',
          severity: 'critical',
        });
      }
    }
    
    alerts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
    
    res.json({ alerts, count: alerts.length });
  } catch (err) {
    console.error('Error obteniendo alertas de vencimiento:', err);
    res.status(500).json({ error: 'Error al obtener alertas', details: err.message });
  }
});

// GET /api/alerts/all - Todas las alertas combinadas
router.get('/all', async (req, res) => {
  try {
    const client = getRedisClient();
    const codes = await client.smembers(REDIS_KEYS.allProducts);
    const alerts = [];
    
    for (const code of codes) {
      const product = await client.hgetall(REDIS_KEYS.product(code));
      
      if (product && Object.keys(product).length > 0) {
        const stock = parseInt(product.stock);
        const minStock = parseInt(product.minStock);
        
        // Solo alerta de stock bajo
        if (stock <= minStock) {
          const alertSeverity = stock === 0 ? 'critical' : 'warning';
          alerts.push({
            code: product.code,
            name: product.name,
            category: product.category,
            stock,
            minStock,
            message: `Stock bajo: ${stock} unidades (mínimo: ${minStock})`,
            type: 'low_stock',
            severity: alertSeverity,
          });
        }
      }
    }
    
    alerts.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (b.severity === 'critical' && a.severity !== 'critical') return 1;
      return a.stock - b.stock;
    });
    
    res.json({ alerts, count: alerts.length });
  } catch (err) {
    console.error('Error obteniendo todas las alertas:', err);
    res.status(500).json({ error: 'Error al obtener alertas', details: err.message });
  }
});

module.exports = router;
