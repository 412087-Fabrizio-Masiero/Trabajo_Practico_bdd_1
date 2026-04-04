/**
 * Comando: Eliminar producto
 */

import inquirer from 'inquirer';
import { productService } from '../services/product';
import { formatSuccess, formatError, formatInfo, formatProductDetail } from '../utils/formatters';

export async function deleteProductCommand(): Promise<void> {
  console.log('\n🗑️ ELIMINAR PRODUCTO\n');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'code',
      message: 'Código del producto a eliminar:',
      validate: (input: string) => input.trim() ? true : 'El código es requerido',
    },
  ]);

  const code = answers.code.trim();

  try {
    // Verificar que el producto existe
    const existingProduct = await productService.getProduct(code);
    
    if (!existingProduct) {
      console.log(formatInfo(`No se encontró un producto con código: ${code}`));
      return;
    }

    console.log(formatInfo('Producto encontrado:'));
    console.log(formatProductDetail(existingProduct));

    // Confirmar eliminación
    const confirm = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'sure',
        message: `¿Está seguro de eliminar el producto "${existingProduct.name}"?`,
        default: false,
      },
    ]);

    if (!confirm.sure) {
      console.log(formatInfo('Operación cancelada'));
      return;
    }

    await productService.deleteProduct(code);
    console.log(formatSuccess(`Producto "${existingProduct.name}" eliminado exitosamente`));
  } catch (error) {
    console.log(formatError(error instanceof Error ? error.message : 'Error desconocido'));
  }
}
