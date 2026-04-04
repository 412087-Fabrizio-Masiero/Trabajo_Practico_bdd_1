/**
 * Rutas API para reportes
 * Reportes básicos y avanzados del inventario
 */

const express = require('express');
const { getRedisClient, REDIS_KEYS } = require('../redis-client');

const router = express.Router();

// GET /api/reports/stock-low - Reporte de stock bajo por categoría
router.get('/stock-low', async (req, res) => {
  let client = null;
  try {
    client = getRedisClient();
    
    const codes = await client.smembers(REDIS_KEYS.allProducts);
    const products = [];
    
    for (const code of codes) {
      const product = await client.hgetall(REDIS_KEYS.product(code));
      if (product && Object.keys(product).length > 0) {
        const stock = parseInt(product.stock);
        const minStock = parseInt(product.minStock);
        
        if (stock <= minStock) {
          products.push({
            code: product.code,
            name: product.name,
            category: product.category,
            stock: stock,
            minStock: minStock,
            price: parseFloat(product.price),
            value: stock * parseFloat(product.price),
            deficit: minStock - stock
          });
        }
      }
    }
    
    // Agrupar por categoría
    const byCategory = {};
    products.forEach(p => {
      if (!byCategory[p.category]) {
        byCategory[p.category] = [];
      }
      byCategory[p.category].push(p);
    });
    
    res.json({
      report: 'stock-low',
      totalProductsLow: products.length,
      products: products.sort((a, b) => a.deficit - b.deficit),
      byCategory
    });
  } catch (err) {
    console.error('Error en reporte stock bajo:', err);
    res.status(500).json({ error: 'Error al generar reporte', details: err.message });
  }
});

// GET /api/reports/inventory-value - Valor del inventario
router.get('/inventory-value', async (req, res) => {
  let client = null;
  try {
    client = getRedisClient();
    
    const codes = await client.smembers(REDIS_KEYS.allProducts);
    const products = [];
    
    for (const code of codes) {
      const product = await client.hgetall(REDIS_KEYS.product(code));
      if (product && Object.keys(product).length > 0) {
        const stock = parseInt(product.stock);
        const price = parseFloat(product.price);
        
        products.push({
          code: product.code,
          name: product.name,
          category: product.category,
          stock: stock,
          price: price,
          value: stock * price
        });
      }
    }
    
    // Calcular totales por categoría
    const byCategory = {};
    let totalValue = 0;
    let totalStock = 0;
    
    products.forEach(p => {
      totalValue += p.value;
      totalStock += p.stock;
      
      if (!byCategory[p.category]) {
        byCategory[p.category] = { products: 0, stock: 0, value: 0 };
      }
      byCategory[p.category].products++;
      byCategory[p.category].stock += p.stock;
      byCategory[p.category].value += p.value;
    });
    
    res.json({
      report: 'inventory-value',
      totalProducts: products.length,
      totalStock: totalStock,
      totalValue: totalValue,
      averagePrice: totalValue / totalStock,
      products: products.sort((a, b) => b.value - a.value),
      byCategory
    });
  } catch (err) {
    console.error('Error en reporte valor inventario:', err);
    res.status(500).json({ error: 'Error al generar reporte', details: err.message });
  }
});

