import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  SetMetadata,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { UsersService } from 'src/users/users.service';
import { AuthErrorHelpers } from './auth.errors';

interface JwtPayload {
  userAddress: string;
  exp?: number;
  iat?: number;
}

interface AuthenticatedRequest extends Request {
  user: any;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private userService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const isOptionalAuth = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isOptionalAuth) {
      return true; // Skip global auth guard for optional auth routes
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.warn(`Unauthorized access attempt - missing token`);
      AuthErrorHelpers.throwTokenMissing();
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token!);
      const user = await this.userService.findOne(payload.userAddress);

      if (!user) {
        this.logger.warn(
          `Token valid but user not found: ${payload.userAddress}`,
        );
        AuthErrorHelpers.throwUserNotFound();
      }

      this.logger.log(`Authenticated access for user: ${payload.userAddress}`);
      request.user = user;
    } catch (error: any) {
      // Handle different JWT errors specifically
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error?.name === 'TokenExpiredError') {
        this.logger.warn(`JWT token expired for request`);
        AuthErrorHelpers.throwTokenExpired();
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error?.name === 'JsonWebTokenError') {
        this.logger.warn(`Invalid JWT token provided`);
        AuthErrorHelpers.throwTokenInvalid();
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error?.name === 'NotBeforeError') {
        this.logger.warn(`JWT token not active yet`);
        AuthErrorHelpers.throwTokenNotActive();
      }

      // If it's already an UnauthorizedException, re-throw it
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Generic fallback for other errors
      this.logger.error('Unexpected error during JWT verification', error);
      AuthErrorHelpers.throwTokenVerificationFailed();
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  private readonly logger = new Logger(OptionalAuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private userService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      // No token provided, but that's okay for optional auth
      this.logger.debug('No token provided for optional auth endpoint');
      request.user = null;
      return true;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const user = await this.userService.findOne(payload.userAddress);

      if (!user) {
        this.logger.warn(
          `Token valid but user not found: ${payload.userAddress}`,
        );
        request.user = null;
        return true;
      }

      this.logger.log(`Authenticated access for user: ${payload.userAddress}`);
      request.user = user;
    } catch (error: any) {
      // For optional auth, we don't throw errors, just set user to null
      this.logger.debug(
        `Invalid token provided for optional auth endpoint: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      request.user = null;
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
