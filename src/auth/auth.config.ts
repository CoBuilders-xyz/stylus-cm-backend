import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  nonceExpiration: number;
}

export default registerAs('auth', (): AuthConfig => {
  // Validate required environment variables
  const validateConfig = () => {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is required but not provided');
    }

    if (process.env.JWT_SECRET.length < 32) {
      throw new Error(
        'JWT_SECRET must be at least 32 characters long for security',
      );
    }
  };

  // Validate JWT expiration format
  const validateExpiresIn = (expiresIn: string): string => {
    const validFormats = /^(\d+)(s|m|h|d)$/;
    if (!validFormats.test(expiresIn)) {
      throw new Error(
        `Invalid JWT_EXPIRES_IN format: ${expiresIn}. Must be like: 1d, 24h, 1440m, 86400s`,
      );
    }
    return expiresIn;
  };

  // Validate nonce expiration
  const validateNonceExpiration = (value: string): number => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1000 || num > 3600000) {
      throw new Error(
        `Invalid AUTH_NONCE_EXPIRATION: ${value}. Must be between 1000ms (1s) and 3600000ms (1h)`,
      );
    }
    return num;
  };

  // Run validation
  validateConfig();

  // Get configuration values with defaults
  const jwtSecret = process.env.JWT_SECRET!; // Safe after validation
  const jwtExpiresIn = validateExpiresIn(process.env.JWT_EXPIRES_IN || '24h');
  const nonceExpiration = validateNonceExpiration(
    process.env.AUTH_NONCE_EXPIRATION || '600000',
  ); // 10 minutes default

  return {
    jwtSecret,
    jwtExpiresIn,
    nonceExpiration,
  };
});
