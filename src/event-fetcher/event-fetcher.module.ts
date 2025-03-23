import { Module } from '@nestjs/common';
import { EventFetcherService } from './event-fetcher.service';
import { Blockchain } from '../blockchains/entities/blockchain.entity';
import { BlockchainEvent } from '../blockchains/entities/blockchain-event.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Blockchain, BlockchainEvent])],
  providers: [EventFetcherService],
})
export class EventFetcherModule {}
