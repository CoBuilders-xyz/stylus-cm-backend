import { join } from 'path';
import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { validatePort } from '../utils/validation.util';
import { DEFAULT_POSTGRES_PORT } from './constants';

// Import entities
import { User } from '../../users/entities';
import { UserContract } from '../../user-contracts/entities';
import {
  Blockchain,
  BlockchainEvent,
  BlockchainState,
} from '../../blockchains/entities';
import { Bytecode, Contract } from '../../contracts/entities';
import { Alert } from '../../alerts/entities';

const entities = [
  Bytecode,
  Blockchain,
  BlockchainEvent,
  BlockchainState,
  User,
  UserContract,
  Contract,
  Alert,
];

/**
 * Schema management strategy, decided by ENVIRONMENT:
 *
 * - local, develop: TypeORM `synchronize` alters the schema from the entities
 *   at startup. Migrations are not run.
 * - staging, production: `synchronize` is off. Pending migrations from
 *   `src/migrations` run automatically at startup (`migrationsRun`).
 *
 * Any schema change must therefore ship with a migration, or it never reaches
 * staging and production. See README "Database migrations".
 */
export const isSchemaSyncEnabled = (environment: string): boolean =>
  environment === 'local' || environment === 'develop';

/**
 * Builds the TypeORM DataSource options from environment variables.
 * Shared by the Nest application and the TypeORM CLI (see data-source.ts).
 */
export const buildDataSourceOptions = (): DataSourceOptions => {
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

  const environment = process.env.ENVIRONMENT || 'local';
  const synchronize = isSchemaSyncEnabled(environment);

  // Build base configuration
  const baseConfig: DataSourceOptions = {
    type: 'postgres',
    entities,
    synchronize,
    // Works from both src/ (ts-node) and dist/src/ (compiled) because the
    // migrations folder sits next to this file's parent in both trees.
    migrations: [join(__dirname, '../../migrations/*.{ts,js}')],
    migrationsRun: !synchronize,
    migrationsTableName: 'migrations',
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
};

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => buildDataSourceOptions(),
);
