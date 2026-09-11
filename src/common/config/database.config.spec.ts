import { buildDataSourceOptions, isSchemaSyncEnabled } from './database.config';

describe('database config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: 'postgres://user:pwd@localhost:5432/db',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isSchemaSyncEnabled', () => {
    it.each([
      ['local', true],
      ['develop', true],
      ['staging', false],
      ['production', false],
    ])('%s -> %s', (environment, expected) => {
      expect(isSchemaSyncEnabled(environment)).toBe(expected);
    });
  });

  describe('buildDataSourceOptions', () => {
    it('uses synchronize and skips migrations in local and develop', () => {
      for (const environment of ['local', 'develop']) {
        process.env.ENVIRONMENT = environment;
        const options = buildDataSourceOptions();
        expect(options.synchronize).toBe(true);
        expect(options.migrationsRun).toBe(false);
      }
    });

    it('runs migrations and disables synchronize in staging and production', () => {
      for (const environment of ['staging', 'production']) {
        process.env.ENVIRONMENT = environment;
        const options = buildDataSourceOptions();
        expect(options.synchronize).toBe(false);
        expect(options.migrationsRun).toBe(true);
      }
    });

    it('points migrations at src/migrations for both ts and js', () => {
      process.env.ENVIRONMENT = 'staging';
      const options = buildDataSourceOptions();
      const [pattern] = options.migrations as string[];
      expect(pattern).toMatch(/[\\/]migrations[\\/]\*\.\{ts,js\}$/);
      expect(options.migrationsTableName).toBe('migrations');
    });

    it('rejects a non-postgres DATABASE_URL', () => {
      process.env.DATABASE_URL = 'mysql://user:pwd@localhost/db';
      expect(() => buildDataSourceOptions()).toThrow(
        'DATABASE_URL must be a valid PostgreSQL connection string',
      );
    });
  });
});
