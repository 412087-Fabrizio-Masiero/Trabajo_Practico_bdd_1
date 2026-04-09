/**
 * Script para eliminar el campo expiryDate de todos los productos
 */

const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379
});

async function removeExpiryDateFromAllProducts() {
  try {
    // Obtener todos los códigos de productos
    const productCodes = await redis.smembers('all_products');
    
    console.log(`Total de productos: ${productCodes.length}`);
    
    let updated = 0;
    
    for (const code of productCodes) {
      // Obtener el producto
      const productJson = await redis.get(`product:${code}`);
      if (!productJson) continue;
      
      const product = JSON.parse(productJson);
      
      // Si tiene expiryDate, eliminarlo
      if (product.expiryDate) {
        delete product.expiryDate;
        await redis.set(`product:${code}`, JSON.stringify(product));
        updated++;
        console.log(`✓ Actualizado: ${code}`);
      }
    }
    
    console.log(`\n✅ Proceso completado. Productos actualizados: ${updated}`);
    
    redis.quit();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    redis.quit();
    process.exit(1);
  }
}

removeExpiryDateFromAllProducts();