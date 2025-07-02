import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blockchain } from '../entities/blockchain.entity';
import { BlockchainsErrorHelpers } from '../blockchains.errors';

@Injectable()
export class BlockchainInitializerService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainInitializerService.name);

  constructor(
    @InjectRepository(Blockchain)
    private readonly blockchainRepository: Repository<Blockchain>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Initialize blockchain configurations from config service
   */
  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('Initializing blockchain configurations');

      const blockchainsConfig = this.configService.get(
        'blockchains',
      ) as Blockchain[];

      if (!blockchainsConfig || !Array.isArray(blockchainsConfig)) {
        this.logger.warn(
          'No blockchain configurations found or invalid format',
        );
        return;
      }

      for (const blockchain of blockchainsConfig) {
        await this.upsertBlockchain(blockchain);
      }

      this.logger.log(
        `Successfully initialized ${blockchainsConfig.length} blockchain configurations`,
      );
    } catch (error) {
      this.logger.error('Error during blockchain initialization', error);
      BlockchainsErrorHelpers.throwConfigurationError(
        'Failed to initialize blockchain configurations',
      );
    }
  }

  /**
   * Insert or update blockchain configuration
   */
  private async upsertBlockchain(blockchain: Blockchain): Promise<void> {
    try {
      const existingBlockchain = await this.blockchainRepository.findOne({
        where: { chainId: blockchain.chainId },
      });

      if (!existingBlockchain) {
        await this.blockchainRepository.insert(blockchain);
        this.logger.log(
          `Inserted new blockchain configuration: ${blockchain.name} (chainId: ${blockchain.chainId})`,
        );
      } else {
        await this.blockchainRepository.update(
          { chainId: blockchain.chainId },
          {
            rpcUrl: blockchain.rpcUrl,
            rpcWssUrl: blockchain.rpcWssUrl,
            fastSyncRpcUrl: blockchain.fastSyncRpcUrl,
            cacheManagerAutomationAddress:
              blockchain.cacheManagerAutomationAddress,
            enabled: blockchain.enabled,
          },
        );
        this.logger.log(
          `Updated blockchain configuration: ${blockchain.name} (chainId: ${blockchain.chainId})`,
        );
      }
    } catch (error) {
      this.logger.error(`Error upserting blockchain ${blockchain.name}`, error);
      throw error;
    }
  }
}
