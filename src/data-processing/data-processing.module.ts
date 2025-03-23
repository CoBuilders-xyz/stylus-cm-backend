import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Blockchain } from '../blockchains/entities/blockchain.entity';
import { BlockchainEvent } from '../blockchains/entities/blockchain-event.entity';
import { ContractBytecode } from '../contracts/entities/contract-bytecode.entity';
import { DataProcessingService } from './data-processing.service';
import { EventProcessorService } from './services/event-processor.service';
import { InsertBidService } from './services/insert-bid.service';
import { DeleteBidService } from './services/delete-bid.service';
import { DecayRateService } from './services/decay-rate.service';
import { ContractBytecodeService } from './services/contract-bytecode.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Blockchain, BlockchainEvent, ContractBytecode]),
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
