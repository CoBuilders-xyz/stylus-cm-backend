import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DevelopmentOnlyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  canActivate(_context: ExecutionContext): boolean {
    const environment =
      this.configService.get<string>('ENVIRONMENT') || 'local';

    // Only allow in local and development environments
    const allowedEnvironments = ['local', 'develop', 'staging'];

    if (!allowedEnvironments.includes(environment.toLowerCase())) {
      throw new ForbiddenException({
        error: 'DEVELOPMENT_ENDPOINT_ONLY',
        message: 'This endpoint is only available in development environments',
      });
    }

    return true;
  }
}
