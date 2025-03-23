import { Module } from '@nestjs/common';
import { BlockchainsService } from './blockchains.service';
import { BlockchainsController } from './blockchains.controller';
import { TypeOrmModule } from '@nestjs/typeorm';

// entities
import { Blockchain } from './entities/blockchain.entity';
import { BlockchainState } from './entities/blockchain-state.entity';
import { BlockchainEvent } from './entities/blockchain-event.entity';
import { Contract } from '../contracts/entities/contract.entity';

// services
import { BlockchainStateService } from './services/blockchain-state.service';
import { BlockchainEventProcessorService } from './services/blockchain-event-processor.service';

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
    BlockchainEventProcessorService,
  ],
})
export class BlockchainsModule {}
