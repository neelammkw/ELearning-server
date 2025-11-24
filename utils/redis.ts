// utils/redis.ts
import {Redis} from "ioredis";
require('dotenv').config();

// Create a Redis client with better error handling
const createRedisClient = () => {
    if(!process.env.REDIS_URL){
        console.warn('❌ REDIS_URL not found, Redis will be disabled');
        return null;
    }

    try {
        const client = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: 1,
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
            lazyConnect: true,
            connectTimeout: 5000,
            commandTimeout: 3000,
        });

        client.on('error', (err) => {
            console.warn('❌ Redis connection error (non-fatal):', err.message);
        });

        client.on('connect', () => {
            console.log('✅ Redis connected successfully');
        });

        return client;
    } catch (error) {
        console.warn('❌ Failed to create Redis client:', error);
        return null;
    }
};

export const redis = createRedisClient();

// Safe Redis operations that won't crash the app
export const safeRedis = {
    async get(key: string): Promise<string | null> {
        if (!redis) return null;
        try {
            return await redis.get(key);
        } catch (error) {
            console.warn('Redis get error:', error);
            return null;
        }
    },
    
    async set(key: string, value: string, expire?: number): Promise<boolean> {
        if (!redis) return false;
        try {
            if (expire) {
                await redis.setex(key, expire, value);
            } else {
                await redis.set(key, value);
            }
            return true;
        } catch (error) {
            console.warn('Redis set error:', error);
            return false;
        }
    },
    
    async del(key: string): Promise<boolean> {
        if (!redis) return false;
        try {
            await redis.del(key);
            return true;
        } catch (error) {
            console.warn('Redis del error:', error);
            return false;
        }
    }
};