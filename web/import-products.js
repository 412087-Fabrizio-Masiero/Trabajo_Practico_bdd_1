/**
 * Script para importar productos desde JSON a Redis
 */

const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');

// Usar la misma configuración que el server
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';

const redis = new Redis({
  host: REDIS_HOST,
  port: 6379,
  enableOfflineQueue: true,
  maxRetriesPerRequest: 10,
  retryStrategy: (times) => {
    if (times > 10) return null;
    return Math.min(times * 200, 2000);
  }
});

const productsPath = path.join(__dirname, '../data/products.json');
const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

async function importProducts() {
  console.log(`🔄 Importando ${products.length} productos a Redis...`);
  
  let count = 0;
  let errors = 0;
  
  for (const product of products) {
    try {
      // Crear hash con todos los campos
      const fields = {
        code: product.code,
        name: product.name,
        category: product.category,
        price: product.price,
        stock: product.stock,
        minStock: product.minStock || '10',
        expiryDate: product.expiryDate || '',
        description: product.description || '',
        batchNumber: product.batchNumber || '',
        laboratory: product.laboratory || '',
        presentation: product.presentation || '',
        saleCondition: product.saleCondition || 'venta-libre',
        createdAt: product.createdAt || Date.now().toString(),
        updatedAt: product.updatedAt || new Date().toISOString()
      };
      
      // Agregar oferta si existe
      if (product.offer && product.offer !== '[object Object]') {
        fields.offer = product.offer;
      }
      
      await redis.hmset(`product:${product.code}`, fields);
      
      // Agregar a la lista de todos los productos
      await redis.sadd('all_products', product.code);
      
      // Agregar a la lista de la categoría
      await redis.sadd(`products_by_category:${product.category}`, product.code);
      
      count++;
    } catch (err) {
      errors++;
      console.log(`❌ Error con ${product.code}: ${err.message}`);
    }
  }
  
  console.log(`\n✅ Importación completada`);
  console.log(`   - Productos importados: ${count}`);
  console.log(`   - Errores: ${errors}`);
  
  await redis.quit();
}

importProducts();
