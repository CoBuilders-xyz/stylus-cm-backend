import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bytecode } from './entities/bytecode.entity';
import { Contract } from './entities/contract.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Bytecode, Contract])],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
