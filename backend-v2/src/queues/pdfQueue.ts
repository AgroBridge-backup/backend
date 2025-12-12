import { Queue } from 'bullmq';

// It's recommended to use environment variables for the Redis connection
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

export const pdfGenerationQueue = new Queue('pdf-generation', { connection });
