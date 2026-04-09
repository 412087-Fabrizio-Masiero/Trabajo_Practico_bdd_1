/**
 * Script para actualizar ofertas en productos existentes
 * Ejecutar con: node update-offers.js
 */

const Redis = require('ioredis');

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

const products = require('../data/products.json');

async function updateOffers() {
  console.log('🔄 Iniciando actualización de ofertas...');
  let count = 0;
  
  for (const product of products) {
    if (product.offer && product.offer !== '[object Object]' && product.offer !== '') {
      try {
        await redis.hset(`product:${product.code}`, 'offer', product.offer);
        count++;
        console.log(`✅ ${product.code}: ${product.offer}`);
      } catch (err) {
        console.log(`❌ Error con ${product.code}: ${err.message}`);
      }
    }
  }
  
  console.log(`\n✅ Total ofertas actualizadas: ${count}`);
  await redis.quit();
}

updateOffers();
