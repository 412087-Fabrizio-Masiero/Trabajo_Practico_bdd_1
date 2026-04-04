/**
 * Cliente Redis para la gestión de productos de farmacia
 */

import Redis from 'ioredis';
import { RedisConfig, Product } from '../types';

let redisClient: Redis | null = null;

// Claves de Redis
export const REDIS_KEYS = {
  product: (code: string) => `product:${code}`,
  categories: 'categories',
  expiringProducts: 'expiring_products',
  productsByCategory: (category: string) => `products:by_category:${category.toLowerCase()}`,
  allProducts: 'all_products',
};

export function getRedisConfig(): RedisConfig {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  };
}

export function createRedisClient(config?: RedisConfig): Redis {
  const redisConfig = config || getRedisConfig();
  
  const client = new Redis({
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    db: redisConfig.db,
    retryStrategy: (times: number) => {
      if (times > 3) {
        console.error('No se pudo conectar a Redis después de 3 intentos');
        return null;
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });

  client.on('error', (err) => {
    console.error('Error de Redis:', err.message);
  });

  client.on('connect', () => {
    console.log('✅ Conectado a Redis');
  });

  client.on('ready', () => {
    console.log('✅ Redis listo para recibir comandos');
  });

  return client;
}

export async function connectRedis(): Promise<Redis> {
  if (redisClient) {
    return redisClient;
  }
  
  redisClient = createRedisClient();
  
  try {
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('Error al conectar con Redis:', error);
    throw error;
  }
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error('Redis no está conectado. Llama a connectRedis() primero.');
  }
  return redisClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('Desconectado de Redis');
  }
}

// Funciones auxiliares para hashes de productos
export async function saveProductToRedis(product: Product): Promise<void> {
  const redis = getRedisClient();
  const key = REDIS_KEYS.product(product.code);
  
  // Guardar como hash
  await redis.hset(key, product as unknown as Record<string, string>);
  
  // Agregar a índice global
  await redis.sadd(REDIS_KEYS.allProducts, product.code);
  
  // Agregar a categoría
  await redis.sadd(REDIS_KEYS.categories, product.category);
  await redis.sadd(REDIS_KEYS.productsByCategory(product.category), product.code);
  
  // Agregar a sorted set de productos por vencer (score = timestamp de expiry)
  const expiryTimestamp = new Date(product.expiryDate).getTime();
  await redis.zadd(REDIS_KEYS.expiringProducts, expiryTimestamp, product.code);
}

export async function getProductFromRedis(code: string): Promise<Product | null> {
  const redis = getRedisClient();
  const key = REDIS_KEYS.product(code);
  
  const product = await redis.hgetall(key);
  
  if (!product || Object.keys(product).length === 0) {
    return null;
  }
  
  return product as unknown as Product;
}

export async function deleteProductFromRedis(code: string, category: string): Promise<void> {
  const redis = getRedisClient();
  
  // Eliminar el hash del producto
  await redis.del(REDIS_KEYS.product(code));
  
  // Eliminar de índice global
  await redis.srem(REDIS_KEYS.allProducts, code);
  
  // Eliminar de categoría
  await redis.srem(REDIS_KEYS.productsByCategory(category), code);
  
  // Eliminar del sorted set de vencimiento
  await redis.zrem(REDIS_KEYS.expiringProducts, code);
}

export async function getAllProductCodes(): Promise<string[]> {
  const redis = getRedisClient();
  return redis.smembers(REDIS_KEYS.allProducts);
}

export async function getProductsByCategory(category: string): Promise<string[]> {
  const redis = getRedisClient();
  return redis.smembers(REDIS_KEYS.productsByCategory(category));
}

export async function getCategories(): Promise<string[]> {
  const redis = getRedisClient();
  return redis.smembers(REDIS_KEYS.categories);
}

export async function getExpiringProducts(daysAhead: number = 30): Promise<string[]> {
  const redis = getRedisClient();
  const now = Date.now();
  const futureDate = now + daysAhead * 24 * 60 * 60 * 1000;
  
  // Obtener productos que expiran entre ahora y los próximos N días
  return redis.zrangebyscore(REDIS_KEYS.expiringProducts, now, futureDate);
}

export async function getExpiredProducts(): Promise<string[]> {
  const redis = getRedisClient();
  const now = Date.now();
  
  // Obtener productos que ya expiraron
  return redis.zrangebyscore(REDIS_KEYS.expiringProducts, 0, now - 1);
}
