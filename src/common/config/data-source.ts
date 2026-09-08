import 'dotenv/config';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './database.config';

/**
 * DataSource for the TypeORM CLI (npm run migration:*).
 * The running application does not use this file; it gets the same options
 * through the Nest ConfigService (see database.config.ts).
 */
export const AppDataSource = new DataSource(buildDataSourceOptions());
