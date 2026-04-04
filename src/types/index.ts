/**
 * Tipos para el sistema de gestión de stock de farmacia
 */

export interface Product {
  code: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  minStock: number;
  expiryDate: string; // ISO date string
  batchNumber: string;
  laboratory: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  code: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  minStock: number;
  expiryDate: string;
  batchNumber: string;
  laboratory: string;
}

export interface ProductUpdate {
  name?: string;
  description?: string;
  category?: string;
  price?: number;
  stock?: number;
  minStock?: number;
  expiryDate?: string;
  batchNumber?: string;
  laboratory?: string;
}

export interface StockUpdate {
  code: string;
  quantity: number;
  operation: 'add' | 'subtract' | 'set';
}

export interface Alert {
  code: string;
  name: string;
  message: string;
  type: 'low_stock' | 'expiring_soon' | 'expired';
  severity: 'warning' | 'critical';
}

export interface Category {
  name: string;
  description: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export type CLICommand =
  | 'create'
  | 'read'
  | 'list'
  | 'update'
  | 'delete'
  | 'alerts-stock'
  | 'alerts-expiry'
  | 'exit';
