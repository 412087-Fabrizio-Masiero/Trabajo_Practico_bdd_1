#!/bin/bash
# Script para iniciar el servidor web desde WSL

cd /home/vicen/Farmality/proyecto-stock/web

# Configurar variable de entorno
export REDIS_HOST=127.0.0.1

echo "🏥 Farmality Web Server"
echo "📡 Puerto: http://localhost:3001"
echo "🔗 API: http://localhost:3001/api"
echo ""

# Instalar dependencias si es necesario
if [ ! -d "node_modules" ]; then
  echo "Instalando dependencias..."
  npm install
fi

# Iniciar servidor
node server.js
