const { createClient } = require('redis');
const constants = require('../config/constants');
const logger = require('../utils/logger');

let redisClient;
let memoryCache = new Map();

/**
 * Initialize Caching Layer
 */
const initCache = async () => {
  if (constants.REDIS_URL && !redisClient) {
    try {
      redisClient = createClient({ url: constants.REDIS_URL });
      redisClient.on('error', (err) => logger.error('Redis error: %s', err.message));
      await redisClient.connect();
      logger.info('Cache Service: Connected to Redis');
    } catch (error) {
      logger.error('Cache Service: Redis connection failed: %s. Falling back to memory.', error.message);
      redisClient = null;
    }
  }
};

// Start initialization
initCache();

/**
 * Get data from cache
 * @param {string} key 
 */
exports.get = async (key) => {
  try {
    if (redisClient) {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    }

    const entry = memoryCache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() > entry.expires) {
      memoryCache.delete(key);
      return null;
    }

    return entry.value;
  } catch (error) {
    logger.error('Cache get error: %s', error.message);
    return null;
  }
};

/**
 * Set data in cache
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlInSeconds 
 */
exports.set = async (key, value, ttlInSeconds = constants.CACHE_TTL) => {
  try {
    if (redisClient) {
      await redisClient.set(key, JSON.stringify(value), {
        EX: ttlInSeconds
      });
      return true;
    }

    // In-Memory fallback
    memoryCache.set(key, {
      value,
      expires: Date.now() + (ttlInSeconds * 1000)
    });

    // Cleanup memory occasionally if it gets too large
    if (memoryCache.size > 1000) {
      logger.warn('Cache Service: Memory cache reached 1000 items. Truncating.');
      const firstKey = memoryCache.keys().next().value;
      memoryCache.delete(firstKey);
    }

    return true;
  } catch (error) {
    logger.error('Cache set error: %s', error.message);
    return false;
  }
};

/**
 * Delete from cache (Invalidate)
 */
exports.del = async (key) => {
  try {
    if (redisClient) {
      await redisClient.del(key);
      return true;
    }
    return memoryCache.delete(key);
  } catch (error) {
    logger.error('Cache del error: %s', error.message);
    return false;
  }
};
