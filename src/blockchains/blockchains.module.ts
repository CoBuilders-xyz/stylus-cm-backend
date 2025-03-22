import { Module } from '@nestjs/common';
import { BlockchainsService } from './blockchains.service';
import { BlockchainsController } from './blockchains.controller';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Blockchain } from './entities/blockchain.entity';
import { BlockchainDataPoll } from './entities/blockchain-data-poll.entity';
import { RealTimeMetricsService } from './services/real-time-metrics.service';
import { HistoricalEventSyncService } from './services/historical-sync.service';
import { BlockchainEvent } from './entities/blockchain-event.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([Blockchain, BlockchainDataPoll, BlockchainEvent]),
  ],
  controllers: [BlockchainsController],
  providers: [
    BlockchainsService,
    RealTimeMetricsService,
    HistoricalEventSyncService,
  ],
})
export class BlockchainsModule {}
