# Farmality - Sistema de Gestión de Stock de Farmacia

Sistema completo de gestión de inventario farmacéutico con interfaz web y CLI.

## Características

- ✅ CRUD completo de productos
- ✅ Interfaz web SPA (Express.js + Socket.io)
- ✅ Circuito de ventas con carrito y tickets
- ✅ Sistema de reservas con TTL automático (30 min)
- ✅ Historial de movimientos
- ✅ Reportes (stock bajo, inventario, por vencer, ventas)
- ✅ Alertas en tiempo real (WebSockets)
- ✅ Dark Mode
- ✅ Persistencia en Redis

## Estructura del Proyecto

```
proyecto-stock/
├── web/                  # Interfaz web
│   ├── public/          # Frontend (HTML, CSS, JS)
│   ├── routes/          # API endpoints
│   ├── server.js       # Servidor principal
│   └── package.json    # Dependencias
├── src/                 # CLI (TypeScript)
├── data/                # Datos de ejemplo
│   └── dump.rdb        # Base de datos con productos demo
└── README.md
```

## Requisitos

- Node.js 18+
- Redis
- npm

## Instalación

```bash
# Entrar a la carpeta web
cd proyecto-stock/web

# Instalar dependencias
npm install
```

## Configuración de Redis

El sistema se conecta a Redis por defecto en `localhost:6379`.

### Iniciar Redis (Windows/WSL)

```bash
wsl -e redis-server
```

### Verificar conexión

```bash
wsl -e redis-cli ping
# Debería responder: PONG
```

## Datos de Ejemplo

El proyecto incluye una base de datos de ejemplo con **216 productos** en la carpeta `data/dump.rdb`.

### Para usar los datos de ejemplo:

1. **Detener Redis si está corriendo**
2. **Copiar el dump.rdb a la carpeta de datos de Redis:**
   ```bash
   # En WSL
   sudo cp /ruta/al/proyecto/proyecto-stock/data/dump.rdb /var/lib/redis/dump.rdb
   sudo chown redis:redis /var/lib/redis/dump.rdb
   ```
3. **Iniciar Redis**
4. **Verificar que los datos estén cargados:**
   ```bash
   redis-cli KEYS "product:*" | wc -l
   # Debería mostrar: 216
   ```

## Ejecución

### Iniciar el servidor web

```bash
cd proyecto-stock/web
node server.js
```

### Acceder a la aplicación

- **Web UI**: http://localhost:3005
- **API**: http://localhost:3005/api

## Funcionalidades

### Pestañas disponibles:

| Pestaña | Descripción |
|---------|-------------|
| **Dashboard** | Estadísticas, categorías, alertas |
| **Productos** | CRUD de productos con filtros |
| **Ventas** | Carrito de compras, descuento %, ticket |
| **Reservas** | Reservas con timer de 30 min |
| **Historial** | Movimientos de stock |
| **Reportes** | Stock bajo, valor inventario, por vencer, ventas |
| **Alertas** | Stock bajo y vencimiento |

## Tecnologías

- **Backend**: Express.js, Socket.io, ioredis
- **Frontend**: Vanilla JS, CSS Variables
- **Base de datos**: Redis (localhost:6379)

## Licencia

ISC