import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blockchain } from '../entities/blockchain.entity';
import { BlockchainsErrorHelpers } from '../blockchains.errors';
import { createModuleLogger } from '../../common/utils/logger.util';
import { MODULE_NAME } from '../constants';

@Injectable()
export class BlockchainInitializerService implements OnModuleInit {
  private readonly logger = createModuleLogger(
    BlockchainInitializerService,
    MODULE_NAME,
  );

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
      this.logger.log('Starting blockchain module initialization...');

      const blockchainsConfig = this.configService.get(
        'blockchains',
      ) as Blockchain[];

      if (!blockchainsConfig || !Array.isArray(blockchainsConfig)) {
        this.logger.warn(
          'No blockchain configurations found or invalid format - skipping initialization',
        );
        return;
      }

      this.logger.debug(
        `Found ${blockchainsConfig.length} blockchain configurations to process`,
      );

      let insertedCount = 0;
      let updatedCount = 0;
      let errorCount = 0;

      for (const blockchain of blockchainsConfig) {
        try {
          const result = await this.upsertBlockchain(blockchain);
          if (result === 'inserted') {
            insertedCount++;
          } else {
            updatedCount++;
          }
        } catch (error) {
          errorCount++;
          const err = error as Error;
          this.logger.error(
            `Failed to upsert blockchain ${blockchain.name}: ${err.message}`,
            err.stack,
          );
        }
      }

      this.logger.log(
        `Blockchain initialization completed - Processed: ${blockchainsConfig.length}, Inserted: ${insertedCount}, Updated: ${updatedCount}, Errors: ${errorCount}`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Critical error during blockchain initialization: ${err.message}`,
        err.stack,
      );
      BlockchainsErrorHelpers.throwConfigurationError(
        'Failed to initialize blockchain configurations',
      );
    }
  }

  /**
   * Insert or update blockchain configuration
   * @returns 'inserted' | 'updated' to indicate the operation performed
   */
  private async upsertBlockchain(
    blockchain: Blockchain,
  ): Promise<'inserted' | 'updated'> {
    this.logger.debug(
      `Processing blockchain: ${blockchain.name} (chainId: ${blockchain.chainId})`,
    );

    try {
      const existingBlockchain = await this.blockchainRepository.findOne({
        where: { chainId: blockchain.chainId },
      });

      if (!existingBlockchain) {
        await this.blockchainRepository.insert(blockchain);
        this.logger.log(
          `Inserted new blockchain: ${blockchain.name} (chainId: ${blockchain.chainId}, enabled: ${blockchain.enabled})`,
        );
        this.logger.debug(
          `New blockchain details - Contract: ${blockchain.cacheManagerAutomationAddress || 'N/A'}`,
        );
        return 'inserted';
      } else {
        await this.blockchainRepository.update(
          { chainId: blockchain.chainId },
          {
            name: blockchain.name,
            rpcUrl: blockchain.rpcUrl,
            rpcWssUrl: blockchain.rpcWssUrl,
            rpcUrlBackup: blockchain.rpcUrlBackup,
            rpcWssUrlBackup: blockchain.rpcWssUrlBackup,
            fastSyncRpcUrl: blockchain.fastSyncRpcUrl,
            cacheManagerAutomationAddress:
              blockchain.cacheManagerAutomationAddress,
            enabled: blockchain.enabled,
          },
        );
        this.logger.log(
          `Updated existing blockchain: ${blockchain.name} (chainId: ${blockchain.chainId}, enabled: ${blockchain.enabled})`,
        );
        this.logger.debug(
          `Updated blockchain details - Contract: ${blockchain.cacheManagerAutomationAddress || 'N/A'}`,
        );
        return 'updated';
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to upsert blockchain ${blockchain.name} (chainId: ${blockchain.chainId}): ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }
}
