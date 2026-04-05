/**
 * Script para generar 200 productos realistas de farmacia
 * y cargarlos en Redis
 */

import Redis from 'ioredis';

// Configuración de conexión
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

// Categorías de farmacia
const categories = [
  'analgesicos',
  'antibioticos',
  'antinflamatorios',
  'dermocosmetica',
  'gastrointestinal',
  'cardiovascular',
  'respiratorio',
  'vitaminas',
  'suplementos',
  'cuidado-personal',
  ' Oftalmico',
  'otorrinolaringologia',
  'femenino',
  'pediatrico',
  'dieteticos'
];

// Laboratories
const laboratories = [
  'Bayer',
  'Novartis',
  'Pfizer',
  'Roche',
  'GSK',
  'Sanofi',
  'Merck',
  'Johnson & Johnson',
  'Abbott',
  'Bristol Myers Squibb',
  'AstraZeneca',
  'Eli Lilly',
  'Boehringer Ingelheim',
  'Takeda',
  'Teva'
];

// Nombres de productos por categoría
const productsByCategory: Record<string, string[]> = {
  analgesicos: [
    'Paracetamol 500mg', 'Paracetamol 1g', 'Ibuprofeno 400mg', 'Ibuprofeno 600mg',
    'Aspirina 500mg', 'Dipirona 500mg', 'Naproxeno 500mg', 'Tramadol 50mg',
    'Codeina 30mg', 'Morfina 10mg', 'Ketoprofeno 50mg', 'Diclofenaco 50mg'
  ],
  antibioticos: [
    'Amoxicilina 500mg', 'Amoxicilina 875mg', 'Azitromicina 500mg', 'Ciprofloxacino 500mg',
    'Ceftriaxona 1g', 'Cefalexina 500mg', 'Metronidazol 500mg', 'Doxiciclina 100mg',
    'Levofloxacino 500mg', 'Penicilina V 500mg', 'Sulfametoxazol 800mg', 'Eritromicina 500mg'
  ],
  antiflamatorios: [
    'Ibuprofeno 400mg', 'Ibuprofeno 600mg', 'Naproxeno 500mg', 'Ketoprofeno 50mg',
    'Diclofenaco 50mg', 'Diclofenaco gel', 'Piroxicam 20mg', 'Meloxicam 15mg',
    'Celecoxib 200mg', 'Etoricoxib 90mg'
  ],
  dermocosmetica: [
    'Crema hydratante corporal', 'Protector solar SPF 50', 'Crema antiarugas',
    'Tratamiento acne', 'Serum vitamina C', 'Crema contorno de ojos',
    'Gel limpiador facial', 'Tónico facial', 'Mascarilla facial',
    'Bálsamo labial', 'Crema manos', 'Locion corporal'
  ],
  gastrointestinal: [
    'Omeprazol 20mg', 'Omeprazol 40mg', 'Pantoprazol 40mg', 'Esomeprazol 20mg',
    'Ranitidina 150mg', 'Famotidina 20mg', 'Metoclopramida 10mg',
    'Domperidona 10mg', 'Loperamida 2mg', 'Simeticona 125mg',
    'Buscapina 10mg', 'Enantyum 25mg'
  ],
  cardiovascular: [
    'Losartan 50mg', 'Losartan 100mg', 'Amlodipino 5mg', 'Amlodipino 10mg',
    'Enalapril 10mg', 'Captopril 25mg', 'Hidroclorotiazida 25mg',
    'Furosemida 40mg', 'Atorvastatina 20mg', 'Atorvastatina 40mg',
    'Simvastatina 20mg', 'Rosuvastatina 10mg'
  ],
  respiratorio: [
    'Salbutamol 100mcg', 'Budesonida 100mcg', 'Fluticasona 125mcg',
    'Cetirizina 10mg', 'Loratadina 10mg', 'Desloratadina 5mg',
    'Ambroxol 30mg', 'Ambroxol jarabe', 'Carbocisteina 375mg',
    'Pseudoefedrina 60mg', 'Fenilefrina 10mg', 'Dextrometorfano 15mg'
  ],
  vitaminas: [
    'Vitamina C 1000mg', 'Vitamina D3 1000UI', 'Vitamina D3 4000UI',
    'Vitamina B12 1000mcg', 'Vitamina B1 100mg', 'Vitamina B Complex',
    'Vitamina E 400mg', 'Vitamina K2 100mcg', 'Acido folico 5mg',
    'Multivitaminico', 'Ferro glubionate', 'Magnesio 300mg'
  ],
  suplementos: [
    'Omega-3 1000mg', 'Omega-3 2000mg', 'Glucosamina 1500mg',
    'Condroitina 1200mg', 'Creatina 5g', 'Magnesio 300mg',
    'Zinc 50mg', 'Selenio 200mcg', 'CoQ10 100mg', 'Melatonina 1mg',
    'Melatonina 3mg', 'Ginkgo biloba 80mg', 'Spirulina 1000mg'
  ],
  'cuidado-personal': [
    ' shampoo medicinal', 'Acondicionador', 'Jabon antibacterial',
    'Crema dental', 'Enjuague bucal', 'Cepillo dental',
    'Algodon', 'Gasas', 'Vendas', 'Curitas',
    'Tiras nasal', 'Repelente insectos'
  ],
  'oftalmico': [
    'Lagrimas artificiales', 'Gotas lubricantes', 'Solucion lentes contacto',
    'Tobramicina gotas', 'Polimixina B gotas', 'Dexametasona gotas',
    'Tetrizolina gotas', 'Olopatadina gotas'
  ],
  otorrinolaringologia: [
    'Spray nasal physiologic', 'Spray nasal descongestivo', 'Gotas oticas',
    'Agua oxigenada', 'Glicerina boratada', 'Spray garganta'
  ],
  femenino: [
    'Anticonceptivos orales', 'Progesterona 200mg', 'Acido folico 5mg',
    'Suplemento prenatal', 'Crema estrogenica', 'Tratamiento candidiasis',
    'Test embarazo', 'Preservativos', 'Gel lubricante'
  ],
  pediatrico: [
    'Paracetamol pediatric', 'Ibuprofeno pediatric', 'Amoxicilina suspension',
    'Azitromicina suspension', 'Vitamina D3 pediatric', 'Multivitaminico pediatric',
    'Suer oral', 'Rehidratante', 'Crema pañal'
  ],
  dieteticos: [
    'Edulcorante', 'Barra proteinica', 'Bebida isotonica',
    'Sustituto comida', 'Fibra alimentaria', 'Probioticos'
  ]
};

