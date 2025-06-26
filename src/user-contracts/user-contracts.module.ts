import { Module } from '@nestjs/common';
import { UserContractsService } from './user-contracts.service';
import { UserContractsController } from './user-contracts.controller';
import { UserContract } from './entities/user-contract.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { Contract } from 'src/contracts/entities/contract.entity';
import { Bytecode } from 'src/contracts/entities/bytecode.entity';
import { ContractsModule } from 'src/contracts/contracts.module';
import { BlockchainState } from 'src/blockchains/entities/blockchain-state.entity';
import { BlockchainEvent } from 'src/blockchains/entities/blockchain-event.entity';
import { AlertsModule } from 'src/alerts/alerts.module';
import { ProviderManager } from 'src/common/utils/provider.util';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserContract,
      Blockchain,
      Contract,
      BlockchainState,
      BlockchainEvent,
      Bytecode,
    ]),
    ContractsModule,
    AlertsModule,
  ],
  providers: [UserContractsService, ProviderManager],
  controllers: [UserContractsController],
  exports: [UserContractsService],
})
export class UserContractsModule {}
