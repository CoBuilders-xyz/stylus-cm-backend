import { LogLevel } from '@nestjs/common';
import appConfig, { AppConfig, shouldAllowOrigin } from './app.config';

const createConfig = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  environment: 'staging',
  port: 3000,
  loggerLevels: ['log'] as LogLevel[],
  allowedOriginPrefixes: [],
  cors: {
    allowedHttpMethods: ['GET'],
  },
  ...overrides,
});

describe('appConfig', () => {
  const originalAllowedOriginPrefix = process.env.ALLOWED_ORIGIN_PREFIX;

  afterEach(() => {
    if (originalAllowedOriginPrefix === undefined) {
      delete process.env.ALLOWED_ORIGIN_PREFIX;
      return;
    }

    process.env.ALLOWED_ORIGIN_PREFIX = originalAllowedOriginPrefix;
  });

  it('parses comma-separated origin prefixes', () => {
    process.env.ALLOWED_ORIGIN_PREFIX =
      'https://stylus-cm-frontend, http://localhost, http://127.0.0.1';

    expect(appConfig().allowedOriginPrefixes).toEqual([
      'https://stylus-cm-frontend',
      'http://localhost',
      'http://127.0.0.1',
    ]);
  });
});

describe('shouldAllowOrigin', () => {
  it('allows local HTTP origins in non-production environments', () => {
    expect(shouldAllowOrigin('http://localhost:3001', createConfig())).toBe(
      true,
    );
    expect(shouldAllowOrigin('http://127.0.0.1:5173', createConfig())).toBe(
      true,
    );
  });

  it('does not allow local origins in production', () => {
    const config = createConfig({ environment: 'production' });

    expect(shouldAllowOrigin('http://localhost:3001', config)).toBe(false);
    expect(shouldAllowOrigin('http://127.0.0.1:5173', config)).toBe(false);
  });

  it('does not treat lookalike or HTTPS hosts as local HTTP origins', () => {
    expect(
      shouldAllowOrigin('http://localhost.example.com:3001', createConfig()),
    ).toBe(false);
    expect(shouldAllowOrigin('https://localhost:3001', createConfig())).toBe(
      false,
    );
  });

  it('allows an origin matching any configured prefix', () => {
    const config = createConfig({
      allowedOriginPrefixes: ['https://stylus-cm-frontend', 'http://localhost'],
    });

    expect(shouldAllowOrigin('http://localhost:3001', config)).toBe(true);
    expect(
      shouldAllowOrigin(
        'https://stylus-cm-frontend-preview.vercel.app',
        config,
      ),
    ).toBe(true);
  });

  it('rejects an origin that does not match a configured prefix', () => {
    const config = createConfig({
      allowedOriginPrefixes: ['https://stylus-cm-frontend'],
    });

    expect(shouldAllowOrigin('https://example.com', config)).toBe(false);
  });

  it('allows the exact configured frontend URL', () => {
    const config = createConfig({
      frontendUrl: 'https://stylus-cm-frontend-staging.vercel.app',
    });

    expect(
      shouldAllowOrigin(
        'https://stylus-cm-frontend-staging.vercel.app',
        config,
      ),
    ).toBe(true);
  });

  it('allows requests without an origin only in local environments', () => {
    expect(
      shouldAllowOrigin(undefined, createConfig({ environment: 'local' })),
    ).toBe(true);
    expect(shouldAllowOrigin(undefined, createConfig())).toBe(false);
  });
});
