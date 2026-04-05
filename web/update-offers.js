const Redis = require('ioredis');

const redis = new Redis({
  host: '127.0.0.1',
  port: 6379,
});

const products = require('../data/products.json');

async function updateOffers() {
  let count = 0;
  
  for (const product of products) {
    if (product.offer && product.offer !== '[object Object]') {
      await redis.hset(`product:${product.code}`, 'offer', product.offer);
      count++;
      console.log(`${product.code}: ${product.offer}`);
    }
  }
  
  console.log(`\n✅ Actualizadas ${count} ofertas`);
  await redis.quit();
}

updateOffers();
