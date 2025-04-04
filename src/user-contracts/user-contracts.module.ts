import { Module } from '@nestjs/common';
import { UserContractsService } from './user-contracts.service';
import { UserContractsController } from './user-contracts.controller';
import { UserContract } from './entities/user-contract.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserContract, Blockchain])],
  providers: [UserContractsService],
  controllers: [UserContractsController],
})
export class UserContractsModule {}
