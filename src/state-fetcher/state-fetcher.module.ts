import { Module } from '@nestjs/common';
import { StateFetcherService } from './state-fetcher.service';
import { Blockchain } from '../blockchains/entities/blockchain.entity';
import { BlockchainState } from '../blockchains/entities/blockchain-state.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Blockchain, BlockchainState])],
  providers: [StateFetcherService],
})
export class StateFetcherModule {}