// GET /api/reports/expiring-products - Productos por vencer
router.get('/expiring-products', async (req, res) => {
  let client = null;
  try {
    const { days = 30 } = req.query;
    client = getRedisClient();
    
    const codes = await client.smembers(REDIS_KEYS.allProducts);
    const products = [];
    const now = new Date();
    const limitDate = new Date(now.getTime() + parseInt(days) * 24 * 60 * 60 * 1000);
    
    for (const code of codes) {
      const product = await client.hgetall(REDIS_KEYS.product(code));
      if (product && product.expiryDate) {
        const expiryDate = new Date(product.expiryDate);
        
        if (expiryDate <= limitDate) {
          const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
          
          products.push({
            code: product.code,
            name: product.name,
            category: product.category,
            stock: parseInt(product.stock),
            expiryDate: product.expiryDate,
            daysUntilExpiry: daysUntilExpiry,
            urgency: daysUntilExpiry <= 7 ? 'critical' : daysUntilExpiry <= 15 ? 'warning' : 'normal'
          });
        }
      }
    }
    
    res.json({
      report: 'expiring-products',
      period: parseInt(days),
      totalExpiring: products.length,
      products: products.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
    });
  } catch (err) {
    console.error('Error en reporte productos por vencer:', err);
    res.status(500).json({ error: 'Error al generar reporte', details: err.message });
  }
});

// GET /api/reports/top-products - Productos más vendidos/reservados
router.get('/top-products', async (req, res) => {
  let client = null;
  try {
    const { limit = 20, type = 'reservations' } = req.query;
    client = getRedisClient();
    
    // Obtener movimientos de tipo reservation y reservation_complete
    const allMovements = await client.lrange(REDIS_KEYS.stockMovements, 0, -1);
    
    // Contabilizar ventas por producto
    const salesByProduct = {};
    
    allMovements.forEach(m => {
      const movement = JSON.parse(m);
      
      if (movement.type === 'reservation' || movement.type === 'reservation_complete') {
        // Las reservas restan stock
        if (movement.type === 'reservation') {
          if (!salesByProduct[movement.productCode]) {
            salesByProduct[movement.productCode] = {
              code: movement.productCode,
              name: movement.productName,
              totalReserved: 0,
              totalValue: 0
            };
          }
          const quantity = Math.abs(movement.quantityChange);
          salesByProduct[movement.productCode].totalReserved += quantity;
        }
      } else if (movement.type === 'entry' || movement.type === 'exit') {
        // Entradas y salidas directas
        if (!salesByProduct[movement.productCode]) {
          salesByProduct[movement.productCode] = {
            code: movement.productCode,
            name: movement.productName,
            totalReserved: 0,
            totalValue: 0
          };
        }
        // Para exit, contar como venta
        if (movement.type === 'exit') {
          salesByProduct[movement.productCode].totalReserved += Math.abs(movement.quantityChange);
        }
      }
    });
    
    // Obtener precios para calcular valor
    const codes = Object.keys(salesByProduct);
    for (const code of codes) {
      const product = await client.hgetall(REDIS_KEYS.product(code));
      if (product && product.price) {
        salesByProduct[code].price = parseFloat(product.price);
        salesByProduct[code].totalValue = salesByProduct[code].totalReserved * parseFloat(product.price);
      }
    }
    
    // Convertir a array y ordenar
    const topProducts = Object.values(salesByProduct)
      .filter(p => p.totalReserved > 0)
      .sort((a, b) => b.totalReserved - a.totalReserved)
      .slice(0, parseInt(limit));
    
    res.json({
      report: 'top-products',
      period: 'all-time',
      totalProducts: topProducts.length,
      products: topProducts
    });
  } catch (err) {
    console.error('Error en reporte top productos:', err);
    res.status(500).json({ error: 'Error al generar reporte', details: err.message });
  }
});

