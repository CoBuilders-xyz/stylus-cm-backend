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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Alert,
      UserContract,
      Blockchain,
      BlockchainEvent,
    ]),
  ],
  providers: [AlertsService, AlertMonitoringService, ProviderManager],
  controllers: [AlertsController],
  exports: [AlertMonitoringService],
})
export class AlertsModule {}
