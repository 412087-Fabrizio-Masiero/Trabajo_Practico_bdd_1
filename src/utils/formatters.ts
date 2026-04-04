/**
 * Utilidades de formateo para el CLI
 */

import { Product, Alert } from '../types';

/**
 * Formatear precio como moneda
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
}

/**
 * Formatear fecha para mostrar
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Formatear fecha corta
 */
export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Formatear producto para mostrar en tabla
 */
export function formatProductTable(products: Product[]): string {
  if (products.length === 0) {
    return 'No hay productos para mostrar.';
  }

  const headers = ['Código', 'Nombre', 'Categoría', 'Stock', 'Mín.', 'Precio', 'Vence'];
  const headerWidths = headers.map(h => Math.max(h.length, 15));
  
  // Calcular anchos basados en datos
  products.forEach(p => {
    headerWidths[0] = Math.max(headerWidths[0], p.code.length);
    headerWidths[1] = Math.max(headerWidths[1], p.name.length, 20);
    headerWidths[2] = Math.max(headerWidths[2], p.category.length);
    headerWidths[3] = Math.max(headerWidths[3], p.stock.toString().length);
    headerWidths[4] = Math.max(headerWidths[4], p.minStock.toString().length);
    headerWidths[5] = Math.max(headerWidths[5], formatPrice(p.price).length);
    headerWidths[6] = Math.max(headerWidths[6], formatDateShort(p.expiryDate).length);
  });

  // Función para crear separador
  const separator = '+' + headerWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  
  // Headers
  let result = separator + '\n';
  result += '|' + headers.map((h, i) => h.padEnd(headerWidths[i])).map(s => ' ' + s + ' ').join('|') + '|\n';
  result += separator;
  
  // Filas
  products.forEach(p => {
    result += '\n|';
    result += ' ' + p.code.padEnd(headerWidths[0]) + ' |';
    result += ' ' + p.name.substring(0, headerWidths[1]).padEnd(headerWidths[1]) + ' |';
    result += ' ' + p.category.padEnd(headerWidths[2]) + ' |';
    result += ' ' + p.stock.toString().padEnd(headerWidths[3]) + ' |';
    result += ' ' + p.minStock.toString().padEnd(headerWidths[4]) + ' |';
    result += ' ' + formatPrice(p.price).padEnd(headerWidths[5]) + ' |';
    result += ' ' + formatDateShort(p.expiryDate).padEnd(headerWidths[6]) + ' |';
  });
  
  result += '\n' + separator;
  result += `\nTotal: ${products.length} producto(s)`;
  
  return result;
}

/**
 * Formatear producto individual
 */
export function formatProductDetail(product: Product): string {
  return `
╔════════════════════════════════════════════════════════════════╗
║                    DETALLE DEL PRODUCTO                        ║
╠════════════════════════════════════════════════════════════════╣
║ Código:         ${product.code.padEnd(45)}║
║ Nombre:         ${product.name.substring(0, 45).padEnd(45)}║
╠════════════════════════════════════════════════════════════════╣
║ Descripción:    ${product.description.substring(0, 45).padEnd(45)}║
╠════════════════════════════════════════════════════════════════╣
║ Categoría:      ${product.category.padEnd(45)}║
║ Laboratorio:    ${product.laboratory.substring(0, 45).padEnd(45)}║
║ Número Lote:    ${product.batchNumber.padEnd(45)}║
╠════════════════════════════════════════════════════════════════╣
║ Precio:         ${formatPrice(product.price).padEnd(45)}║
║ Stock:          ${product.stock.toString().padEnd(45)}║
║ Stock Mínimo:   ${product.minStock.toString().padEnd(45)}║
╠════════════════════════════════════════════════════════════════╣
║ Fecha Venc.:    ${formatDate(product.expiryDate).padEnd(45)}║
╠════════════════════════════════════════════════════════════════╣
║ Creado:         ${formatDateShort(product.createdAt).padEnd(45)}║
║ Actualizado:    ${formatDateShort(product.updatedAt).padEnd(45)}║
╚════════════════════════════════════════════════════════════════╝
`;
}

/**
 * Formatear alertas
 */
export function formatAlerts(alerts: Alert[]): string {
  if (alerts.length === 0) {
    return '✅ No hay alertas pendientes.';
  }

  const critical = alerts.filter(a => a.severity === 'critical');
  const warning = alerts.filter(a => a.severity === 'warning');

  let result = '\n';
  
  if (critical.length > 0) {
    result += '🚨 ALERTAS CRÍTICAS\n';
    result += '─'.repeat(60) + '\n';
    critical.forEach((alert, i) => {
      result += `${i + 1}. [${alert.type.toUpperCase()}] ${alert.name}\n`;
      result += `   Código: ${alert.code}\n`;
      result += `   ${alert.message}\n\n`;
    });
  }

  if (warning.length > 0) {
    result += '⚠️  ALERTAS DE ATENCIÓN\n';
    result += '─'.repeat(60) + '\n';
    warning.forEach((alert, i) => {
      result += `${i + 1}. [${alert.type.toUpperCase()}] ${alert.name}\n`;
      result += `   Código: ${alert.code}\n`;
      result += `   ${alert.message}\n\n`;
    });
  }

  result += `Total: ${alerts.length} alerta(s) (${critical.length} críticas, ${warning.length} warnings)`;
  
  return result;
}

/**
 * Formatear mensaje de éxito
 */
export function formatSuccess(message: string): string {
  return `✅ ${message}`;
}

/**
 * Formatear mensaje de error
 */
export function formatError(message: string): string {
  return `❌ Error: ${message}`;
}

/**
 * Formatear mensaje informativo
 */
export function formatInfo(message: string): string {
  return `ℹ️  ${message}`;
}

/**
 * Formatear líneas separadoras
 */
export function formatSeparator(char: string = '─', length: number = 60): string {
  return char.repeat(length);
}

/**
 * Formatear título de sección
 */
export function formatSectionTitle(title: string): string {
  const width = 60;
  const padding = Math.max(0, Math.floor((width - title.length - 4) / 2));
  return `
╔${'═'.repeat(width - 2)}╗
║${' '.repeat(padding)} ${title} ${' '.repeat(width - padding - title.length - 4)}║
╚${'═'.repeat(width - 2)}╝
`;
}
