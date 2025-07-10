import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Main service and controller
import { BlockchainsService } from './blockchains.service';
import { BlockchainsController } from './blockchains.controller';
import { BlockchainEventsController } from './blockchain-events.controller';

// Specialized services
import {
  BlockchainCrudService,
  BlockchainMetricsService,
  BlockchainAnalyticsService,
  BlockchainInitializerService,
  BlockchainEventsService,
} from './services';

// Entities
import { Blockchain } from './entities/blockchain.entity';
import { BlockchainState } from './entities/blockchain-state.entity';
import { BlockchainEvent } from './entities/blockchain-event.entity';
import { Bytecode } from '../contracts/entities/bytecode.entity';
import { Contract } from '../contracts/entities/contract.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Blockchain,
      BlockchainState,
      BlockchainEvent,
      Bytecode,
      Contract,
    ]),
  ],
  controllers: [BlockchainsController, BlockchainEventsController],
  providers: [
    // Main orchestration service
    BlockchainsService,

    // Specialized services
    BlockchainCrudService,
    BlockchainMetricsService,
    BlockchainAnalyticsService,
    BlockchainInitializerService,
    BlockchainEventsService,
  ],
  exports: [
    // Export main service for other modules
    BlockchainsService,

    // Export specialized services for potential direct use
    BlockchainCrudService,
    BlockchainMetricsService,
    BlockchainAnalyticsService,
    BlockchainEventsService,
  ],
})
export class BlockchainsModule {}
