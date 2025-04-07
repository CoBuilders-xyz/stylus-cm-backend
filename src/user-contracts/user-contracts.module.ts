import { Module } from '@nestjs/common';
import { UserContractsService } from './user-contracts.service';
import { UserContractsController } from './user-contracts.controller';
import { UserContract } from './entities/user-contract.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { Contract } from 'src/contracts/entities/contract.entity';
import { ContractsUtilsService } from 'src/contracts/contracts.utils.service';
import { BlockchainState } from 'src/blockchains/entities/blockchain-state.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserContract,
      Blockchain,
      Contract,
      BlockchainState,
    ]),
  ],
  providers: [UserContractsService, ContractsUtilsService],
  controllers: [UserContractsController],
})
export class UserContractsModule {}
