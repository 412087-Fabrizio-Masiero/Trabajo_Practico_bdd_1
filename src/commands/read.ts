/**
 * Comando: Consultar producto
 */

import inquirer from 'inquirer';
import { productService } from '../services/product';
import { formatSuccess, formatError, formatProductDetail, formatInfo } from '../utils/formatters';

export async function readProductCommand(): Promise<void> {
  console.log('\n🔍 CONSULTAR PRODUCTO\n');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'code',
      message: 'Código del producto:',
      validate: (input: string) => input.trim() ? true : 'El código es requerido',
    },
  ]);

  try {
    const product = await productService.getProduct(answers.code.trim());
    
    if (product) {
      console.log(formatSuccess('Producto encontrado'));
      console.log(formatProductDetail(product));
    } else {
      console.log(formatInfo(`No se encontró un producto con código: ${answers.code}`));
    }
  } catch (error) {
    console.log(formatError(error instanceof Error ? error.message : 'Error desconocido'));
  }
}
