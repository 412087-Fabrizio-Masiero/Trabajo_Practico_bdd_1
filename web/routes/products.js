/**
 * Rutas API para gestión de productos
 * Con cliente Redis compartido
 */

const express = require('express');
const { getRedisClient, REDIS_KEYS } = require('../redis-client');

const router = express.Router();

// Función auxiliar para registrar movimientos de stock
async function recordStockMovement(client, productCode, productName, type, quantityBefore, quantityAfter, user = 'system', notes = '') {
  const quantityChange = quantityAfter - quantityBefore;
  const movement = {
    id: 'mov_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    productCode,
    productName,
    type,
    quantityBefore,
    quantityAfter,
    quantityChange,
    user,
    notes,
    timestamp: new Date().toISOString(),
    metadata: {}
  };
  
  // Guardar en la lista principal
  await client.lpush(REDIS_KEYS.stockMovements, JSON.stringify(movement));
  // Guardar por producto
  await client.lpush(REDIS_KEYS.stockMovementsByProduct(productCode), JSON.stringify(movement));
  
  return movement;
}

// Validación básica de producto
function validateProductInput(body) {
  const errors = [];
  const { code, name, category, price, stock, minStock, laboratory, presentation, saleCondition } = body;
  
  if (!code || typeof code !== 'string') errors.push('Código es requerido');
  if (!name || typeof name !== 'string') errors.push('Nombre es requerido');
  if (!category || typeof category !== 'string') errors.push('Categoría es requerida');
  if (typeof price !== 'number' || price <= 0) errors.push('Precio debe ser un número positivo');
  if (typeof stock !== 'number' || stock < 0) errors.push('Stock debe ser un número no negativo');
  if (typeof minStock !== 'number' || minStock < 0) errors.push('Stock mínimo debe ser un número no negativo');
  if (!laboratory || typeof laboratory !== 'string') errors.push('Laboratorio es requerido');
  if (!presentation || typeof presentation !== 'string') errors.push('Tipo de presentación es requerido');
  if (!saleCondition || typeof saleCondition !== 'string') errors.push('Condición de venta es requerida');
  
  return errors;
}

// GET /api/products - Listar productos con filtros
router.get('/', async (req, res) => {
  let client = null;
  try {
    const { category, search, lowStock, hasOffer } = req.query;
    client = getRedisClient();
    
    // NO llamar a connect() - ioredis se conecta automáticamente
    let codes = await client.smembers(REDIS_KEYS.allProducts);
    
    // Filtrar por categoría
    if (category) {
      const categoryCodes = await client.smembers(REDIS_KEYS.productsByCategory(category));
      codes = codes.filter(c => categoryCodes.includes(c));
    }
    
    // Obtener productos
    const products = [];
    for (const code of codes) {
      const product = await client.hgetall(REDIS_KEYS.product(code));
      if (product && Object.keys(product).length > 0) {
        // Parsear números
        product.price = parseFloat(product.price);
        product.stock = parseInt(product.stock);
        product.minStock = parseInt(product.minStock);
        
        // Parsear drugs desde JSON string
        if (product.drugs && typeof product.drugs === 'string') {
          try {
            product.drugs = JSON.parse(product.drugs);
          } catch (e) {
            product.drugs = [];
          }
        }
        
        // Filtrar por búsqueda
        if (search) {
          const searchLower = search.toLowerCase();
          const matches = product.name?.toLowerCase().includes(searchLower) ||
                        product.code?.toLowerCase().includes(searchLower) ||
                        product.description?.toLowerCase().includes(searchLower) ||
                        product.category?.toLowerCase().includes(searchLower) ||
                        product.laboratory?.toLowerCase().includes(searchLower);
          if (!matches) continue;
        }
        
        // Filtrar stock bajo
        if (lowStock === 'true' && product.stock > product.minStock) {
          continue;
        }
        
        // Filtrar por oferta activa
        if (hasOffer === 'true') {
          let hasActiveOffer = false;
          
          if (product.offer && product.offer !== '[object Object]') {
            try {
              // Try to parse as JSON first
              const offer = typeof product.offer === 'string' 
                ? JSON.parse(product.offer) 
                : product.offer;
              
              if (offer && offer.discount > 0 && offer.active === true) {
                hasActiveOffer = true;
              }
            } catch (e) {
              // If JSON parse fails, try regex for JavaScript object literal
              const offerStr = String(product.offer);
              const match = offerStr.match(/\{([^}]+)\}/);
              
              if (match) {
                const content = match[1];
                const discountMatch = content.match(/discount\s*:\s*(\d+)/);
                const activeMatch = content.match(/active\s*:\s*(true|false)/);
                
                if (discountMatch && activeMatch) {
                  const discount = parseInt(discountMatch[1], 10);
                  const isActive = activeMatch[1] === 'true';
                  
                  if (isActive && discount > 0) {
                    hasActiveOffer = true;
                  }
                }
              }
            }
          }
          
          if (!hasActiveOffer) {
            continue;
          }
        }
        
        products.push(product);
      }
    }
    
    res.json({ products, count: products.length });
  } catch (err) {
    console.error('Error listando productos:', err);
    res.status(500).json({ error: 'Error al listar productos', details: err.message });
  }
});

