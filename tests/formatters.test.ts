/**
 * Tests para utilidades de formateo
 */

import {
  formatPrice,
  formatDate,
  formatDateShort,
  formatSeparator,
  formatSectionTitle,
  formatSuccess,
  formatError,
  formatInfo,
} from '../src/utils/formatters';
import { Product, Alert } from '../src/types';

describe('formatPrice', () => {
  it('should format price in EUR', () => {
    const result = formatPrice(10.50);
    expect(result).toContain('10,50');
  });

  it('should format whole numbers', () => {
    const result = formatPrice(100);
    expect(result).toContain('100');
  });

  it('should format decimal prices correctly', () => {
    const result = formatPrice(5.99);
    expect(result).toContain('5,99');
  });
});

describe('formatDate', () => {
  it('should format date in Spanish', () => {
    const result = formatDate('2025-12-31');
    expect(result).toContain('diciembre');
    expect(result).toContain('2025');
  });

  it('should format January correctly', () => {
    const result = formatDate('2025-01-15');
    expect(result).toContain('enero');
  });
});

describe('formatDateShort', () => {
  it('should format date in short format', () => {
    const result = formatDateShort('2025-12-31');
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

describe('formatSeparator', () => {
  it('should create separator of default length', () => {
    const result = formatSeparator();
    expect(result.length).toBe(60);
  });

  it('should create separator of custom length', () => {
    const result = formatSeparator('─', 20);
    expect(result.length).toBe(20);
  });

  it('should create separator with custom character', () => {
    const result = formatSeparator('=', 10);
    expect(result).toBe('==========');
  });
});

describe('formatSectionTitle', () => {
  it('should create a formatted section title', () => {
    const result = formatSectionTitle('Test Title');
    expect(result).toContain('╔');
    expect(result).toContain('╗');
    expect(result).toContain('Test Title');
  });
});

describe('formatSuccess', () => {
  it('should format success message with checkmark', () => {
    const result = formatSuccess('Operation completed');
    expect(result).toContain('✅');
    expect(result).toContain('Operation completed');
  });
});

describe('formatError', () => {
  it('should format error message', () => {
    const result = formatError('Something went wrong');
    expect(result).toContain('❌');
    expect(result).toContain('Error:');
    expect(result).toContain('Something went wrong');
  });
});

describe('formatInfo', () => {
  it('should format info message', () => {
    const result = formatInfo('Here is some information');
    expect(result).toContain('ℹ️');
    expect(result).toContain('Here is some information');
  });
});

describe('formatProductTable', () => {
  // Importar dinámicamente para evitar problemas de tipado
  const formatters = require('../src/utils/formatters');

  it('should return message when no products', () => {
    const result = formatters.formatProductTable([]);
    expect(result).toContain('No hay productos para mostrar');
  });

  it('should format products in table', () => {
    const mockProduct: Product = {
      code: 'MED-001',
      name: 'Paracetamol',
      description: 'Analgésico',
      category: 'Analgésicos',
      price: 5.99,
      stock: 100,
      minStock: 20,
      expiryDate: '2025-12-31',
      batchNumber: 'LOTE-001',
      laboratory: 'Lab Test',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const result = formatters.formatProductTable([mockProduct]);
    expect(result).toContain('MED-001');
    expect(result).toContain('Paracetamol');
    expect(result).toContain('Total: 1 producto');
  });
});

describe('formatAlerts', () => {
  const formatters = require('../src/utils/formatters');

  it('should return success message when no alerts', () => {
    const result = formatters.formatAlerts([]);
    expect(result).toContain('No hay alertas pendientes');
  });

  it('should format critical alerts', () => {
    const mockAlert: Alert = {
      code: 'MED-001',
      name: 'Paracetamol',
      message: 'Stock agotado',
      type: 'low_stock',
      severity: 'critical',
    };

    const result = formatters.formatAlerts([mockAlert]);
    expect(result).toContain('ALERTAS CRÍTICAS');
    expect(result).toContain('MED-001');
    expect(result).toContain('Paracetamol');
  });

  it('should separate critical and warning alerts', () => {
    const alerts: Alert[] = [
      {
        code: 'MED-001',
        name: 'Product 1',
        message: 'Critical issue',
        type: 'low_stock',
        severity: 'critical',
      },
      {
        code: 'MED-002',
        name: 'Product 2',
        message: 'Warning issue',
        type: 'expiring_soon',
        severity: 'warning',
      },
    ];

    const result = formatters.formatAlerts(alerts);
    expect(result).toContain('ALERTAS CRÍTICAS');
    expect(result).toContain('ALERTAS DE ATENCIÓN');
    expect(result).toContain('Total: 2 alerta(s)');
  });
});

describe('formatProductDetail', () => {
  const formatters = require('../src/utils/formatters');

  it('should format product with all fields', () => {
    const mockProduct: Product = {
      code: 'MED-001',
      name: 'Paracetamol 500mg',
      description: 'Analgésico y antipirético',
      category: 'Analgésicos',
      price: 5.99,
      stock: 100,
      minStock: 20,
      expiryDate: '2025-12-31',
      batchNumber: 'LOTE-001',
      laboratory: 'Lab. Farmacéutico S.A.',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const result = formatters.formatProductDetail(mockProduct);
    expect(result).toContain('MED-001');
    expect(result).toContain('Paracetamol 500mg');
    expect(result).toContain('Analgésicos');
    expect(result).toContain('Lab.');
  });
});
