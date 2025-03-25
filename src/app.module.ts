import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import config from './config/config';

// nestjs modules
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { JwtModule } from '@nestjs/jwt';

// app modules
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { ContractsModule } from './contracts/contracts.module';
import { BlockchainsModule } from './blockchains/blockchains.module';
import { MetricsModule } from './metrics/metrics.module';
import { DataProcessingModule } from './data-processing/data-processing.module';
import { EventFetcherModule } from './event-fetcher/event-fetcher.module';
import { StateFetcherModule } from './state-fetcher/state-fetcher.module';

// entities
import { User } from './users/entities/user.entity';
import { Blockchain } from './blockchains/entities/blockchain.entity';
import { ContractBytecode } from './contracts/entities/contract-bytecode.entity';
import { BlockchainEvent } from './blockchains/entities/blockchain-event.entity';
import { BlockchainMetric } from './blockchains/entities/blockchain-metric.entity';
import { BlockchainState } from './blockchains/entities/blockchain-state.entity';
import { Contract } from './contracts/entities/contract.entity';
import { ContractMetric } from './contracts/entities/contract-metric.entity';
import { ContractBytecodeMetric } from './contracts/entities/contract-bytecode.metric.entity';

const appModules = [
  UsersModule,
  ContractsModule,
  BlockchainsModule,
  TasksModule,
  MetricsModule,
  StateFetcherModule,
  EventFetcherModule,
  DataProcessingModule,
];
const entities = [
  ContractBytecode,
  Blockchain,
  BlockchainEvent,
  BlockchainMetric,
  BlockchainState,
  User,
  Contract,
  ContractMetric,
  ContractBytecodeMetric,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }), // In charge of loading environment variables. Required for the rest.
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      entities: entities,
      synchronize: true,
    }),
    ScheduleModule.forRoot(),
    CacheModule.register(),
    JwtModule.register({
      global: true,
      secret: 'THIS IS THE SUPER SECRET', // TODO Change Secret make it env
      signOptions: { expiresIn: '1d' }, // TODO Change expiration time make it env
    }),
    ...appModules,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
