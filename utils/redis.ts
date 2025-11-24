// utils/redis.ts
import {Redis} from "ioredis";
require('dotenv').config();

const redisClient = () => {
    if(process.env.REDIS_URL){
        console.log('Redis connected');
        return process.env.REDIS_URL;
    }
    throw new Error('Redis connection failed');
};

// Updated Redis configuration with better error handling
export const redis = new Redis(redisClient(), {
    maxRetriesPerRequest: 1, // Reduce from default 20 to 1
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    lazyConnect: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
});

// Add event listeners for better debugging
redis.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

redis.on('connect', () => {
    console.log('Redis connected successfully');
});

redis.on('ready', () => {
    console.log('Redis ready for commands');
});