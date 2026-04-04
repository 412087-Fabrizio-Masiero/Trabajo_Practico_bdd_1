/**
 * Entry point del CLI de gestión de stock de farmacia
 */

import { connectRedis, disconnectRedis } from './redis/client';
import { displayBanner, showMainMenu, executeCommand } from './cli/menu';

async function main(): Promise<void> {
  displayBanner();
  
  console.log('Conectando a Redis...\n');
  
  try {
    // Conectar a Redis
    await connectRedis();
    
    // Bucle principal del CLI
    let running = true;
    
    while (running) {
      try {
        const command = await showMainMenu();
        await executeCommand(command);
        
        // Pausa para que el usuario pueda ver el resultado
        if (command !== 'exit') {
          await new Promise<void>((resolve) => {
            const readline = require('readline');
            const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout,
            });
            rl.question('\nPresione Enter para continuar...', () => {
              rl.close();
              resolve();
            });
          });
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('Redis')) {
          console.error('\n❌ Error de conexión con Redis:', error.message);
          console.log('Verifique que Redis esté ejecutándose e intente nuevamente.\n');
          running = false;
        } else {
          console.error('\n❌ Error:', error instanceof Error ? error.message : 'Error desconocido');
        }
      }
    }
  } catch (error) {
    console.error('\n❌ Error fatal:', error instanceof Error ? error.message : 'Error desconocido');
    console.log('\n Asegúrese de que:');
    console.log('   • Redis esté instalado y ejecutándose');
    console.log('   • La configuración de conexión sea correcta');
    console.log('   • La IP y puerto sean accesibles\n');
  } finally {
    // Desconectar de Redis antes de salir
    await disconnectRedis();
  }
}

// Manejar señales de terminación
process.on('SIGINT', async () => {
  console.log('\n\nSaliendo...');
  await disconnectRedis();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\nSaliendo...');
  await disconnectRedis();
  process.exit(0);
});

// Ejecutar
main().catch(console.error);