// Generar código único
function generateCode(category: string, index: number): string {
  const prefix = category.substring(0, 3).toUpperCase();
  return `${prefix}${String(index).padStart(4, '0')}`;
}

// Generar precio aleatorio en rango
function randomPrice(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

// Generar stock aleatorio
function randomStock(minStock: number): number {
  return Math.floor(Math.random() * 100) + minStock;
}

// Generar fecha de vencimiento (entre 30 días y 2 años)
function randomExpiryDate(): number {
  const now = Date.now();
  const days = Math.floor(Math.random() * 730) + 30; // 30 días a 2 años
  return now + days * 24 * 60 * 60 * 1000;
}

// Generar 200 productos
function generateProducts(): any[] {
  const products: any[] = [];
  let id = 1;

  // Repartir 200 productos entre las categorías
  const entries = Object.entries(productsByCategory);
  
  for (const [category, names] of entries) {
    const productsPerCategory = Math.ceil(200 / entries.length);
    
    for (let i = 0; i < productsPerCategory && products.length < 200; i++) {
      const name = names[i % names.length];
      const code = generateCode(category, id);
      const minStock = Math.floor(Math.random() * 10) + 5;
      
      // Algunos productos con stock bajo
      const stock = Math.random() < 0.15 
        ? Math.floor(Math.random() * minStock) 
        : randomStock(minStock);
      
      // Algunos productos próximos a vencer
      const expiryDays = Math.random() < 0.1 
        ? Math.floor(Math.random() * 30) + 1 
        : Math.floor(Math.random() * 730) + 30;
      
      const expiryDate = Date.now() + expiryDays * 24 * 60 * 60 * 1000;
      
      products.push({
        code,
        name,
        category,
        price: randomPrice(5, 150),
        stock,
        minStock,
        expiryDate: new Date(expiryDate).toISOString().split('T')[0],
        description: `${name} de ${laboratories[Math.floor(Math.random() * laboratories.length)]}`,
        batchNumber: `LOT${Math.floor(Math.random() * 900000) + 100000}`,
        laboratory: laboratories[Math.floor(Math.random() * laboratories.length)],
        createdAt: Date.now()
      });
      
      id++;
    }
  }

  return products;
}

// Insertar productos en Redis
async function loadProducts(products: any[]) {
  console.log(`🔄 Insertando ${products.length} productos en Redis...`);
  
  let lowStockCount = 0;
  let expiringCount = 0;
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  for (const product of products) {
    // Guardar producto como HASH
    await redis.hset(`product:${product.code}`, {
      ...product,
      expiryDate: product.expiryDate
    });
    
    // Agregar a índice global
    await redis.sadd('all_products', product.code);
    
    // Agregar a categoría
    await redis.sadd('categories', product.category);
    await redis.sadd(`products:by_category:${product.category}`, product.code);
    
    // Agregar a lista de vencimiento (score = timestamp)
    const expiryTimestamp = new Date(product.expiryDate).getTime();
    await redis.zadd('expiring_products', expiryTimestamp, product.code);
    
    // Contador de stock bajo
    if (product.stock <= product.minStock) {
      lowStockCount++;
    }
    
    // Contador por vencer
    if (expiryTimestamp - now < thirtyDays) {
      expiringCount++;
    }
  }

  console.log(`✅ ${products.length} productos cargados`);
  console.log(`⚠️  ${lowStockCount} productos con stock bajo`);
  console.log(`⏰ ${expiringCount} productos por vencer en 30 días`);
}

// Función principal
async function main() {
  try {
    console.log('🔌 Conectando a Redis...');
    // ioredis se conecta automáticamente, no necesita connect() explícito
    // Verificar conexión con ping
    await redis.ping();
    console.log('✅ Conectado a Redis\n');
    
    const products = generateProducts();
    await loadProducts(products);
    
    console.log('\n📊 Resumen de datos cargados:');
    console.log(`   - Total productos: ${products.length}`);
    console.log(`   - Categorías: ${categories.length}`);
    console.log(`   - Laboratorios: ${laboratories.length}`);
    
    // Verificar estructura
    const productCount = await redis.scard('all_products');
    const categoryCount = await redis.scard('categories');
    console.log(`\n📋 Verificación Redis:`);
    console.log(`   - Productos en índice: ${productCount}`);
    console.log(`   - Categorías: ${categoryCount}`);
    
    await redis.quit();
    console.log('\n✅ Carga completada');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
