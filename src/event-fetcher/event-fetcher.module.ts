import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventFetcherService } from './event-fetcher.service';
import { Blockchain } from '../blockchains/entities/blockchain.entity';
import { BlockchainEvent } from '../blockchains/entities/blockchain-event.entity';

// Domain-based imports
import {
  EventListenerService,
  WebSocketManagerService,
  ListenerStateService,
  ReconnectionHandlerService,
} from './listener';

import { EventSyncService, EventSchedulerService } from './sync';

import {
  EventStorageService,
  EventConfigService,
  EventProcessorService,
} from './shared';

import { ProviderManager } from '../common/utils/provider.util';
import { BlockchainsModule } from 'src/blockchains/blockchains.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Blockchain, BlockchainEvent]),
    BlockchainsModule,
  ],
  providers: [
    EventFetcherService,
    // Listener Domain Services
    EventListenerService,
    WebSocketManagerService,
    ListenerStateService,
    ReconnectionHandlerService,
    // Sync Domain Services
    EventSyncService,
    EventSchedulerService,
    // Shared Domain Services
    EventStorageService,
    EventConfigService,
    EventProcessorService,
    // External Dependencies
    ProviderManager,
  ],
  exports: [EventFetcherService],
})
export class EventFetcherModule {}
