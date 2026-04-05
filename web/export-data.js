/**
 * Script para exportar datos de Redis a JSON
 * Ejecutar con: node export-data.js
 */

const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');

const REDIS_HOST = process.env.REDIS_HOST || '172.27.179.115';
const REDIS_PORT = 6379;

// Directorio data en la raíz del proyecto
const DATA_DIR = path.join(__dirname, '..', 'data');

const REDIS_KEYS = {
  product: (code) => `product:${code}`,
  allProducts: 'all_products',
  categories: 'categories',
  category: (cat) => `products_by_category:${cat}`,
  reservations: 'all_reservations',
  reservation: (id) => `reservation:${id}`,
};

async function exportData() {
  const client = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
  });

  console.log('🔄 Conectando a Redis en', REDIS_HOST + ':' + REDIS_PORT);
  
  try {
    // Exportar productos
    console.log('📦 Exportando productos...');
    const productCodes = await client.smembers(REDIS_KEYS.allProducts);
    const products = [];
    
    for (const code of productCodes) {
      const product = await client.hgetall(REDIS_KEYS.product(code));
      if (product && Object.keys(product).length > 0) {
        products.push(product);
      }
    }
    
    fs.writeFileSync(
      path.join(DATA_DIR, 'products.json'),
      JSON.stringify(products, null, 2),
      'utf8'
    );
    console.log(`  ✅ ${products.length} productos exportados`);
    
    // Exportar categorías
    console.log('📂 Exportando categorías...');
    const categories = await client.smembers(REDIS_KEYS.categories);
    fs.writeFileSync(
      path.join(DATA_DIR, 'categories.json'),
      JSON.stringify(categories, null, 2),
      'utf8'
    );
    console.log(`  ✅ ${categories.length} categorías exportadas`);
    
    // Exportar reservas
    console.log('📋 Exportando reservas...');
    const reservationCodes = await client.smembers(REDIS_KEYS.reservations);
    const reservations = [];
    
    for (const id of reservationCodes) {
      const reservation = await client.hgetall(REDIS_KEYS.reservation(id));
      if (reservation && Object.keys(reservation).length > 0) {
        reservations.push(reservation);
      }
    }
    
    fs.writeFileSync(
      path.join(DATA_DIR, 'reservations.json'),
      JSON.stringify(reservations, null, 2),
      'utf8'
    );
    console.log(`  ✅ ${reservations.length} reservas exportadas`);
    
    console.log('\n📁 Datos exportados a la carpeta ./data');
    console.log('Archivos:');
    console.log('  - products.json');
    console.log('  - categories.json');
    console.log('  - reservations.json');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.quit();
  }
}

exportData();
