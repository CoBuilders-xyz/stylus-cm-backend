import { Module } from '@nestjs/common';
import config from './common/config/config';

// nestjs modules
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';

// app modules
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
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

// entities
import { User } from './users/entities/user.entity';
import { UserContract } from './user-contracts/entities/user-contract.entity';
import { Blockchain } from './blockchains/entities/blockchain.entity';
import { Bytecode } from './contracts/entities/bytecode.entity';
import { BlockchainEvent } from './blockchains/entities/blockchain-event.entity';
import { BlockchainMetric } from './blockchains/entities/blockchain-metric.entity';
import { BlockchainState } from './blockchains/entities/blockchain-state.entity';
import { Contract } from './contracts/entities/contract.entity';
import { ContractMetric } from './contracts/entities/contract-metric.entity';
import { ContractBytecodeMetric } from './contracts/entities/bytecode.metric.entity';
import { Alert } from './alerts/entities/alert.entity';

const appModules = [
  BlockchainsModule,
  UsersModule,
  ContractsModule,
  TasksModule,
  StateFetcherModule,
  EventFetcherModule,
  DataProcessingModule,
  UserContractsModule,
  AuthModule,
  AlertsModule,
  CmaModule,
  NotificationsModule,
];
const entities = [
  Bytecode,
  Blockchain,
  BlockchainEvent,
  BlockchainMetric,
  BlockchainState,
  User,
  UserContract,
  Contract,
  ContractMetric,
  ContractBytecodeMetric,
  Alert,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }), // In charge of loading environment variables. Required for the rest.
    TypeOrmModule.forRoot({
      type: 'postgres',
      ...(process.env.DATABASE_URL
        ? { url: process.env.DATABASE_URL } // Use URL connection if DATABASE_URL is provided
        : {
            // Use individual parameters otherwise
            host: process.env.POSTGRES_HOST,
            port: parseInt(process.env.POSTGRES_PORT || '5432'),
            username: process.env.POSTGRES_USER,
            password: process.env.POSTGRES_PASSWORD,
            database: process.env.POSTGRES_DB,
          }),
      entities: entities,
      synchronize: true, // TODO: Change synch to env variable
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
