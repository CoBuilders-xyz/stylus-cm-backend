import { AppConfig, shouldAllowOrigin } from './app.config';

describe('shouldAllowOrigin', () => {
  const baseConfig = (overrides: Partial<AppConfig>): AppConfig => ({
    cors: { allowedHttpMethods: ['GET'] },
    environment: 'staging',
    loggerLevels: ['error'],
    port: 3000,
    ...overrides,
  });

  it('allows requests without an Origin header', () => {
    expect(shouldAllowOrigin(undefined, baseConfig({}))).toBe(true);
  });

  it('allows any origin in local', () => {
    expect(
      shouldAllowOrigin(
        'https://evil.example',
        baseConfig({ environment: 'local' }),
      ),
    ).toBe(true);
  });

  it('allows an origin matching a configured prefix outside production', () => {
    const config = baseConfig({
      allowedOriginPrefix: 'https://stylus-cm-frontend,https://stylus-nginx',
    });
    expect(
      shouldAllowOrigin('https://stylus-cm-frontend-abc.vercel.app', config),
    ).toBe(true);
    expect(shouldAllowOrigin('https://evil.example', config)).toBe(false);
  });

  it('ignores empty prefixes, so a trailing comma does not allow every origin', () => {
    const config = baseConfig({
      allowedOriginPrefix: 'https://stylus-cm-frontend,',
    });
    expect(shouldAllowOrigin('https://evil.example', config)).toBe(false);
    expect(
      shouldAllowOrigin('https://stylus-cm-frontend-abc.vercel.app', config),
    ).toBe(true);
  });

  it('ignores prefixes in production and only matches the frontend URL', () => {
    const config = baseConfig({
      environment: 'production',
      allowedOriginPrefix: 'https://',
      frontendUrl: 'https://stylus.cobuilders.xyz',
    });
    expect(shouldAllowOrigin('https://evil.example', config)).toBe(false);
    expect(shouldAllowOrigin('https://stylus.cobuilders.xyz', config)).toBe(
      true,
    );
  });
});
