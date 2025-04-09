import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { UserContract } from 'src/user-contracts/entities/user-contract.entity';
import { Alert } from './entities/alert.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Alert, UserContract, Blockchain])],
  providers: [AlertsService],
  controllers: [AlertsController],
})
export class AlertsModule {}
