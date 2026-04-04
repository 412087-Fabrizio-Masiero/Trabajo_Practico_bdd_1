/**
 * Menú principal del CLI
 */

import inquirer from 'inquirer';
import { CLICommand } from '../types';
import { createProductCommand } from '../commands/create';
import { readProductCommand } from '../commands/read';
import { listProductsCommand } from '../commands/list';
import { updateProductCommand } from '../commands/update';
import { deleteProductCommand } from '../commands/delete';
import { alertsStockCommand } from '../commands/alerts-stock';
import { alertsExpiryCommand } from '../commands/alerts-expiry';

interface MenuChoice {
  name: string;
  value: CLICommand;
  description?: string;
}

const menuOptions: MenuChoice[] = [
  { name: '📦 Crear producto', value: 'create', description: 'Registrar un nuevo producto en el sistema' },
  { name: '🔍 Consultar producto', value: 'read', description: 'Buscar y ver detalles de un producto' },
  { name: '📋 Listar productos', value: 'list', description: 'Ver todos los productos o filtrar por categoría' },
  { name: '✏️ Actualizar producto', value: 'update', description: 'Modificar datos de un producto' },
  { name: '🗑️ Eliminar producto', value: 'delete', description: 'Eliminar un producto del sistema' },
  { name: '⚠️ Alertas de stock bajo', value: 'alerts-stock', description: 'Ver productos con stock bajo' },
  { name: '⏰ Alertas de vencimiento', value: 'alerts-expiry', description: 'Ver productos próximos a vencer' },
];

export async function showMainMenu(): Promise<CLICommand> {
  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'command',
      message: '¿Qué desea hacer?',
      choices: [
        ...menuOptions,
        new inquirer.Separator(),
        { name: '🚪 Salir', value: 'exit' },
      ],
      pageSize: 12,
    },
  ]);

  return answer.command;
}

export async function executeCommand(command: CLICommand): Promise<void> {
  switch (command) {
    case 'create':
      await createProductCommand();
      break;
    case 'read':
      await readProductCommand();
      break;
    case 'list':
      await listProductsCommand();
      break;
    case 'update':
      await updateProductCommand();
      break;
    case 'delete':
      await deleteProductCommand();
      break;
    case 'alerts-stock':
      await alertsStockCommand();
      break;
    case 'alerts-expiry':
      await alertsExpiryCommand();
      break;
    case 'exit':
      console.log('\n¡Gracias por usar el sistema de gestión de stock de farmacia!\n');
      process.exit(0);
    default:
      console.log('Comando no reconocido');
  }
}

export function displayBanner(): void {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🏥  SISTEMA DE GESTIÓN DE STOCK DE FARMACIA  🏥            ║
║                                                               ║
║   CLI Interactivo para gestión de inventario farmacéutico     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
}

export function displayHelp(): void {
  console.log(`
AYUDA - Comandos disponibles:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  create       📦  Crear un nuevo producto
  read         🔍  Consultar detalles de un producto
  list         📋  Listar productos (todos o por categoría)
  update       ✏️  Actualizar datos o stock de un producto
  delete       🗑️  Eliminar un producto
  alerts-stock ⚠️  Ver alertas de stock bajo
  alerts-expiry ⏰  Ver alertas de vencimiento
  exit         🚪  Salir del programa

COMO USAR:
━━━━━━━━━━━
  1. Seleccione una opción del menú
  2. Siga las instrucciones en pantalla
  3. Los datos se guardan automáticamente en Redis

NOTAS:
━━━━━━
  • El código del producto debe ser único
  • Las fechas deben estar en formato YYYY-MM-DD
  • El stock mínimo define cuándo generar alertas de stock bajo
  • Las alertas de vencimiento se calculan automáticamente

`);
}
