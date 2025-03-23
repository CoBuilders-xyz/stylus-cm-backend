import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractBytecode } from './entities/contract-bytecode.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContractBytecode])],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
