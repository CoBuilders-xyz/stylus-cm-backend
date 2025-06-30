import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { Blockchain } from '../../../blockchains/entities/blockchain.entity';
import {
  ContractType,
  ProviderManager,
} from '../../../common/utils/provider.util';
import { WebSocketContracts } from '../interfaces';
import { EventFetcherErrorHelpers } from '../../event-fetcher.errors';
import { createModuleLogger } from '../../../common/utils/logger.util';
import { MODULE_NAME } from '../../constants/module.constants';

@Injectable()
export class WebSocketManagerService {
  private readonly logger = createModuleLogger(
    WebSocketManagerService,
    MODULE_NAME,
  );

  constructor(private readonly providerManager: ProviderManager) {}

  /**
   * Creates WebSocket contracts for a blockchain
   */
  createWebSocketContracts(blockchain: Blockchain): WebSocketContracts {
    if (!blockchain.rpcWssUrl || !blockchain.cacheManagerAddress) {
      if (!blockchain.rpcWssUrl) {
        EventFetcherErrorHelpers.throwMissingWebSocketUrl();
      }
      if (!blockchain.cacheManagerAddress) {
        EventFetcherErrorHelpers.throwMissingContractAddress();
      }
    }

    let cacheManagerContract: ethers.Contract;
    let cacheManagerAutomationContract: ethers.Contract;

    try {
      cacheManagerContract = this.providerManager.getContractWithWssProvider(
        blockchain,
        ContractType.CACHE_MANAGER,
      );
      this.logger.debug(
        `Created WebSocket CacheManager contract for blockchain ${blockchain.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create WebSocket contract for CacheManager on blockchain ${blockchain.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }

    try {
      cacheManagerAutomationContract =
        this.providerManager.getContractWithWssProvider(
          blockchain,
          ContractType.CACHE_MANAGER_AUTOMATION,
        );
      this.logger.debug(
        `Created WebSocket CacheManagerAutomation contract for blockchain ${blockchain.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create WebSocket contract for CacheManagerAutomation on blockchain ${blockchain.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }

    return {
      cacheManagerContract,
      cacheManagerAutomationContract,
    };
  }

  /**
   * Removes all listeners from WebSocket contracts
   */
  async removeAllListeners(contracts: WebSocketContracts): Promise<void> {
    try {
      await contracts.cacheManagerContract.removeAllListeners();
      await contracts.cacheManagerAutomationContract.removeAllListeners();
      this.logger.debug('Removed all listeners from WebSocket contracts');
    } catch (error) {
      this.logger.error(
        `Failed to remove listeners: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  /**
   * Validates blockchain WebSocket configuration
   */
  validateWebSocketConfig(blockchain: Blockchain): boolean {
    if (!blockchain.rpcWssUrl) {
      this.logger.warn(`Blockchain ${blockchain.id} missing WebSocket URL`);
      return false;
    }

    if (!blockchain.cacheManagerAddress) {
      this.logger.warn(`Blockchain ${blockchain.id} missing contract address`);
      return false;
    }

    return true;
  }
}
