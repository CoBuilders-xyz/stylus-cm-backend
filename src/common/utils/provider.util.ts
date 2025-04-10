import { ethers } from 'ethers';
import { Logger } from '@nestjs/common';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { abi } from '../abis/cacheManager/cacheManager.json';

const logger = new Logger('ProviderUtil');

/**
 * A cache for ethers providers to avoid creating new instances
 */
export class ProviderManager {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private contracts: Map<string, ethers.Contract> = new Map();

  /**
   * Gets a provider for a blockchain, creating it if necessary
   */
  getProvider(blockchain: Blockchain): ethers.JsonRpcProvider {
    if (!blockchain.rpcUrl) {
      throw new Error(`Blockchain ${blockchain.id} has no RPC URL`);
    }

    let provider = this.providers.get(blockchain.id);
    if (!provider) {
      provider = new ethers.JsonRpcProvider(blockchain.rpcUrl, undefined, {
        polling: true,
        pollingInterval: 10000,
      });
      this.providers.set(blockchain.id, provider);
      logger.debug(`Created new provider for blockchain ${blockchain.id}`);
    }

    return provider;
  }

  /**
   * Gets a contract instance for a blockchain, creating it if necessary
   */
  getContract(blockchain: Blockchain): ethers.Contract {
    if (!blockchain.cacheManagerAddress) {
      throw new Error(`Blockchain ${blockchain.id} has no contract address`);
    }

    let contract = this.contracts.get(blockchain.id);
    if (!contract) {
      const provider = this.getProvider(blockchain);
      contract = new ethers.Contract(
        blockchain.cacheManagerAddress,
        abi as ethers.InterfaceAbi,
        provider,
      );
      this.contracts.set(blockchain.id, contract);
      logger.debug(`Created new contract for blockchain ${blockchain.id}`);
    }

    return contract;
  }

  /**
   * Clears all providers and contracts
   */
  clear(): void {
    this.providers.clear();
    this.contracts.clear();
    logger.debug('Cleared all providers and contracts');
  }

  /**
   * Removes all listeners from a contract
   */
  async removeListeners(blockchainId: string): Promise<void> {
    const contract = this.contracts.get(blockchainId);
    if (contract) {
      try {
        await Promise.resolve(contract.removeAllListeners());
        logger.debug(`Removed all listeners for blockchain ${blockchainId}`);
      } catch (error) {
        logger.error(
          `Error removing listeners for blockchain ${blockchainId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
}
