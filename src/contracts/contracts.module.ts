import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bytecode } from './entities/bytecode.entity';
import { Contract } from './entities/contract.entity';
import { ContractsUtilsService } from './contracts.utils.service';
import { BlockchainState } from '../blockchains/entities/blockchain-state.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Bytecode, Contract, BlockchainState])],
  controllers: [ContractsController],
  providers: [ContractsService, ContractsUtilsService],
})
export class ContractsModule {}
