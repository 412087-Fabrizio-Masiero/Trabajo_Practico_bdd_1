/**
 * Comando: Listar productos
 */

import inquirer from 'inquirer';
import { productService } from '../services/product';
import { formatSuccess, formatError, formatProductTable, formatInfo, formatSectionTitle } from '../utils/formatters';

export async function listProductsCommand(): Promise<void> {
  console.log(formatSectionTitle('LISTAR PRODUCTOS'));

  // Preguntar si quiere filtrar por categoría
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'filterType',
      message: '¿Cómo desea listar los productos?',
      choices: [
        { name: 'Todos los productos', value: 'all' },
        { name: 'Por categoría', value: 'category' },
        new inquirer.Separator(),
        { name: 'Volver al menú principal', value: 'back' },
      ],
    },
  ]);

  if (answers.filterType === 'back') {
    return;
  }

  try {
    let products;

    if (answers.filterType === 'all') {
      console.log('\n📋 Listando todos los productos...\n');
      products = await productService.listAllProducts();
    } else {
      // Obtener categorías disponibles
      const categories = await productService.listCategories();
      
      if (categories.length === 0) {
        console.log(formatInfo('No hay categorías registradas'));
        return;
      }

      const categoryAnswer = await inquirer.prompt([
        {
          type: 'list',
          name: 'category',
          message: 'Seleccione una categoría:',
          choices: [...categories, new inquirer.Separator(), { name: 'Cancelar', value: 'cancel' }],
        },
      ]);

      if (categoryAnswer.category === 'cancel') {
        return;
      }

      console.log(`\n📋 Listando productos de la categoría: ${categoryAnswer.category}\n`);
      products = await productService.listProductsByCategory(categoryAnswer.category);
    }

    console.log(formatProductTable(products));
  } catch (error) {
    console.log(formatError(error instanceof Error ? error.message : 'Error desconocido'));
  }
}
