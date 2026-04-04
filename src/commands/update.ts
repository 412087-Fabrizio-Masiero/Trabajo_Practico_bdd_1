/**
 * Comando: Actualizar producto (stock)
 */

import inquirer from 'inquirer';
import { productService } from '../services/product';
import { formatSuccess, formatError, formatProductDetail, formatInfo } from '../utils/formatters';

export async function updateProductCommand(): Promise<void> {
  console.log('\n✏️ ACTUALIZAR PRODUCTO\n');

  const basicInfo = await inquirer.prompt([
    {
      type: 'input',
      name: 'code',
      message: 'Código del producto:',
      validate: (input: string) => input.trim() ? true : 'El código es requerido',
    },
  ]);

  const code = basicInfo.code.trim();

  try {
    // Verificar que el producto existe
    const existingProduct = await productService.getProduct(code);
    
    if (!existingProduct) {
      console.log(formatInfo(`No se encontró un producto con código: ${code}`));
      return;
    }

    console.log(formatSuccess('Producto encontrado'));
    console.log(`Stock actual: ${existingProduct.stock} unidades\n`);

    // Menú de opciones de actualización
    const updateType = await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: '¿Qué desea actualizar?',
        choices: [
          { name: 'Actualizar stock', value: 'stock' },
          { name: 'Actualizar todos los datos', value: 'full' },
          new inquirer.Separator(),
          { name: 'Volver', value: 'back' },
        ],
      },
    ]);

    if (updateType.type === 'back') {
      return;
    }

    if (updateType.type === 'stock') {
      await updateStock(code);
    } else {
      await updateFullProduct(code, existingProduct);
    }
  } catch (error) {
    console.log(formatError(error instanceof Error ? error.message : 'Error desconocido'));
  }
}

async function updateStock(code: string): Promise<void> {
  const stockUpdate = await inquirer.prompt([
    {
      type: 'list',
      name: 'operation',
      message: 'Tipo de operación:',
      choices: [
        { name: 'Agregar stock', value: 'add' },
        { name: 'Restar stock', value: 'subtract' },
        { name: 'Establecer stock', value: 'set' },
      ],
    },
    {
      type: 'number',
      name: 'quantity',
      message: 'Cantidad:',
      validate: (input: number) => input > 0 || 'La cantidad debe ser mayor a 0',
    },
  ]);

  try {
    const product = await productService.updateStock({
      code,
      quantity: stockUpdate.quantity,
      operation: stockUpdate.operation,
    });
    
    console.log(formatSuccess('Stock actualizado exitosamente'));
    console.log(`Nuevo stock: ${product.stock} unidades`);
  } catch (error) {
    console.log(formatError(error instanceof Error ? error.message : 'Error desconocido'));
  }
}

async function updateFullProduct(code: string, existing: any): Promise<void> {
  const updates = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: `Nombre (${existing.name}):`,
      default: existing.name,
    },
    {
      type: 'input',
      name: 'description',
      message: `Descripción (${existing.description || 'sin descripción'}):`,
      default: existing.description,
    },
    {
      type: 'input',
      name: 'category',
      message: `Categoría (${existing.category}):`,
      default: existing.category,
    },
    {
      type: 'input',
      name: 'price',
      message: `Precio (€) (${existing.price}):`,
      default: existing.price.toString(),
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
      message: `Stock (${existing.stock}):`,
      default: existing.stock,
    },
    {
      type: 'number',
      name: 'minStock',
      message: `Stock mínimo (${existing.minStock}):`,
      default: existing.minStock,
    },
    {
      type: 'input',
      name: 'expiryDate',
      message: `Fecha vencimiento YYYY-MM-DD (${existing.expiryDate}):`,
      default: existing.expiryDate,
      validate: (input: string) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return 'Formato inválido, use YYYY-MM-DD';
        return true;
      },
    },
    {
      type: 'input',
      name: 'batchNumber',
      message: `Número de lote (${existing.batchNumber}):`,
      default: existing.batchNumber,
    },
    {
      type: 'input',
      name: 'laboratory',
      message: `Laboratorio (${existing.laboratory}):`,
      default: existing.laboratory,
    },
  ]);

  try {
    const product = await productService.updateProduct(code, {
      name: updates.name !== existing.name ? updates.name : undefined,
      description: updates.description !== existing.description ? updates.description : undefined,
      category: updates.category !== existing.category ? updates.category : undefined,
      price: parseFloat(updates.price) !== existing.price ? parseFloat(updates.price) : undefined,
      stock: updates.stock !== existing.stock ? updates.stock : undefined,
      minStock: updates.minStock !== existing.minStock ? updates.minStock : undefined,
      expiryDate: updates.expiryDate !== existing.expiryDate ? updates.expiryDate : undefined,
      batchNumber: updates.batchNumber !== existing.batchNumber ? updates.batchNumber : undefined,
      laboratory: updates.laboratory !== existing.laboratory ? updates.laboratory : undefined,
    });
    
    console.log(formatSuccess('Producto actualizado exitosamente'));
    console.log(formatProductDetail(product));
  } catch (error) {
    console.log(formatError(error instanceof Error ? error.message : 'Error desconocido'));
  }
}
