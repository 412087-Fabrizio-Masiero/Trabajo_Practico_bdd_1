const Redis = require('ioredis');

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
});

const REDIS_KEYS = {
  product: (code) => `product:${code}`,
  categories: 'categories',
  expiringProducts: 'expiring_products',
  productsByCategory: (category) => `products_by_category:${category}`,
  allProducts: 'all_products',
};

const products = require('../data/products.json');

async function importProducts() {
  console.log(`🔄 Importando ${products.length} productos a Redis...`);
  
  let imported = 0;
  let errors = 0;
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    try {
      const code = product.code;
      if (!code) continue;

      const redisProduct = {
        code: code,
        name: product.name || '',
        description: product.description || '',
        category: product.category || 'sin-categoria',
        price: String(product.price || 0),
        stock: String(product.stock || 0),
        minStock: String(product.minStock || 0),
        expiryDate: product.expiryDate || '',
        batchNumber: product.batchNumber || '',
        laboratory: product.laboratory || '',
        presentation: product.presentation || 'comprimido',
        saleCondition: product.saleCondition || 'venta-libre',
        createdAt: product.createdAt || new Date().toISOString(),
        updatedAt: product.updatedAt || new Date().toISOString(),
      };

      if (product.offer && product.offer !== '[object Object]') {
        try {
          const offer = typeof product.offer === 'string' 
            ? JSON.parse(product.offer) 
            : product.offer;
          if (offer && typeof offer === 'object') {
            redisProduct.offer = JSON.stringify(offer);
          }
        } catch (e) {}
      }

      await redis.hset(REDIS_KEYS.product(code), redisProduct);
      await redis.sadd(REDIS_KEYS.allProducts, code);
      await redis.sadd(REDIS_KEYS.categories, redisProduct.category);
      await redis.sadd(REDIS_KEYS.productsByCategory(redisProduct.category), code);

      if (redisProduct.expiryDate) {
        const expiryTimestamp = new Date(redisProduct.expiryDate).getTime();
        if (!isNaN(expiryTimestamp)) {
          await redis.zadd(REDIS_KEYS.expiringProducts, expiryTimestamp, code);
        }
      }

      imported++;
      if (imported % 25 === 0) {
        console.log(`   Importados ${imported}/${products.length}...`);
      }
    } catch (err) {
      console.error(`❌ Error con ${product.code}: ${err.message}`);
      errors++;
    }
  }
  
  console.log(`\n✅ Importación completada`);
  console.log(`   - Productos importados: ${imported}`);
  console.log(`   - Errores: ${errors}`);

  const totalProducts = await redis.scard(REDIS_KEYS.allProducts);
  console.log(`   - Total en Redis: ${totalProducts}`);

  await redis.quit();
  process.exit(0);
}

importProducts().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
