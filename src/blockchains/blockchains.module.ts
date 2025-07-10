import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Main service and controller
import { BlockchainsService } from './blockchains.service';
import { BlockchainsController } from './blockchains.controller';

// Specialized services
import {
  BlockchainCrudService,
  BlockchainMetricsService,
  BlockchainAnalyticsService,
  BlockchainInitializerService,
} from './services';

// Entities
import { Blockchain } from './entities/blockchain.entity';
import { BlockchainState } from './entities/blockchain-state.entity';
import { BlockchainEvent } from './entities/blockchain-event.entity';
import { BlockchainMetric } from './entities/blockchain-metric.entity';
import { Bytecode } from '../contracts/entities/bytecode.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Blockchain,
      BlockchainState,
      BlockchainEvent,
      BlockchainMetric,
      Bytecode,
    ]),
  ],
  controllers: [BlockchainsController],
  providers: [
    // Main orchestration service
    BlockchainsService,

    // Specialized services
    BlockchainCrudService,
    BlockchainMetricsService,
    BlockchainAnalyticsService,
    BlockchainInitializerService,
  ],
  exports: [
    // Export main service for other modules
    BlockchainsService,

    // Export specialized services for potential direct use
    BlockchainCrudService,
    BlockchainMetricsService,
    BlockchainAnalyticsService,
  ],
})
export class BlockchainsModule {}
