import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { CacheModule } from '@nestjs/cache-manager';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard, OptionalAuthGuard } from './auth.guard';
import { AuthConfig } from './auth.config';
import { DevelopmentOnlyGuard } from './development-only.guard';

@Module({
  providers: [
    AuthService,
    DevelopmentOnlyGuard,
    OptionalAuthGuard,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  controllers: [AuthController],
  exports: [OptionalAuthGuard],
  imports: [
    UsersModule,
    // AppModule now registers CacheModule globally, so this local registration
    // gives AuthService its own isolated store (nonce keys stay separate from
    // other consumers). Drop this line to fall back to the global store.
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
