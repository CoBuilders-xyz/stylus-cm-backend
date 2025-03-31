import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bytecode } from './entities/bytecode.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Bytecode])],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
