/**
 * Comando: Alertas de stock bajo
 */

import { productService } from '../services/product';
import { formatAlerts, formatSectionTitle, formatError } from '../utils/formatters';

export async function alertsStockCommand(): Promise<void> {
  console.log(formatSectionTitle('ALERTAS DE STOCK BAJO'));

  try {
    const alerts = await productService.getLowStockAlerts();
    console.log(formatAlerts(alerts));
  } catch (error) {
    console.log(formatError(error instanceof Error ? error.message : 'Error desconocido'));
  }
}
