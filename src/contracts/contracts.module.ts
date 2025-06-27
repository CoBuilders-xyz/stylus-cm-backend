import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bytecode } from './entities/bytecode.entity';
import { Contract } from './entities/contract.entity';
import {
  ContractBidCalculatorService,
  ContractBidAssessmentService,
  ContractHistoryService,
  ContractEnrichmentService,
  CacheStatisticsService,
} from './services';
import { BlockchainState } from '../blockchains/entities/blockchain-state.entity';
import { BlockchainEvent } from 'src/blockchains/entities/blockchain-event.entity';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { UserContract } from '../user-contracts/entities/user-contract.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Bytecode,
      Contract,
      Blockchain,
      BlockchainState,
      BlockchainEvent,
      UserContract,
    ]),
  ],
  controllers: [ContractsController],
  providers: [
    ContractsService,
    ContractBidCalculatorService,
    ContractBidAssessmentService,
    ContractHistoryService,
    ContractEnrichmentService,
    CacheStatisticsService,
  ],
  exports: [
    ContractBidCalculatorService,
    ContractBidAssessmentService,
    ContractHistoryService,
    ContractEnrichmentService,
    CacheStatisticsService,
  ],
})
export class ContractsModule {}
