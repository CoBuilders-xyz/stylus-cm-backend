import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

// Main services
import { AlertsService } from './alerts.service';
import { AlertMonitoringService } from './alert-monitoring.service';

// Specialized services
import {
  AlertCrudService,
  AlertEventProcessorService,
  AlertConditionEvaluatorService,
  AlertSchedulerService,
} from './services';

// Controller
import { AlertsController } from './alerts.controller';

// Entities
import { Alert } from './entities/alert.entity';
import { UserContract } from 'src/user-contracts/entities/user-contract.entity';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { BlockchainEvent } from 'src/blockchains/entities/blockchain-event.entity';
import { Contract } from 'src/contracts/entities/contract.entity';

// External modules and utilities
import { NotificationsModule } from 'src/notifications/notifications.module';
import { ContractsModule } from 'src/contracts/contracts.module';
import { ProviderManager } from 'src/common/utils/provider.util';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Alert,
      UserContract,
      Blockchain,
      BlockchainEvent,
      Contract,
    ]),
    NotificationsModule,
    ContractsModule,
    BullModule.registerQueue({
      name: 'alerts',
    }),
  ],
  controllers: [AlertsController],
  providers: [
    // Main orchestration services
    AlertsService,
    AlertMonitoringService,

    // Specialized services
    AlertCrudService,
    AlertEventProcessorService,
    AlertConditionEvaluatorService,
    AlertSchedulerService,

    // Utilities
    ProviderManager,
  ],
  exports: [
    // Main services for external modules
    AlertsService,
    AlertMonitoringService,

    // Specialized services for potential future use
    AlertCrudService,
    AlertEventProcessorService,
    AlertConditionEvaluatorService,
    AlertSchedulerService,
  ],
})
export class AlertsModule {}
