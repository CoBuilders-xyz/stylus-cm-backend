import { Module } from '@nestjs/common';
import { BlockchainsService } from './blockchains.service';
import { TypeOrmModule } from '@nestjs/typeorm';

// entities
import { Blockchain } from './entities/blockchain.entity';
import { BlockchainState } from './entities/blockchain-state.entity';
import { BlockchainEvent } from './entities/blockchain-event.entity';
import { ContractBytecode } from '../contracts/entities/contract-bytecode.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Blockchain,
      BlockchainState,
      BlockchainEvent,
      ContractBytecode,
    ]),
  ],
  providers: [BlockchainsService],
})
export class BlockchainsModule {}
