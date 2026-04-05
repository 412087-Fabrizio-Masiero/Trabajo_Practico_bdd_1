const reservations = require('../data/reservations.json');

let commands = '';

for (const res of reservations) {
  const id = res.id;
  commands += `HSET reservation:${id} id "${id}" customerName "${res.customerName}" total "${res.total}" status "${res.status}" items '${res.items}' createdAt "${res.createdAt}" expiresAt "${res.expiresAt}" cancelledAt "${res.cancelledAt || ''}" completedAt "${res.completedAt || ''}" customerId "${res.customerId || ''}"\n`;
  commands += `SADD all_reservations ${id}\n`;
  if (res.customerName) {
    commands += `SADD reservations:customer:${res.customerName} ${id}\n`;
  }
}

console.log(`Reservas: ${reservations.length}`);
console.log(commands);
