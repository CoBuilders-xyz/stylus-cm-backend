import { Module } from '@nestjs/common';
import { BlockchainsService } from './blockchains.service';
import { BlockchainsController } from './blockchains.controller';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Blockchain } from './entities/blockchain.entity';
import { BlockchainState } from './entities/blockchain-state.entity';
import { BlockchainStateService } from './services/blockchain-state.service';
import { BlockchainEventService } from './services/blockchain-event.service';
import { BlockchainEvent } from './entities/blockchain-event.entity';
import { BlockchainEventProcessorService } from './services/blockchain-event-processor.service';
import { Contract } from '../contracts/entities/contract.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Blockchain,
      BlockchainState,
      BlockchainEvent,
      Contract,
    ]),
  ],
  controllers: [BlockchainsController],
  providers: [
    BlockchainsService,
    BlockchainStateService,
    BlockchainEventService,
    BlockchainEventProcessorService,
  ],
})
export class BlockchainsModule {}
