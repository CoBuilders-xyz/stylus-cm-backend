import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventFetcherService } from './event-fetcher.service';
import { Blockchain } from '../blockchains/entities/blockchain.entity';
import { BlockchainEvent } from '../blockchains/entities/blockchain-event.entity';
import { EventStorageService } from './services/event-storage.service';
import { EventListenerService } from './services/event-listener.service';
import { EventSyncService } from './services/event-sync.service';
import { EventSchedulerService } from './services/event-scheduler.service';
import { EventConfigService } from './services/event-config.service';
import { WebSocketManagerService } from './services/websocket-manager.service';
import { ProviderManager } from '../common/utils/provider.util';
import { BlockchainsModule } from 'src/blockchains/blockchains.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Blockchain, BlockchainEvent]),
    BlockchainsModule,
  ],
  providers: [
    EventFetcherService,
    EventStorageService,
    EventListenerService,
    EventSyncService,
    EventSchedulerService,
    EventConfigService,
    WebSocketManagerService,
    ProviderManager,
  ],
  exports: [EventFetcherService],
})
export class EventFetcherModule {}
