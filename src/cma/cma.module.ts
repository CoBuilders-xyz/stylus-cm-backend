import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { ProviderManager } from 'src/common/utils/provider.util';
import { EngineUtil } from 'src/cma/utils/engine.util';
import { CmaService } from './cma.service';

@Module({
  imports: [TypeOrmModule.forFeature([Blockchain]), HttpModule],
  providers: [CmaService, ProviderManager, EngineUtil],
  exports: [CmaService],
})
export class CmaModule {}

//TEst
