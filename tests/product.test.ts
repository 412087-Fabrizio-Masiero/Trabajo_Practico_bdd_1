/**
 * Tests para esquemas Zod
 */

import {
  productInputSchema,
  productUpdateSchema,
  stockUpdateSchema,
  codeSchema,
} from '../src/models/product';

describe('productInputSchema', () => {
  const validProduct = {
    code: 'MED-001',
    name: 'Paracetamol 500mg',
    description: 'Analgésico y antipirético',
    category: 'Analgésicos',
    price: 5.99,
    stock: 100,
    minStock: 20,
    expiryDate: '2025-12-31',
    batchNumber: 'LOTE-2024-001',
    laboratory: 'Lab. Farmacéutico S.A.',
  };

  it('should validate a correct product', () => {
    const result = productInputSchema.safeParse(validProduct);
    expect(result.success).toBe(true);
  });

  it('should reject empty code', () => {
    const result = productInputSchema.safeParse({ ...validProduct, code: '' });
    expect(result.success).toBe(false);
  });

  it('should reject code with special characters', () => {
    const result = productInputSchema.safeParse({ ...validProduct, code: 'MED@001' });
    expect(result.success).toBe(false);
  });

  it('should reject negative price', () => {
    const result = productInputSchema.safeParse({ ...validProduct, price: -5.99 });
    expect(result.success).toBe(false);
  });

  it('should reject negative stock', () => {
    const result = productInputSchema.safeParse({ ...validProduct, stock: -10 });
    expect(result.success).toBe(false);
  });

  it('should reject invalid date format', () => {
    const result = productInputSchema.safeParse({ ...validProduct, expiryDate: '31-12-2025' });
    expect(result.success).toBe(false);
  });

  it('should accept valid date format', () => {
    const result = productInputSchema.safeParse({ ...validProduct, expiryDate: '2025-12-31' });
    expect(result.success).toBe(true);
  });

  it('should set default description to empty string', () => {
    const { description, ...productWithoutDesc } = validProduct;
    const result = productInputSchema.safeParse(productWithoutDesc);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('');
    }
  });

  it('should reject price with more than 2 decimals', () => {
    const result = productInputSchema.safeParse({ ...validProduct, price: 5.999 });
    expect(result.success).toBe(false);
  });
});

describe('productUpdateSchema', () => {
  it('should validate partial updates', () => {
    const result = productUpdateSchema.safeParse({ name: 'Nuevo Nombre' });
    expect(result.success).toBe(true);
  });

  it('should validate empty update', () => {
    const result = productUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should reject invalid price in update', () => {
    const result = productUpdateSchema.safeParse({ price: -10 });
    expect(result.success).toBe(false);
  });

  it('should accept valid price update', () => {
    const result = productUpdateSchema.safeParse({ price: 15.50 });
    expect(result.success).toBe(true);
  });
});

describe('stockUpdateSchema', () => {
  it('should validate add operation', () => {
    const result = stockUpdateSchema.safeParse({
      code: 'MED-001',
      quantity: 50,
      operation: 'add',
    });
    expect(result.success).toBe(true);
  });

  it('should validate subtract operation', () => {
    const result = stockUpdateSchema.safeParse({
      code: 'MED-001',
      quantity: 10,
      operation: 'subtract',
    });
    expect(result.success).toBe(true);
  });

  it('should validate set operation', () => {
    const result = stockUpdateSchema.safeParse({
      code: 'MED-001',
      quantity: 100,
      operation: 'set',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid operation', () => {
    const result = stockUpdateSchema.safeParse({
      code: 'MED-001',
      quantity: 10,
      operation: 'multiply',
    });
    expect(result.success).toBe(false);
  });

  it('should reject zero quantity', () => {
    const result = stockUpdateSchema.safeParse({
      code: 'MED-001',
      quantity: 0,
      operation: 'add',
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative quantity', () => {
    const result = stockUpdateSchema.safeParse({
      code: 'MED-001',
      quantity: -5,
      operation: 'add',
    });
    expect(result.success).toBe(false);
  });
});

describe('codeSchema', () => {
  it('should validate a simple code', () => {
    const result = codeSchema.safeParse('MED-001');
    expect(result.success).toBe(true);
  });

  it('should validate a code with underscore', () => {
    const result = codeSchema.safeParse('MED_001');
    expect(result.success).toBe(true);
  });

  it('should reject empty code', () => {
    const result = codeSchema.safeParse('');
    expect(result.success).toBe(false);
  });
});
