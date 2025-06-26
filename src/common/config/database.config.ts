import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { validatePort } from '../utils/validation.util';
import { DEFAULT_POSTGRES_PORT } from './constants';

// Import entities
import { User } from '../../users/entities';
import { UserContract } from '../../user-contracts/entities';
import {
  Blockchain,
  BlockchainEvent,
  BlockchainMetric,
  BlockchainState,
} from '../../blockchains/entities';
import {
  Bytecode,
  Contract,
  ContractMetric,
  ContractBytecodeMetric,
} from '../../contracts/entities';
import { Alert } from '../../alerts/entities';

const entities = [
  Bytecode,
  Blockchain,
  BlockchainEvent,
  BlockchainMetric,
  BlockchainState,
  User,
  UserContract,
  Contract,
  ContractMetric,
  ContractBytecodeMetric,
  Alert,
];

export default registerAs('database', (): TypeOrmModuleOptions => {
  // Validate required environment variables
  const validateConfig = () => {
    if (process.env.DATABASE_URL) {
      // URL connection - validate URL format (accept both postgres:// and postgresql://)
      if (
        !process.env.DATABASE_URL.startsWith('postgres://') &&
        !process.env.DATABASE_URL.startsWith('postgresql://')
      ) {
        throw new Error(
          'DATABASE_URL must be a valid PostgreSQL connection string (postgres:// or postgresql://)',
        );
      }
    } else {
      // Individual parameters - validate required fields
      if (!process.env.POSTGRES_HOST) {
        throw new Error(
          'POSTGRES_HOST is required when DATABASE_URL is not provided',
        );
      }
      if (!process.env.POSTGRES_USER) {
        throw new Error(
          'POSTGRES_USER is required when DATABASE_URL is not provided',
        );
      }
      if (!process.env.POSTGRES_PASSWORD) {
        throw new Error(
          'POSTGRES_PASSWORD is required when DATABASE_URL is not provided',
        );
      }
      if (!process.env.POSTGRES_DB) {
        throw new Error(
          'POSTGRES_DB is required when DATABASE_URL is not provided',
        );
      }
    }
  };

  // Run validation
  validateConfig();

  // Get synchronize setting (default to false for production safety)
  const environment = process.env.ENVIRONMENT || 'local';
  const synchronize = environment === 'local' || environment === 'develop';

  // Build base configuration
  const baseConfig: TypeOrmModuleOptions = {
    type: 'postgres',
    entities,
    synchronize,
    logging: environment === 'local' ? ['error', 'warn'] : ['error'],
  };

  // Add connection configuration using spread syntax
  if (process.env.DATABASE_URL) {
    return {
      ...baseConfig,
      url: process.env.DATABASE_URL,
    };
  } else {
    return {
      ...baseConfig,
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT
        ? validatePort(process.env.POSTGRES_PORT, 'POSTGRES_PORT')
        : DEFAULT_POSTGRES_PORT,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
    };
  }
});
