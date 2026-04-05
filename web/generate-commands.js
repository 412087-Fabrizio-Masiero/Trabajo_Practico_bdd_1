const products = require('../data/products.json');
const fs = require('fs');

let commands = '';

for (const product of products) {
  const code = product.code;
  if (!code) continue;

  const name = (product.name || '').replace(/"/g, '\\"');
  const description = (product.description || '').replace(/"/g, '\\"');
  const category = product.category || 'sin-categoria';
  const price = product.price || 0;
  const stock = product.stock || 0;
  const minStock = product.minStock || 0;
  const expiryDate = product.expiryDate || '';
  const batchNumber = product.batchNumber || '';
  const laboratory = product.laboratory || '';
  const presentation = product.presentation || 'comprimido';
  const saleCondition = product.saleCondition || 'venta-libre';
  const createdAt = product.createdAt || new Date().toISOString();
  const updatedAt = product.updatedAt || new Date().toISOString();
  const offer = product.offer || '';

  commands += `HSET product:${code} code "${code}" name "${name}" description "${description}" category "${category}" price "${price}" stock "${stock}" minStock "${minStock}" expiryDate "${expiryDate}" batchNumber "${batchNumber}" laboratory "${laboratory}" presentation "${presentation}" saleCondition "${saleCondition}" createdAt "${createdAt}" updatedAt "${updatedAt}" offer "${offer}"\n`;
  commands += `SADD all_products ${code}\n`;
  commands += `SADD categories ${category}\n`;
  commands += `SADD products_by_category:${category} ${code}\n`;
  
  if (expiryDate) {
    const expiryTimestamp = new Date(expiryDate).getTime();
    if (!isNaN(expiryTimestamp)) {
      commands += `ZADD expiring_products ${expiryTimestamp} ${code}\n`;
    }
  }
}

fs.writeFileSync('import-commands.txt', commands);
console.log(`✅ Generados ${products.length} productos`);
console.log(`   Archivo: import-commands.txt`);
console.log(`   Ejecuta: wsl -e redis-cli < import-commands.txt`);
