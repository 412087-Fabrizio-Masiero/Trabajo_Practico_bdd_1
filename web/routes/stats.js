/**
 * Rutas API para estadísticas y categorías
 * Con cliente Redis compartido
 */

const express = require('express');
const { getRedisClient, REDIS_KEYS } = require('../redis-client');

const router = express.Router();

// GET /api/stats - Estadísticas del dashboard
router.get('/', async (req, res) => {
  try {
    const client = getRedisClient();
    
    const productCodes = await client.smembers(REDIS_KEYS.allProducts);
    const totalProducts = productCodes.length;
    
    // Obtener cantidad de reservas activas
    const reservationCodes = await client.smembers(REDIS_KEYS.reservations);
    let activeReservations = 0;
    const now = new Date();
    
    for (const id of reservationCodes) {
      const reservation = await client.hgetall(REDIS_KEYS.reservation(id));
      if (reservation && reservation.status === 'active') {
        // Verificar si no está expirada
        const expiresAt = new Date(reservation.expiresAt);
        if (expiresAt > now) {
          activeReservations++;
        }
      }
    }
    
    let totalStock = 0;
    let lowStockCount = 0;
    const categoryStats = {};
    
    for (const code of productCodes) {
      const product = await client.hgetall(REDIS_KEYS.product(code));
      
      if (product && Object.keys(product).length > 0) {
        const stock = parseInt(product.stock);
        const minStock = parseInt(product.minStock);
        const price = parseFloat(product.price);
        
        totalStock += stock;
        
        if (stock <= minStock) lowStockCount++;
        
        const category = product.category;
        if (!categoryStats[category]) {
          categoryStats[category] = { count: 0, stock: 0, value: 0 };
        }
        categoryStats[category].count++;
        categoryStats[category].stock += stock;
        categoryStats[category].value += stock * price;
      }
    }
    
    res.json({
      totalProducts,
      totalStock,
      totalReservations: activeReservations,
      lowStockCount,
      categoryStats,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error obteniendo estadísticas:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas', details: err.message });
  }
});

// GET /api/categories - Listar categorías
router.get('/', async (req, res) => {
  try {
    const client = getRedisClient();
    const categories = await client.smembers(REDIS_KEYS.categories);
    const categoryList = [];
    
    for (const category of categories) {
      const codes = await client.smembers(REDIS_KEYS.productsByCategory(category));
      let totalStock = 0;
      let totalValue = 0;
      
      for (const code of codes) {
        const product = await client.hgetall(REDIS_KEYS.product(code));
        if (product && Object.keys(product).length > 0) {
          const stock = parseInt(product.stock);
          const price = parseFloat(product.price);
          totalStock += stock;
          totalValue += stock * price;
        }
      }
      
      categoryList.push({
        name: category,
        productCount: codes.length,
        totalStock,
        totalValue: Math.round(totalValue * 100) / 100,
      });
    }
    
    categoryList.sort((a, b) => a.name.localeCompare(b.name));
    
    res.json({ categories: categoryList, count: categoryList.length });
  } catch (err) {
    console.error('Error obteniendo categorías:', err);
    res.status(500).json({ error: 'Error al obtener categorías', details: err.message });
  }
});

module.exports = router;
