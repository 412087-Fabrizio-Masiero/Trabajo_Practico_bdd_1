/**
 * Tests para tipos del sistema
 */

import { Product, ProductInput, ProductUpdate, Alert, StockUpdate } from '../src/types';

describe('Product Types', () => {
  it('should allow valid product object', () => {
    const product: Product = {
      code: 'MED-001',
      name: 'Test Product',
      description: 'Test Description',
      category: 'Test Category',
      price: 10.99,
      stock: 50,
      minStock: 10,
      expiryDate: '2025-12-31',
      batchNumber: 'LOTE-001',
      laboratory: 'Test Lab',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    expect(product.code).toBe('MED-001');
    expect(product.stock).toBe(50);
    expect(product.price).toBe(10.99);
  });

  it('should allow product input object', () => {
    const input: ProductInput = {
      code: 'MED-002',
      name: 'Another Product',
      description: 'Description',
      category: 'Category',
      price: 20.50,
      stock: 100,
      minStock: 25,
      expiryDate: '2026-06-30',
      batchNumber: 'LOTE-002',
      laboratory: 'Another Lab',
    };

    expect(input.code).toBe('MED-002');
    expect(input.price).toBe(20.50);
  });

  it('should allow partial product update', () => {
    const update: ProductUpdate = {
      name: 'Updated Name',
      stock: 75,
    };

    expect(update.name).toBe('Updated Name');
    expect(update.stock).toBe(75);
    expect(update.category).toBeUndefined();
  });
});

describe('Alert Types', () => {
  it('should create low stock alert', () => {
    const alert: Alert = {
      code: 'MED-001',
      name: 'Product',
      message: 'Stock bajo',
      type: 'low_stock',
      severity: 'warning',
    };

    expect(alert.type).toBe('low_stock');
    expect(alert.severity).toBe('warning');
  });

  it('should create expiring soon alert', () => {
    const alert: Alert = {
      code: 'MED-002',
      name: 'Product 2',
      message: 'Próximo a vencer',
      type: 'expiring_soon',
      severity: 'critical',
    };

    expect(alert.type).toBe('expiring_soon');
    expect(alert.severity).toBe('critical');
  });

  it('should create expired alert', () => {
    const alert: Alert = {
      code: 'MED-003',
      name: 'Expired Product',
      message: 'Producto vencido',
      type: 'expired',
      severity: 'critical',
    };

    expect(alert.type).toBe('expired');
    expect(alert.severity).toBe('critical');
  });
});

describe('StockUpdate Types', () => {
  it('should create add stock update', () => {
    const update: StockUpdate = {
      code: 'MED-001',
      quantity: 50,
      operation: 'add',
    };

    expect(update.operation).toBe('add');
    expect(update.quantity).toBe(50);
  });

  it('should create subtract stock update', () => {
    const update: StockUpdate = {
      code: 'MED-001',
      quantity: 10,
      operation: 'subtract',
    };

    expect(update.operation).toBe('subtract');
  });

  it('should create set stock update', () => {
    const update: StockUpdate = {
      code: 'MED-001',
      quantity: 100,
      operation: 'set',
    };

    expect(update.operation).toBe('set');
  });
});
