import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { UserContract } from 'src/user-contracts/entities/user-contract.entity';
import { Alert } from './entities/alert.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { AlertMonitoringService } from './alert-monitoring.service';
import { ProviderManager } from 'src/common/utils/provider.util';
import { BlockchainEvent } from 'src/blockchains/entities/blockchain-event.entity';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { ContractsModule } from 'src/contracts/contracts.module';
import { Contract } from 'src/contracts/entities/contract.entity';
import { BullModule } from '@nestjs/bullmq';
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
  providers: [AlertsService, AlertMonitoringService, ProviderManager],
  controllers: [AlertsController],
  exports: [AlertsService, AlertMonitoringService],
})
export class AlertsModule {}