// GET /api/reports/reservations-summary - Resumen de reservas
router.get('/reservations-summary', async (req, res) => {
  let client = null;
  try {
    const { days = 30 } = req.query;
    client = getRedisClient();
    
    const reservationIds = await client.smembers(REDIS_KEYS.reservations);
    
    let completed = 0;
    let cancelled = 0;
    let active = 0;
    let expired = 0;
    let totalValue = 0;
    const byDay = {};
    
    const now = new Date();
    const startDate = new Date(now.getTime() - parseInt(days) * 24 * 60 * 60 * 1000);
    
    for (const id of reservationIds) {
      const reservation = await client.hgetall(REDIS_KEYS.reservation(id));
      if (!reservation || Object.keys(reservation).length === 0) {
        expired++;
        continue;
      }
      
      const createdAt = new Date(reservation.createdAt);
      if (createdAt < startDate) continue;
      
      const day = createdAt.toISOString().split('T')[0];
      
      if (reservation.status === 'completed') {
        completed++;
        totalValue += parseFloat(reservation.total);
        byDay[day] = (byDay[day] || { completed: 0, cancelled: 0, value: 0 });
        byDay[day].completed++;
        byDay[day].value += parseFloat(reservation.total);
      } else if (reservation.status === 'cancelled') {
        cancelled++;
        byDay[day] = (byDay[day] || { completed: 0, cancelled: 0, value: 0 });
        byDay[day].cancelled++;
      } else if (reservation.status === 'active') {
        active++;
      }
    }
    
    const total = completed + cancelled + expired;
    const conversionRate = total > 0 ? (completed / total * 100).toFixed(1) : 0;
    
    res.json({
      report: 'reservations-summary',
      period: parseInt(days),
      total: total,
      completed: completed,
      cancelled: cancelled,
      active: active,
      expired: expired,
      totalValue: totalValue,
      averageValue: completed > 0 ? (totalValue / completed).toFixed(2) : 0,
      conversionRate: conversionRate + '%',
      byDay: byDay
    });
  } catch (err) {
    console.error('Error en reporte resumen reservas:', err);
    res.status(500).json({ error: 'Error al generar reporte', details: err.message });
  }
});

// GET /api/reports/sales-summary - Reporte de ventas
router.get('/sales-summary', async (req, res) => {
  let client = null;
  try {
    const { days = 30 } = req.query;
    client = getRedisClient();
    
    // Obtener ventas de Redis - usar la lista all_sales
    const salesKeys = await client.lrange('all_sales', 0, -1);
    
    let totalSales = 0;
    let totalRevenue = 0;
    let byPaymentMethod = {};
    let byDay = {};
    let productSales = {};
    
    const now = new Date();
    const startDate = new Date(now.getTime() - parseInt(days) * 24 * 60 * 60 * 1000);
    
    for (const key of salesKeys) {
      if (!key) continue;
      
      const sale = await client.hgetall(key);
      if (!sale || !sale.id) continue;
      
      const saleDate = new Date(sale.createdAt);
      if (saleDate < startDate) continue;
      
      totalSales++;
      const total = parseFloat(sale.total || 0);
      totalRevenue += total;
      
      // Por método de pago
      const method = sale.paymentMethod || 'efectivo';
      byPaymentMethod[method] = (byPaymentMethod[method] || 0) + total;
      
      // Por día
      const day = saleDate.toISOString().slice(0, 10);
      if (!byDay[day]) {
        byDay[day] = { count: 0, revenue: 0 };
      }
      byDay[day].count++;
      byDay[day].revenue += total;
      
      // Productos más vendidos
      if (sale.items) {
        const items = JSON.parse(sale.items);
        for (const item of items) {
          if (!productSales[item.code]) {
            productSales[item.code] = { name: item.name, quantity: 0, revenue: 0 };
          }
          productSales[item.code].quantity += item.quantity;
          productSales[item.code].revenue += item.subtotal;
        }
      }
    }
    
    // Ordenar productos por cantidad
    const topProducts = Object.entries(productSales)
      .map(([code, data]) => ({ code, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
    
    // Calcular ticket promedio
    const averageTicket = totalSales > 0 ? (totalRevenue / totalSales).toFixed(2) : 0;
    
    res.json({
      report: 'sales-summary',
      period: parseInt(days),
      totalSales,
      totalRevenue,
      averageTicket,
      byPaymentMethod,
      byDay,
      topProducts
    });
  } catch (err) {
    console.error('Error en reporte ventas:', err);
    res.status(500).json({ error: 'Error al generar reporte', details: err.message });
  }
});

module.exports = router;