// GET /api/products/:code - Ver un producto
router.get('/:code', async (req, res) => {
  let client = null;
  try {
    const { code } = req.params;
    client = getRedisClient();
    
    // Debug
    console.log('[DEBUG] Looking for product:', code);
    console.log('[DEBUG] Key:', REDIS_KEYS.product(code));
    console.log('[DEBUG] Redis status:', client.status);
    
    const product = await client.hgetall(REDIS_KEYS.product(code));
    
    if (!product || Object.keys(product).length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    // Parsear números
    product.price = parseFloat(product.price);
    product.stock = parseInt(product.stock);
    product.minStock = parseInt(product.minStock);
    
    // Parsear drugs desde JSON string
    if (product.drugs && typeof product.drugs === 'string') {
      try {
        product.drugs = JSON.parse(product.drugs);
      } catch (e) {
        product.drugs = [];
      }
    }
    
    res.json(product);
  } catch (err) {
    console.error('Error obteniendo producto:', err);
    res.status(500).json({ error: 'Error al obtener producto', details: err.message });
  }
});

// POST /api/products - Crear producto
router.post('/', async (req, res) => {
  try {
    const errors = validateProductInput(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Datos inválidos', details: errors });
    }
    
    const { code, name, description, category, price, stock, minStock, laboratory, presentation, saleCondition, drugs, offer } = req.body;
    const client = getRedisClient();
    
    // Verificar si ya existe
    const existing = await client.hgetall(REDIS_KEYS.product(code));
    if (existing && Object.keys(existing).length > 0) {
      return res.status(409).json({ error: `Ya existe un producto con el código: ${code}` });
    }
    
    const now = new Date().toISOString();
    const product = {
      code,
      name,
      description: description || '',
      category,
      price: price.toString(),
      stock: stock.toString(),
      minStock: minStock.toString(),
      laboratory,
      presentation,
      saleCondition,
      createdAt: now,
      updatedAt: now,
    };
    
    // Agregar offer si existe
    if (offer) {
      product.offer = JSON.stringify(offer);
    }
    
    // Agregar drugs si existen
    if (drugs && Array.isArray(drugs) && drugs.length > 0) {
      product.drugs = JSON.stringify(drugs);
    }
    
    // Guardar producto
    await client.hset(REDIS_KEYS.product(code), product);
    
    // Actualizar índices
    await client.sadd(REDIS_KEYS.allProducts, code);
    await client.sadd(REDIS_KEYS.categories, category);
    await client.sadd(REDIS_KEYS.productsByCategory(category), code);
    
    // Agregar a sorted set de vencimiento
    const expiryTimestamp = new Date(expiryDate).getTime();
    await client.zadd(REDIS_KEYS.expiringProducts, expiryTimestamp, code);
    
    // Parsear para respuesta
    product.price = parseFloat(product.price);
    product.stock = parseInt(product.stock);
    product.minStock = parseInt(product.minStock);
    
    res.status(201).json(product);
  } catch (err) {
    console.error('Error creando producto:', err);
    res.status(500).json({ error: 'Error al crear producto', details: err.message });
  }
});

// PUT /api/products/:code - Actualizar producto
router.put('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const client = getRedisClient();
    
    // Verificar que existe
    const existing = await client.hgetall(REDIS_KEYS.product(code));
    if (!existing || Object.keys(existing).length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    const now = new Date().toISOString();
    const updates = { ...req.body, updatedAt: now };
    
    // Si cambió la categoría
    if (updates.category && updates.category !== existing.category) {
      await client.srem(REDIS_KEYS.productsByCategory(existing.category), code);
      await client.sadd(REDIS_KEYS.categories, updates.category);
      await client.sadd(REDIS_KEYS.productsByCategory(updates.category), code);
    }
    
    // Convertir números a strings para Redis
    if (updates.price !== undefined) updates.price = updates.price.toString();
    if (updates.stock !== undefined) updates.stock = updates.stock.toString();
    if (updates.minStock !== undefined) updates.minStock = updates.minStock.toString();
    
    // Convertir offer a string JSON si existe
    if (updates.offer !== undefined) {
      if (updates.offer && typeof updates.offer === 'object') {
        updates.offer = JSON.stringify(updates.offer);
      } else {
        updates.offer = null;
      }
    }
    
    // Convertir drugs a string JSON si existe
    if (updates.drugs !== undefined) {
      if (updates.drugs && Array.isArray(updates.drugs) && updates.drugs.length > 0) {
        updates.drugs = JSON.stringify(updates.drugs);
      } else {
        updates.drugs = null;
      }
    }
    
    // Actualizar
    await client.hset(REDIS_KEYS.product(code), updates);
    
    // Actualizar expiry si cambió
    if (updates.expiryDate) {
      const expiryTimestamp = new Date(updates.expiryDate).getTime();
      await client.zadd(REDIS_KEYS.expiringProducts, expiryTimestamp, code);
    }
    
    // Obtener producto actualizado
    const product = await client.hgetall(REDIS_KEYS.product(code));
    product.price = parseFloat(product.price);
    product.stock = parseInt(product.stock);
    product.minStock = parseInt(product.minStock);
    
    res.json(product);
  } catch (err) {
    console.error('Error actualizando producto:', err);
    res.status(500).json({ error: 'Error al actualizar producto', details: err.message });
  }
});

