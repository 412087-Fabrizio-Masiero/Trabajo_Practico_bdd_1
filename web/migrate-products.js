/**
 * Script de migración manual de productos
 * Ejecutar con: node migrate-products.js
 */

const Redis = require('ioredis');

const REDIS_HOST = process.env.REDIS_HOST || '172.27.179.115';
const REDIS_PORT = 6379;

const REDIS_KEYS = {
  product: (code) => `product:${code}`,
  allProducts: 'all_products',
};

async function migrate() {
  const client = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
  });

  console.log('🔄 Conectando a Redis en', REDIS_HOST + ':' + REDIS_PORT);
  
  try {
    // Obtener todos los códigos de productos
    let codes = await client.smembers(REDIS_KEYS.allProducts);
    console.log('📦 Productos encontrados:', codes.length);
    
    let migrated = 0;
    let errors = [];
    
    for (const code of codes) {
      const product = await client.hgetall(REDIS_KEYS.product(code));
      if (!product || Object.keys(product).length === 0) continue;
      
      let needsUpdate = false;
      const updates = {};
      
      // Agregar presentation si no existe
      if (!product.presentation) {
        updates.presentation = 'comprimido';
        needsUpdate = true;
      }
      
      // Agregar saleCondition si no existe
      if (!product.saleCondition) {
        updates.saleCondition = 'venta-libre';
        needsUpdate = true;
      }
      
      // Agregar laboratory si no existe
      if (!product.laboratory) {
        updates.laboratory = 'Otro';
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        try {
          await client.hset(REDIS_KEYS.product(code), updates);
          console.log(`  ✅ ${code}:`, updates);
          migrated++;
        } catch (err) {
          errors.push(`Error en ${code}: ${err.message}`);
        }
      }
    }
    
    console.log('\n📊 Resultado de migración:');
    console.log('   Migrados:', migrated);
    console.log('   Total:', codes.length);
    console.log('   Errores:', errors.length > 0 ? errors : 'ninguno');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.quit();
  }
}

migrate();
