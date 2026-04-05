# Historial de Cambios - Farmality (BDD2)

## Sistema de Gestión de Stock de Farmacia

Este documento registra todos los cambios realizados al proyecto desde que se clonó el repositorio.

---

## Cambios Realizados

### 1. Formulario de Productos

- **Campos reorganizados**: Se corrigió el formulario de creación de producto que tenía campos duplicados y orden incorrecto
- **Checkbox de oferta alineado**: El checkbox "Oferta Activa" ahora está alineado con el campo de descuento
- **Laboratorio como dropdown**: El campo de texto de laboratorio fue cambiado a un select con los principales laboratorios farmacéuticos
- **Campos opcionales no guardados**: Los campos vacíos ya no se guardan en el JSON (drugs, offer, etc.)

### 2. Sistema de Ofertas

- **Badge de oferta en cards**: Las cards de productos en la vista de ventas ahora muestran un badge rojo "OFERTA -X%" cuando el producto tiene oferta activa
- **Precio con descuento**: Se muestra el precio tachado y el precio con descuento en verde
- **Carrito con descuentos**: El carrito muestra:
  - Precio tachado + precio con descuento por producto
  - Descuento total aplicado
  - Detalle del descuento por cada producto
- **Campo de descuento manual eliminado**: Se quitó el input de descuento manual del carrito

### 3. Migración de Productos

- **Script de migración**: Se creó `web/migrate-products.js` para agregar campos faltantes a productos existentes
- **Campos agregados**: presentation, saleCondition, laboratory
- **209 productos migrados** exitosamente

### 4. Vista de Ventas

- **Filtro en tiempo real**: El input de búsqueda filtra productos mientras se escribe (sin debounce)
- **Búsqueda por nombre y código**: Filtra tanto por nombre como por código del producto

### 5. Dashboard

- **Card "Valor" eliminada**: Se quitó la card que mostraba el valor del stock
- **Card "Por Vencer" eliminada**: Se quitó la card de productos próximos a vencer
- **Card de Reservas**: Se agregó una nueva card que muestra la cantidad de reservas activas

### 6. Alertas

- **Alertas de vencimiento eliminadas**: Ya no se muestran alertas de productos por vencer
- **Solo Stock Bajo**: Las alertas ahora solo muestran productos con stock bajo

### 7. Moneda

- **Cambio a Pesos Argentinos**: La moneda se cambió de USD a ARS (pesos argentinos)

### 8. Logo

- **Enlace al Dashboard**: El logo "Farmality" ahora es un enlace que lleva al Dashboard

### 9. Base de Datos

- **Eliminación de datos de vencimiento**: Se eliminó la key `expiring_products` de Redis
- **Carpeta data**: Se creó la carpeta `data` con scripts de exportación:
  - `products.json` - 210 productos
  - `categories.json` - 15 categorías
  - `reservations.json` - 3 reservas

---

## Archivos Modificados

### Backend (`web/routes/`)

- `products.js` - Endpoints de productos, validación, migración
- `stats.js` - Estadísticas del dashboard (sin valor stock, sin vencimiento)
- `alerts.js` - Solo alertas de stock bajo
- `reservations.js` - Reservas (sin cambios principales)

### Frontend (`web/public/`)

- `index.html` - HTML con formularios y Dashboard
- `app.js` - Lógica de frontend, ventas, carrito
- `styles.css` - Estilos CSS (sin cambios principales)

### Scripts

- `web/migrate-products.js` - Script de migración de productos
- `web/export-data.js` - Script para exportar datos a JSON

---

## Notas Técnicas

- **Redis**: La base de datos está corriendo en WSL (172.27.179.115)
- **Puerto**: El servidor corre en el puerto 3005
- **Inicio del servidor**: `$env:REDIS_HOST="172.27.179.115"; npm start`

---

## Fecha de Última Actualización

4 de Abril de 2026