// DELETE /api/products/:code - Eliminar producto
router.delete('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const client = getRedisClient();
    
    // Verificar que existe
    const existing = await client.hgetall(REDIS_KEYS.product(code));
    if (!existing || Object.keys(existing).length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    // Eliminar de índices
    await client.srem(REDIS_KEYS.allProducts, code);
    await client.srem(REDIS_KEYS.productsByCategory(existing.category), code);
    await client.zrem(REDIS_KEYS.expiringProducts, code);
    
    // Eliminar producto
    await client.del(REDIS_KEYS.product(code));
    
    res.json({ message: 'Producto eliminado', code });
  } catch (err) {
    console.error('Error eliminando producto:', err);
    res.status(500).json({ error: 'Error al eliminar producto', details: err.message });
  }
});

// POST /api/products/:code/stock - Ajustar stock
router.post('/:code/stock', async (req, res) => {
  try {
    const { code } = req.params;
    const { quantity, operation, adjustment, notes } = req.body;
    const client = getRedisClient();
    
    // Soportar dos formatos:
    // 1. quantity + operation (formato actual)
    // 2. adjustment (nuevo formato simple - establece el nuevo valor)
    let qty, op;
    
    if (adjustment !== undefined) {
      // Formato simple: adjustment es el nuevo valor de stock
      qty = adjustment;
      op = 'set';
    } else if (quantity && operation) {
      // Formato original
      qty = quantity;
      op = operation;
    } else {
      return res.status(400).json({ error: 'Se requiere quantity+operation o adjustment' });
    }
    
    if (!['add', 'subtract', 'set'].includes(op)) {
      return res.status(400).json({ error: 'Operación inválida. Use: add, subtract, set' });
    }
    
    // Obtener producto actual
    const existing = await client.hgetall(REDIS_KEYS.product(code));
    if (!existing || Object.keys(existing).length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    let newStock;
    const currentStock = parseInt(existing.stock);
    
    switch (op) {
      case 'add':
        newStock = currentStock + qty;
        break;
      case 'subtract':
        newStock = currentStock - qty;
        if (newStock < 0) {
          return res.status(400).json({ error: `Stock insuficiente. Stock actual: ${currentStock}` });
        }
        break;
      case 'set':
        newStock = qty;
        break;
    }
    
    // Actualizar stock
    await client.hset(REDIS_KEYS.product(code), 'stock', newStock.toString());
    await client.hset(REDIS_KEYS.product(code), 'updatedAt', new Date().toISOString());
    
    // Registrar movimiento de stock
    const type = op === 'add' ? 'entry' : op === 'subtract' ? 'exit' : 'adjustment';
    await recordStockMovement(
      client,
      code,
      existing.name || code,
      type,
      currentStock,
      newStock,
      'system',
      notes || `Stock ${op}: ${qty} unidades`
    );
    
    // Obtener producto actualizado
    const product = await client.hgetall(REDIS_KEYS.product(code));
    product.price = parseFloat(product.price);
    product.stock = parseInt(product.stock);
    product.minStock = parseInt(product.minStock);
    
    res.json(product);
  } catch (err) {
    console.error('Error ajustando stock:', err);
    res.status(500).json({ error: 'Error al ajustar stock', details: err.message });
  }
});

// PUT /api/products/migrate - Migrar productos existentes con nuevos campos
router.put('/migrate', async (req, res) => {
  let client = null;
  try {
    client = getRedisClient();
    
    let codes = await client.smembers(REDIS_KEYS.allProducts);
    
    let migrated = 0;
    let errors = [];
    
    for (const code of codes) {
      const product = await client.hgetall(REDIS_KEYS.product(code));
      if (!product || Object.keys(product).length === 0) continue;
      
      let needsUpdate = false;
      const updates = {};
      
      // Agregar presentation si no existe
      if (!product.presentation) {
        updates.presentation = 'comprimido'; // valor por defecto
        needsUpdate = true;
      }
      
      // Agregar saleCondition si no existe
      if (!product.saleCondition) {
        updates.saleCondition = 'venta-libre'; // valor por defecto
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
          migrated++;
        } catch (err) {
          errors.push(`Error en ${code}: ${err.message}`);
        }
      }
    }
    
    res.json({ 
      message: 'Migración completada',
      migrated,
      total: codes.length,
      errors: errors.length > 0 ? errors : null
    });
  } catch (err) {
    console.error('Error en migración:', err);
    res.status(500).json({ error: 'Error en migración', details: err.message });
  }
});

module.exports = router;
