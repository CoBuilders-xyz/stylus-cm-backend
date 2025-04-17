import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { CacheModule } from '@nestjs/cache-manager';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard';

@Module({
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  controllers: [AuthController],
  imports: [
    UsersModule,
    CacheModule.register(),
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret, // TODO Change Secret make it env
      signOptions: { expiresIn: '1d' }, // TODO Change expiration time make it env
    }),
  ],
})
export class AuthModule {}
