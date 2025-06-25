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
  iat?: number;
  exp?: number;
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

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      AuthErrorHelpers.throwTokenMissing();
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token!);
      const user = await this.userService.findOne(payload.userAddress);

      if (!user) {
        AuthErrorHelpers.throwUserNotFound();
      }

      request.user = user;
    } catch (error: any) {
      // Handle different JWT errors specifically
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error?.name === 'TokenExpiredError') {
        this.logger.debug('JWT token expired');
        AuthErrorHelpers.throwTokenExpired();
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error?.name === 'JsonWebTokenError') {
        this.logger.debug('Invalid JWT token');
        AuthErrorHelpers.throwTokenInvalid();
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error?.name === 'NotBeforeError') {
        this.logger.debug('JWT token not active yet');
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
