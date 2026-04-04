/**
 * Comando: Alertas de vencimiento
 */

import inquirer from 'inquirer';
import { productService } from '../services/product';
import { formatAlerts, formatSectionTitle, formatError, formatInfo } from '../utils/formatters';

export async function alertsExpiryCommand(): Promise<void> {
  console.log(formatSectionTitle('ALERTAS DE VENCIMIENTO'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: '¿Qué tipo de alertas desea ver?',
      choices: [
        { name: 'Productos próximos a vencer (próximos 30 días)', value: 30 },
        { name: 'Productos próximos a vencer (próximos 7 días)', value: 7 },
        { name: 'Solo productos ya vencidos', value: 0 },
        { name: 'Todos (próximos + vencidos)', value: 365 },
      ],
    },
  ]);

  try {
    let alerts;
    
    if (answers.type === 0) {
      // Solo vencidos - obtenemos todos los códigos vencidos manualmente
      console.log(formatInfo('Buscando productos vencidos...'));
      alerts = await productService.getExpiryAlerts(0);
    } else {
      console.log(formatInfo(`Buscando productos que vencen en los próximos ${answers.type} días...`));
      alerts = await productService.getExpiryAlerts(answers.type);
    }
    
    console.log(formatAlerts(alerts));
  } catch (error) {
    console.log(formatError(error instanceof Error ? error.message : 'Error desconocido'));
  }
}
