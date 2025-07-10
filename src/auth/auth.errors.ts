import {
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

export enum AuthErrorCode {
  TOKEN_MISSING = 'TOKEN_MISSING',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_NOT_ACTIVE = 'TOKEN_NOT_ACTIVE',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  TOKEN_VERIFICATION_FAILED = 'TOKEN_VERIFICATION_FAILED',
  NONCE_NOT_FOUND = 'NONCE_NOT_FOUND',
  SIGNATURE_VERIFICATION_FAILED = 'SIGNATURE_VERIFICATION_FAILED',
}

export const AuthErrors = {
  TOKEN_MISSING: {
    error: AuthErrorCode.TOKEN_MISSING,
    message: 'Authorization token is required',
  },
  TOKEN_EXPIRED: {
    error: AuthErrorCode.TOKEN_EXPIRED,
    message: 'JWT token has expired. Please login again',
  },
  TOKEN_INVALID: {
    error: AuthErrorCode.TOKEN_INVALID,
    message: 'Invalid JWT token format',
  },
  TOKEN_NOT_ACTIVE: {
    error: AuthErrorCode.TOKEN_NOT_ACTIVE,
    message: 'JWT token is not active yet',
  },
  USER_NOT_FOUND: {
    error: AuthErrorCode.USER_NOT_FOUND,
    message: 'User associated with token not found',
  },
  TOKEN_VERIFICATION_FAILED: {
    error: AuthErrorCode.TOKEN_VERIFICATION_FAILED,
    message: 'Token verification failed',
  },
  NONCE_NOT_FOUND: {
    error: AuthErrorCode.NONCE_NOT_FOUND,
    message: 'Nonce not found or expired. Please generate a new nonce',
  },
  SIGNATURE_VERIFICATION_FAILED: {
    error: AuthErrorCode.SIGNATURE_VERIFICATION_FAILED,
    message:
      'Signature verification failed. Please check your signature and try again',
  },
} as const;

/**
 * Helper functions to throw specific auth errors
 */
export const throwAuthError = (errorType: keyof typeof AuthErrors): never => {
  throw new UnauthorizedException(AuthErrors[errorType]);
};

export const throwAuthNotFoundError = (
  errorType: keyof typeof AuthErrors,
): never => {
  throw new NotFoundException(AuthErrors[errorType]);
};

export const throwAuthBadRequestError = (
  errorType: keyof typeof AuthErrors,
): never => {
  throw new BadRequestException(AuthErrors[errorType]);
};

/**
 * Specific error thrower functions for better developer experience
 */
export const AuthErrorHelpers = {
  throwTokenMissing: () => throwAuthError('TOKEN_MISSING'),
  throwTokenExpired: () => throwAuthError('TOKEN_EXPIRED'),
  throwTokenInvalid: () => throwAuthError('TOKEN_INVALID'),
  throwTokenNotActive: () => throwAuthError('TOKEN_NOT_ACTIVE'),
  throwUserNotFound: () => throwAuthError('USER_NOT_FOUND'),
  throwTokenVerificationFailed: () =>
    throwAuthError('TOKEN_VERIFICATION_FAILED'),
  throwNonceNotFound: () => throwAuthNotFoundError('NONCE_NOT_FOUND'),
  throwSignatureVerificationFailed: () =>
    throwAuthBadRequestError('SIGNATURE_VERIFICATION_FAILED'),
};
