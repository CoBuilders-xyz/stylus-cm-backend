import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bytecode } from './entities/bytecode.entity';
import { Contract } from './entities/contract.entity';
import { ContractsUtilsService } from './contracts.utils.service';
import { ContractBidCalculatorService } from './services/contract-bid-calculator.service';
import { ContractBidAssessmentService } from './services/contract-bid-assessment.service';
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
    ContractsUtilsService,
    ContractBidCalculatorService,
    ContractBidAssessmentService,
  ],
  exports: [
    ContractsUtilsService,
    ContractBidCalculatorService,
    ContractBidAssessmentService,
  ],
})
export class ContractsModule {}
