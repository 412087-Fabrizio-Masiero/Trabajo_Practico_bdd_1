#!/bin/bash
# Script para regenerar los índices correctamente

echo "🔄 Regenerando índices de Redis..."

# 1. Obtener todos los códigos de productos de los hashes existentes
echo "1. Escaneando productos..."
products=($(redis-cli --scan 'product:*'))
echo "   Encontrados: ${#products[@]} productos"

# 2. Limpiar índices existentes
echo "2. Limpiando índices..."
redis-cli DEL all_products categories expiring_products
for key in $(redis-cli --scan 'products_by_category:*'); do
  redis-cli DEL "$key"
done

# 3. Reconstruir índices
echo "3. Reconstruyendo índices..."
for product_key in "${products[@]}"; do
  code="${product_key#product:}"
  
  # Obtener datos del producto
  category=$(redis-cli HGET "$product_key" category)
  
  # Agregar a all_products
  redis-cli SADD all_products "$code"
  
  # Agregar a categories
  redis-cli SADD categories "$category"
  
  # Agregar a products_by_category
  redis-cli SADD "products_by_category:$category" "$code"
  
  # Agregar a expiring_products (si tiene expiryDate)
  expiry=$(redis-cli HGET "$product_key" expiryDate)
  if [ -n "$expiry" ]; then
    expiry_ts=$(date -d "$expiry" +%s 2>/dev/null || echo "0")
    if [ "$expiry_ts" != "0" ]; then
      redis-cli ZADD expiring_products "$expiry_ts" "$code"
    fi
  fi
done

echo ""
echo "✅ Índices reconstruidos:"
echo "   - all_products: $(redis-cli SCARD all_products)"
echo "   - categories: $(redis-cli SCARD categories)"
echo "   - expiring_products: $(redis-cli ZCARD expiring_products)"
