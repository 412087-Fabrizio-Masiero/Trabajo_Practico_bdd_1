# Especificación: Reservas con TTL y Historial de Movimientos

## 1. Reservas con TTL

### Descripción
Sistema de reservas que permite a los clientes "bloquear" productos por un tiempo limitado. Cuando la reserva expira, el stock se libera automáticamente.

### Estructura Redis

```
Clave: reservation:{reservationId}
Tipo: Hash
TTL: 1800 segundos (30 minutos)

Campos:
- id: string (ID único de reserva)
- customerName: string
- customerId: string (opcional)
- items: JSON string [{code, quantity, productName, price}]
- total: number
- status: "active" | "completed" | "cancelled" | "expired"
- createdAt: ISO timestamp
- expiresAt: ISO timestamp
- completedAt: ISO timestamp (nullable)
```

```
Clave: reservations:customer:{customerId}
Tipo: Set
Contenido: IDs de reservas del cliente
```

```
Clave: product:reservations:{productCode}
Tipo: Set
Contenido: IDs de reservas activas que incluyen este producto
```

### API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /api/reservations | Crear una nueva reserva |
| GET | /api/reservations | Listar reservas (con filtros) |
| GET | /api/reservations/:id | Ver detalles de una reserva |
| POST | /api/reservations/:id/complete | Confirmar/completar reserva |
| POST | /api/reservations/:id/cancel | Cancelar reserva |
| GET | /api/reservations/:id/time | Tiempo restante de la reserva |

### Flujo de una Reserva

```
1. Cliente selecciona productos
2. POST /api/reservations con lista de items
3. Backend:
   a. Verificar stock disponible para cada producto
   b. "Bloquear" stock (decrementar atómicamente)
   c. Crear reserva con TTL = 30 min
   d. Guardar en Redis con expiración automática
4. Si cliente completa:
   a. POST /api/reservations/:id/complete
   b. Stock se descuenta permanentemente
5. Si cliente cancela:
   a. POST /api/reservations/:id/cancel
   b. Stock se restaura
6. Si TTL expira:
   a. Redis elimina automáticamente la clave
   b. Un job/check restaura el stock (manual o automatizado)
```

### Casos Edge

- **Stock insuficiente**: Si un producto tiene menos stock que el solicitado, rechazar la reserva
- **Reserva expirada**: Cuando se intenta completar una reserva expirada, mostrar error
- **Productos fuera del set**: Si un producto deja de existir, manejar el error

---

## 2. Historial de Movimientos

### Descripción
Registro de todos los cambios de stock con información completa para trazabilidad.

### Estructura Redis

```
Clave: stock_movements
Tipo: List (LPUSH para agregar al inicio)
TTL: Sin expiración (persist indefinitely)

Cada elemento es un JSON con la estructura:
{
  id: string,
  productCode: string,
  productName: string,
  type: "entry" | "exit" | "adjustment" | "reservation" | "reservation_release" | "reservation_complete",
  quantityBefore: number,
  quantityAfter: number,
  quantityChange: number,
  user: string,
  notes: string,
  timestamp: ISO timestamp,
  metadata: object (campos adicionales según tipo)
}
```

### Tipos de Movimiento

| Tipo | Descripción | quantityChange |
|------|-------------|----------------|
| entry | Entrada de stock (compra) | Positivo |
| exit | Salida de stock (venta) | Negativo |
| adjustment | Ajuste manual | Positivo o Negativo |
| reservation | Reserva creada (stock bloqueado) | Negativo |
| reservation_release | Reserva cancelada/expirada (stock liberado) | Positivo |
| reservation_complete | Reserva completada (stock confirmado) | 0 (ya estaba bloqueado) |

### API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /api/movements | Listar movimientos (con filtros, paginado) |
| GET | /api/movements/product/:code | Historial de un producto específico |
| GET | /api/movements/export | Exportar movimientos (CSV/JSON) |

### Parámetros de Filtrado

- `productCode`: Filtrar por código de producto
- `type`: Filtrar por tipo de movimiento
- `startDate`: Fecha inicio
- `endDate`: Fecha fin
- `limit`: Cantidad de resultados (default: 50, max: 200)
- `offset`: Para paginado

---

## 3. Cambios en API de Productos Existente

### GET /api/products/:code

Agregar campos adicionales al response para soportar la nueva funcionalidad:

```json
{
  "code": "ASP001",
  "name": "Aspirina 500mg",
  "stock": 45,
  "minStock": 10,
  "reservedStock": 2,
  "availableStock": 43,
  ...
}
```

- `reservedStock`: Cantidad bloqueada por reservas activas
- `availableStock`: Stock disponible para nueva reserva/venta

---

## 4. Integración con Frontend

### Nueva Vista: Reservas

- Lista de reservas activas
- Detalle de cada reserva
- Botón para completar reserva
- Botón para cancelar reserva
- Timer mostrando tiempo restante

### Actualización: Vista Productos

- Mostrar stock disponible vs stock reservado
- Botón "Agregar a reserva" en cada producto
- Indicador visual cuando stock está bajo por reservas

### Nueva Vista: Historial

- Tabla de movimientos con filtros
- Exportación de datos
- Historial por producto

---

## 5. Validaciones

### Reserva

1. Todos los productos deben existir
2. Stock disponible >= cantidad solicitada
3. Cada producto debe tener stock mínimo para la reserva

### Historial

1. Cada cambio de stock debe generar un movimiento
2. El movimiento debe incluir: timestamp, usuario, tipo, cantidades

---

## 6. TTL y Limpieza

### Reserva Expirada
- Redis elimina la clave automáticamente cuando expira
- Un proceso (puede ser manual o un cron job) debe:
  1. Buscar reservas que expiraron pero aún tienen stock bloqueado
  2. Restaurar el stock bloqueado
  3. Crear movimiento de tipo "reservation_release"

### Propuesta: Job de Limpieza
```javascript
// Cada 5 minutos, verificar reservas expiradas
// cuyo stock no ha sido restaurado
async function cleanupExpiredReservations() {
  const expiredIds = await redis.keys('reservation:expired:*');
  for (const id of expiredIds) {
    await restoreStock(id);
  }
}
```

---

## 7. Ejemplo de Uso

### Crear Reserva
```bash
POST /api/reservations
{
  "customerName": "Juan Pérez",
  "items": [
    {"code": "ASP001", "quantity": 2},
    {"code": "IBU002", "quantity": 1}
  ]
}
```

Response:
```json
{
  "id": "res_abc123",
  "customerName": "Juan Pérez",
  "items": [...],
  "total": 4500,
  "status": "active",
  "createdAt": "2026-04-02T10:00:00Z",
  "expiresAt": "2026-04-02T10:30:00Z",
  "timeRemaining": 1800
}
```

### Completar Reserva
```bash
POST /api/reservations/res_abc123/complete
```

### Cancelar Reserva
```bash
POST /api/reservations/res_abc123/cancel
```

### Ver Historial
```bash
GET /api/movements?productCode=ASP001&limit=20
```
