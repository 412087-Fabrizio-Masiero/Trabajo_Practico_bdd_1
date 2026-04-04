// Test script to debug Redis connection
const Redis = require('ioredis');

const client = new Redis({
  host: '127.0.0.1',
  port: 6379,
});

(async () => {
  try {
    // Wait a bit for connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Status:', client.status);
    
    // Ping first
    const ping = await client.ping();
    console.log('Ping:', ping);
    
    const result = await client.hgetall('product:oft0115');
    console.log('Result:', result);
    
    const codes = await client.smembers('all_products');
    console.log('Total codes:', codes.length);
    
    await client.quit();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
