import { Module } from '@nestjs/common';
import config from './common/config/config';
import databaseConfig from './common/config/database.config';

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
      load: [config, databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.get('database')!,
    }),
    BullModule.forRoot({
      connection: process.env.REDIS_URL
        ? { url: process.env.REDIS_URL, family: 0 }
        : {
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT || '6380'),
            family: 0,
          },
      defaultJobOptions: {
        attempts: parseInt(process.env.BULLMQ_ATTEMPTS || '5'),
        backoff: {
          type: 'exponential',
          delay: parseInt(process.env.BULLMQ_BACKOFF_DELAY || '10000'),
        },
        removeOnComplete: false,
        removeOnFail: false,
      },
    }),
    ScheduleModule.forRoot(),
    CacheModule.register(),
    EventEmitterModule.forRoot(),
    ...appModules,
  ],
})
export class AppModule {}
