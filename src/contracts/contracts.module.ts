import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bytecode } from './entities/bytecode.entity';
import { Contract } from './entities/contract.entity';
import { ContractsUtilsService } from './contracts.utils.service';
import { BlockchainState } from '../blockchains/entities/blockchain-state.entity';
import { BlockchainEvent } from 'src/blockchains/entities/blockchain-event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Bytecode,
      Contract,
      BlockchainState,
      BlockchainEvent,
    ]),
  ],
  controllers: [ContractsController],
  providers: [ContractsService, ContractsUtilsService],
  exports: [ContractsUtilsService],
})
export class ContractsModule {}
