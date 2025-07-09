import { Module } from '@nestjs/common';
import config from './common/config/config';
import databaseConfig from './common/config/database.config';
import redisConfig from './common/config/redis.config';
import appConfig from './common/config/app.config';
import authConfig from './auth/auth.config';

// nestjs modules
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';

// app modules
import { UsersModule } from './users/users.module';
import { ContractsModule } from './contracts/contracts.module';
import { BlockchainsModule } from './blockchains/blockchains.module';
import { DataProcessingModule } from './data-processing/data-processing.module';
import { EventFetcherModule } from './event-fetcher/event-fetcher.module';
import { StateFetcherModule } from './state-fetcher/state-fetcher.module';
import { UserContractsModule } from './user-contracts/user-contracts.module';
import { AuthModule } from './auth/auth.module';
import { AlertsModule } from './alerts/alerts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CmaModule } from './cma/cma.module';

const appModules = [
  BlockchainsModule,
  UsersModule,
  ContractsModule,
  StateFetcherModule,
  EventFetcherModule,
  DataProcessingModule,
  UserContractsModule,
  AuthModule,
  AlertsModule,
  CmaModule,
  NotificationsModule,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config, databaseConfig, redisConfig, appConfig, authConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.get('database')!,
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => configService.get('redis')!,
    }),
    ScheduleModule.forRoot(),
    CacheModule.register(),
    EventEmitterModule.forRoot(),
    ...appModules,
  ],
})
export class AppModule {}
