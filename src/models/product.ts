/**
 * Esquemas Zod para validación de datos de productos
 */

import { z } from 'zod';

export const productInputSchema = z.object({
  code: z
    .string()
    .min(1, 'El código es requerido')
    .max(50, 'El código no puede exceder 50 caracteres')
    .regex(/^[A-Za-z0-9-_]+$/, 'El código solo puede contener letras, números, guiones y guiones bajos'),
  
  name: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(200, 'El nombre no puede exceder 200 caracteres'),
  
  description: z
    .string()
    .max(1000, 'La descripción no puede exceder 1000 caracteres')
    .default(''),
  
  category: z
    .string()
    .min(1, 'La categoría es requerida')
    .max(100, 'La categoría no puede exceder 100 caracteres'),
  
  price: z
    .number()
    .positive('El precio debe ser un número positivo')
    .multipleOf(0.01, 'El precio debe tener máximo 2 decimales'),
  
  stock: z
    .number()
    .int('El stock debe ser un número entero')
    .min(0, 'El stock no puede ser negativo'),
  
  minStock: z
    .number()
    .int('El stock mínimo debe ser un número entero')
    .min(0, 'El stock mínimo no puede ser negativo'),
  
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe estar en formato YYYY-MM-DD')
    .refine((date) => !isNaN(Date.parse(date)), 'La fecha no es válida'),
  
  batchNumber: z
    .string()
    .min(1, 'El número de lote es requerido')
    .max(50, 'El número de lote no puede exceder 50 caracteres'),
  
  laboratory: z
    .string()
    .min(1, 'El laboratorio es requerido')
    .max(200, 'El laboratorio no puede exceder 200 caracteres'),
});

export const productUpdateSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre no puede estar vacío')
    .max(200, 'El nombre no puede exceder 200 caracteres')
    .optional(),
  
  description: z
    .string()
    .max(1000, 'La descripción no puede exceder 1000 caracteres')
    .optional(),
  
  category: z
    .string()
    .min(1, 'La categoría no puede estar vacía')
    .max(100, 'La categoría no puede exceder 100 caracteres')
    .optional(),
  
  price: z
    .number()
    .positive('El precio debe ser un número positivo')
    .multipleOf(0.01, 'El precio debe tener máximo 2 decimales')
    .optional(),
  
  stock: z
    .number()
    .int('El stock debe ser un número entero')
    .min(0, 'El stock no puede ser negativo')
    .optional(),
  
  minStock: z
    .number()
    .int('El stock mínimo debe ser un número entero')
    .min(0, 'El stock mínimo no puede ser negativo')
    .optional(),
  
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe estar en formato YYYY-MM-DD')
    .refine((date) => !isNaN(Date.parse(date)), 'La fecha no es válida')
    .optional(),
  
  batchNumber: z
    .string()
    .min(1, 'El número de lote no puede estar vacío')
    .max(50, 'El número de lote no puede exceder 50 caracteres')
    .optional(),
  
  laboratory: z
    .string()
    .min(1, 'El laboratorio no puede estar vacío')
    .max(200, 'El laboratorio no puede exceder 200 caracteres')
    .optional(),
});

export const stockUpdateSchema = z.object({
  code: z
    .string()
    .min(1, 'El código es requerido'),
  
  quantity: z
    .number()
    .int('La cantidad debe ser un número entero')
    .positive('La cantidad debe ser mayor a 0'),
  
  operation: z
    .enum(['add', 'subtract', 'set'], {
      errorMap: () => ({ message: 'La operación debe ser: add, subtract o set' }),
    }),
});

export const codeSchema = z
  .string()
  .min(1, 'El código es requerido')
  .max(50, 'El código no puede exceder 50 caracteres');

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductUpdate = z.infer<typeof productUpdateSchema>;
export type StockUpdate = z.infer<typeof stockUpdateSchema>;
