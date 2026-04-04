/**
 * Comando: Crear producto
 */

import inquirer from 'inquirer';
import { productService } from '../services/product';
import { formatSuccess, formatError, formatProductDetail } from '../utils/formatters';

export async function createProductCommand(): Promise<void> {
  console.log('\n📦 CREAR NUEVO PRODUCTO\n');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'code',
      message: 'Código del producto:',
      validate: (input: string) => {
        if (!input.trim()) return 'El código es requerido';
        if (!/^[A-Za-z0-9-_]+$/.test(input)) return 'Solo letras, números, guiones y guiones bajos';
        return true;
      },
    },
    {
      type: 'input',
      name: 'name',
      message: 'Nombre del producto:',
      validate: (input: string) => input.trim() ? true : 'El nombre es requerido',
    },
    {
      type: 'input',
      name: 'description',
      message: 'Descripción (opcional):',
      default: '',
    },
    {
      type: 'input',
      name: 'category',
      message: 'Categoría:',
      validate: (input: string) => input.trim() ? true : 'La categoría es requerida',
    },
    {
      type: 'input',
      name: 'price',
      message: 'Precio (€):',
      validate: (input: string) => {
        const num = parseFloat(input);
        if (isNaN(num) || num <= 0) return 'Ingrese un precio válido';
        return true;
      },
      filter: (input: string) => parseFloat(input),
    },
    {
      type: 'number',
      name: 'stock',
      message: 'Stock inicial:',
      default: 0,
      validate: (input: number) => input >= 0 || 'El stock no puede ser negativo',
    },
    {
      type: 'number',
      name: 'minStock',
      message: 'Stock mínimo de alerta:',
      default: 10,
      validate: (input: number) => input >= 0 || 'El stock mínimo no puede ser negativo',
    },
    {
      type: 'input',
      name: 'expiryDate',
      message: 'Fecha de vencimiento (YYYY-MM-DD):',
      validate: (input: string) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return 'Formato inválido, use YYYY-MM-DD';
        const date = new Date(input);
        if (isNaN(date.getTime())) return 'Fecha inválida';
        return true;
      },
    },
    {
      type: 'input',
      name: 'batchNumber',
      message: 'Número de lote:',
      validate: (input: string) => input.trim() ? true : 'El número de lote es requerido',
    },
    {
      type: 'input',
      name: 'laboratory',
      message: 'Laboratorio:',
      validate: (input: string) => input.trim() ? true : 'El laboratorio es requerido',
    },
  ]);

  try {
    const product = await productService.createProduct(answers);
    console.log(formatSuccess(`Producto creado exitosamente`));
    console.log(formatProductDetail(product));
  } catch (error) {
    console.log(formatError(error instanceof Error ? error.message : 'Error desconocido'));
  }
}
