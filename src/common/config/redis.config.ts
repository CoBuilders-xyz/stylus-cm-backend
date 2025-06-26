import { registerAs } from '@nestjs/config';
import { validatePort } from '../utils/validation.util';

export interface RedisConfig {
  connection: {
    family: number;
    host?: string;
    port?: number;
    url?: string;
  };
  defaultJobOptions: {
    attempts: number;
    backoff: {
      delay: number;
      type: string;
    };
    removeOnComplete: boolean;
    removeOnFail: boolean;
  };
}

export default registerAs('redis', (): RedisConfig => {
  // Validate required environment variables
  const validateConfig = () => {
    if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
      throw new Error('Either REDIS_URL or REDIS_HOST must be provided');
    }

    if (
      process.env.REDIS_URL &&
      !process.env.REDIS_URL.startsWith('redis://')
    ) {
      throw new Error(
        'REDIS_URL must be a valid Redis connection string starting with redis://',
      );
    }
  };

  // Validate numeric job options
  const validateJobOption = (
    value: string,
    name: string,
    min: number = 1,
  ): number => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < min) {
      throw new Error(`Invalid ${name}: ${value}. Must be a number >= ${min}.`);
    }
    return num;
  };

  // Run validation
  validateConfig();

  // Build connection configuration
  const connection = process.env.REDIS_URL
    ? {
        url: process.env.REDIS_URL,
        family: 0,
      }
    : {
        host: process.env.REDIS_HOST!,
        port: process.env.REDIS_PORT
          ? validatePort(process.env.REDIS_PORT, 'REDIS_PORT')
          : 6380,
        family: 0,
      };

  // Build job options with validation
  const attempts = process.env.BULLMQ_ATTEMPTS
    ? validateJobOption(process.env.BULLMQ_ATTEMPTS, 'BULLMQ_ATTEMPTS', 1)
    : 5;

  const backoffDelay = process.env.BULLMQ_BACKOFF_DELAY
    ? validateJobOption(
        process.env.BULLMQ_BACKOFF_DELAY,
        'BULLMQ_BACKOFF_DELAY',
        1000,
      )
    : 10000;

  return {
    connection,
    defaultJobOptions: {
      attempts,
      backoff: {
        type: 'exponential',
        delay: backoffDelay,
      },
      removeOnComplete: false,
      removeOnFail: false,
    },
  };
});
