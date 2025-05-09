import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Blockchain } from '../blockchains/entities/blockchain.entity';
import { BlockchainEvent } from '../blockchains/entities/blockchain-event.entity';
import { Bytecode } from '../contracts/entities/bytecode.entity';
import { Contract } from 'src/contracts/entities/contract.entity';
import { DataProcessingService } from './data-processing.service';
import { EventProcessorService } from './services/event-processor.service';
import { InsertBidService } from './services/insert-bid.service';
import { DeleteBidService } from './services/delete-bid.service';
import { DecayRateService } from './services/decay-rate.service';
import { ContractBytecodeService } from './services/contract-bytecode.service';
import { BlockchainState } from 'src/blockchains/entities/blockchain-state.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Blockchain,
      BlockchainEvent,
      Bytecode,
      Contract,
      BlockchainState,
    ]),
  ],
  providers: [
    DataProcessingService,
    EventProcessorService,
    InsertBidService,
    DeleteBidService,
    DecayRateService,
    ContractBytecodeService,
  ],
  exports: [DataProcessingService],
})
export class DataProcessingModule {}
