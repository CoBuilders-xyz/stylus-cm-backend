import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { CacheModule } from '@nestjs/cache-manager';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { AuthConfig } from './auth.config';
import { DevelopmentOnlyGuard } from './development-only.guard';

@Module({
  providers: [
    AuthService,
    DevelopmentOnlyGuard,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  controllers: [AuthController],
  imports: [
    UsersModule,
    CacheModule.register(),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const authConfig = configService.get<AuthConfig>('auth')!;
        return {
          secret: authConfig.jwtSecret,
          signOptions: { expiresIn: authConfig.jwtExpiresIn },
        };
      },
    }),
  ],
})
export class AuthModule {}
