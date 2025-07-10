import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { ProviderManager } from 'src/common/utils/provider.util';
import { EngineUtil } from 'src/cma/utils/engine.util';
import { CmaService } from './cma.service';
import {
  ContractSelectionService,
  BatchProcessorService,
  AutomationOrchestratorService,
} from './services';
import cmaConfig from './cma.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Blockchain]),
    HttpModule,
    ConfigModule.forFeature(cmaConfig),
  ],
  providers: [
    CmaService,
    ContractSelectionService,
    BatchProcessorService,
    AutomationOrchestratorService,
    ProviderManager,
    EngineUtil,
  ],
  exports: [CmaService],
})
export class CmaModule {}

//TEst
