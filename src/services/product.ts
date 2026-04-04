/**
 * Servicios para la gestión de productos de farmacia
 */

import {
  Product,
  ProductInput,
  ProductUpdate,
  StockUpdate,
  Alert,
} from '../types';
import {
  saveProductToRedis,
  getProductFromRedis,
  deleteProductFromRedis,
  getAllProductCodes,
  getProductsByCategory,
  getCategories,
  getExpiringProducts,
  getExpiredProducts,
  getRedisClient,
} from '../redis/client';
import {
  productInputSchema,
  productUpdateSchema,
  stockUpdateSchema,
  codeSchema,
} from '../models/product';

export class ProductService {
  /**
   * Crear un nuevo producto
   */
  async createProduct(input: unknown): Promise<Product> {
    const validated = productInputSchema.parse(input);
    
    // Verificar si el producto ya existe
    const existing = await getProductFromRedis(validated.code);
    if (existing) {
      throw new Error(`Ya existe un producto con el código: ${validated.code}`);
    }
    
    const now = new Date().toISOString();
    const product: Product = {
      ...validated,
      createdAt: now,
      updatedAt: now,
    };
    
    await saveProductToRedis(product);
    return product;
  }

  /**
   * Obtener un producto por código
   */
  async getProduct(code: unknown): Promise<Product | null> {
    const validatedCode = codeSchema.parse(code);
    return getProductFromRedis(validatedCode);
  }

  /**
   * Listar todos los productos
   */
  async listAllProducts(): Promise<Product[]> {
    const codes = await getAllProductCodes();
    const products: Product[] = [];
    
    for (const code of codes) {
      const product = await getProductFromRedis(code);
      if (product) {
        products.push(product);
      }
    }
    
    return products;
  }

  /**
   * Listar productos por categoría
   */
  async listProductsByCategory(category: unknown): Promise<Product[]> {
    const validatedCategory = codeSchema.parse(category);
    const codes = await getProductsByCategory(validatedCategory);
    const products: Product[] = [];
    
    for (const code of codes) {
      const product = await getProductFromRedis(code);
      if (product) {
        products.push(product);
      }
    }
    
    return products;
  }

  /**
   * Listar todas las categorías
   */
  async listCategories(): Promise<string[]> {
    return getCategories();
  }

  /**
   * Actualizar un producto
   */
  async updateProduct(code: unknown, update: unknown): Promise<Product> {
    const validatedCode = codeSchema.parse(code);
    const validatedUpdate = productUpdateSchema.parse(update);
    
    const existing = await getProductFromRedis(validatedCode);
    if (!existing) {
      throw new Error(`No existe un producto con el código: ${validatedCode}`);
    }
    
    const updatedProduct: Product = {
      ...existing,
      ...validatedUpdate,
      code: validatedCode, // Mantener el código original
      updatedAt: new Date().toISOString(),
    };
    
    // Si cambió la categoría, actualizar índices
    if (validatedUpdate.category && validatedUpdate.category !== existing.category) {
      const redis = getRedisClient();
      await redis.srem(`products:by_category:${existing.category.toLowerCase()}`, validatedCode);
      await redis.sadd(`products:by_category:${validatedUpdate.category.toLowerCase()}`, validatedCode);
    }
    
    await saveProductToRedis(updatedProduct);
    return updatedProduct;
  }

  /**
   * Actualizar stock de un producto
   */
  async updateStock(update: unknown): Promise<Product> {
    const validatedUpdate = stockUpdateSchema.parse(update);
    
    const existing = await getProductFromRedis(validatedUpdate.code);
    if (!existing) {
      throw new Error(`No existe un producto con el código: ${validatedUpdate.code}`);
    }
    
    let newStock: number;
    
    switch (validatedUpdate.operation) {
      case 'add':
        newStock = existing.stock + validatedUpdate.quantity;
        break;
      case 'subtract':
        newStock = existing.stock - validatedUpdate.quantity;
        if (newStock < 0) {
          throw new Error(`Stock insuficiente. Stock actual: ${existing.stock}`);
        }
        break;
      case 'set':
        newStock = validatedUpdate.quantity;
        break;
    }
    
    const updatedProduct: Product = {
      ...existing,
      stock: newStock,
      updatedAt: new Date().toISOString(),
    };
    
    await saveProductToRedis(updatedProduct);
    return updatedProduct;
  }

  /**
   * Eliminar un producto
   */
  async deleteProduct(code: unknown): Promise<void> {
    const validatedCode = codeSchema.parse(code);
    
    const existing = await getProductFromRedis(validatedCode);
    if (!existing) {
      throw new Error(`No existe un producto con el código: ${validatedCode}`);
    }
    
    await deleteProductFromRedis(validatedCode, existing.category);
  }

  /**
   * Obtener alertas de stock bajo
   */
  async getLowStockAlerts(): Promise<Alert[]> {
    const products = await this.listAllProducts();
    const alerts: Alert[] = [];
    
    for (const product of products) {
      if (product.stock <= product.minStock) {
        const severity = product.stock === 0 ? 'critical' : 'warning';
        alerts.push({
          code: product.code,
          name: product.name,
          message: `Stock bajo: ${product.stock} unidades (mínimo: ${product.minStock})`,
          type: 'low_stock',
          severity,
        });
      }
    }
    
    return alerts;
  }

  /**
   * Obtener alertas de vencimiento
   */
  async getExpiryAlerts(daysAhead: number = 30): Promise<Alert[]> {
    const expiringCodes = await getExpiringProducts(daysAhead);
    const expiredCodes = await getExpiredProducts();
    const alerts: Alert[] = [];
    
    // Procesar productos próximos a vencer
    for (const code of expiringCodes) {
      const product = await getProductFromRedis(code);
      if (product) {
        const daysUntilExpiry = this.calculateDaysUntilExpiry(product.expiryDate);
        const severity = daysUntilExpiry <= 7 ? 'critical' : 'warning';
        
        alerts.push({
          code: product.code,
          name: product.name,
          message: `Próximo a vencer en ${daysUntilExpiry} días (${product.expiryDate})`,
          type: 'expiring_soon',
          severity,
        });
      }
    }
    
    // Procesar productos ya vencidos
    for (const code of expiredCodes) {
      const product = await getProductFromRedis(code);
      if (product) {
        alerts.push({
          code: product.code,
          name: product.name,
          message: `VENCIDO desde ${product.expiryDate}`,
          type: 'expired',
          severity: 'critical',
        });
      }
    }
    
    return alerts;
  }

  /**
   * Calcular días hasta el vencimiento
   */
  private calculateDaysUntilExpiry(expiryDate: string): number {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

// Exportar instancia singleton
export const productService = new ProductService();
