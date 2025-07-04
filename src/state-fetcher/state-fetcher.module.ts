import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StateFetcherService } from './state-fetcher.service';
import { Blockchain } from '../blockchains/entities/blockchain.entity';
import { BlockchainState } from '../blockchains/entities/blockchain-state.entity';
import stateFetcherConfig from './state-fetcher.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Blockchain, BlockchainState]),
    ConfigModule.forFeature(stateFetcherConfig),
  ],
  providers: [StateFetcherService],
  exports: [StateFetcherService],
})
export class StateFetcherModule {}
