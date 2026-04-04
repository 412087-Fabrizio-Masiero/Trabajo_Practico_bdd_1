/**
 * Rutas API para categorías
 * Con cliente Redis compartido
 */

const express = require('express');
const { getRedisClient, REDIS_KEYS } = require('../redis-client');

const router = express.Router();
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
