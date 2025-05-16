import { ethers } from 'ethers';
import { Logger } from '@nestjs/common';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { abi as cacheManagerAbi } from '../abis/cacheManager/cacheManager.json';
import { abi as cacheManagerAutomationAbi } from '../abis/cacheManagerAutomation/CacheManagerAutomation.json';

const logger = new Logger('ProviderUtil');

/**
 * Contract types supported by the provider manager
 */
export enum ContractType {
  CACHE_MANAGER = 'cacheManager',
  CACHE_MANAGER_AUTOMATION = 'cacheManagerAutomation',
}

/**
 * A cache for ethers providers to avoid creating new instances
 */
export class ProviderManager {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private fastSyncProviders: Map<string, ethers.JsonRpcProvider> = new Map();
  private contracts: Map<string, Map<ContractType, ethers.Contract>> =
    new Map();

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
   * Gets a fast sync provider for a blockchain using the fastSyncRpcUrl if available,
   * otherwise falls back to the regular rpcUrl. Used for historical syncing operations.
   */
  getFastSyncProvider(blockchain: Blockchain): ethers.JsonRpcProvider {
    // Check for existing provider in the fast sync cache
    let provider = this.fastSyncProviders.get(blockchain.id);
    if (!provider) {
      // Use fastSyncRpcUrl if available, otherwise fall back to rpcUrl
      const rpcUrl = blockchain.fastSyncRpcUrl || blockchain.rpcUrl;
      if (!rpcUrl) {
        throw new Error(`Blockchain ${blockchain.id} has no RPC URL`);
      }

      provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
        polling: true,
        pollingInterval: 10000,
      });
      this.fastSyncProviders.set(blockchain.id, provider);
      logger.debug(
        `Created new fast sync provider for blockchain ${blockchain.id} using ${
          blockchain.fastSyncRpcUrl ? 'fastSyncRpcUrl' : 'rpcUrl'
        }`,
      );
    }

    return provider;
  }

  /**
   * Gets a contract instance for a blockchain and contract type, creating it if necessary
   */
  getContract(
    blockchain: Blockchain,
    contractType: ContractType,
  ): ethers.Contract {
    // Get contract address based on contract type
    let contractAddress: string;
    let contractAbi: ethers.InterfaceAbi;

    switch (contractType) {
      case ContractType.CACHE_MANAGER:
        if (!blockchain.cacheManagerAddress) {
          throw new Error(
            `Blockchain ${blockchain.id} has no CacheManager contract address`,
          );
        }
        contractAddress = blockchain.cacheManagerAddress;
        contractAbi = cacheManagerAbi;
        break;
      case ContractType.CACHE_MANAGER_AUTOMATION:
        if (!blockchain.cacheManagerAutomationAddress) {
          throw new Error(
            `Blockchain ${blockchain.id} has no CacheManagerAutomation contract address`,
          );
        }
        contractAddress = blockchain.cacheManagerAutomationAddress;
        contractAbi = cacheManagerAutomationAbi;
        break;
      default:
        throw new Error(`Unsupported contract type: ${String(contractType)}`);
    }

    // Initialize contracts map for this blockchain if it doesn't exist
    if (!this.contracts.has(blockchain.id)) {
      this.contracts.set(blockchain.id, new Map());
    }

    // Get or create the contract
    const blockchainContracts = this.contracts.get(blockchain.id);
    // This is safe because we just set it above if it doesn't exist
    let contract = blockchainContracts!.get(contractType);

    if (!contract) {
      const provider = this.getProvider(blockchain);
      contract = new ethers.Contract(contractAddress, contractAbi, provider);
      blockchainContracts!.set(contractType, contract);
      logger.debug(
        `Created new ${contractType} contract for blockchain ${blockchain.id}`,
      );
    }

    return contract;
  }

  /**
   * Gets a contract instance connected to the fast sync provider for a blockchain
   * and contract type, creating it if necessary. Used for historical operations.
   */
  getContractWithFastSyncProvider(
    blockchain: Blockchain,
    contractType: ContractType,
  ): ethers.Contract {
    // Get contract address based on contract type
    let contractAddress: string;
    let contractAbi: ethers.InterfaceAbi;

    switch (contractType) {
      case ContractType.CACHE_MANAGER:
        if (!blockchain.cacheManagerAddress) {
          throw new Error(
            `Blockchain ${blockchain.id} has no CacheManager contract address`,
          );
        }
        contractAddress = blockchain.cacheManagerAddress;
        contractAbi = cacheManagerAbi;
        break;
      case ContractType.CACHE_MANAGER_AUTOMATION:
        if (!blockchain.cacheManagerAutomationAddress) {
          throw new Error(
            `Blockchain ${blockchain.id} has no CacheManagerAutomation contract address`,
          );
        }
        contractAddress = blockchain.cacheManagerAutomationAddress;
        contractAbi = cacheManagerAutomationAbi;
        break;
      default:
        throw new Error(`Unsupported contract type: ${String(contractType)}`);
    }

    // Get the fast sync provider
    const provider = this.getFastSyncProvider(blockchain);

    // Create a new contract instance connected to the fast sync provider
    // (We don't cache these as they are only used for historical operations)
    const contract = new ethers.Contract(
      contractAddress,
      contractAbi,
      provider,
    );

    logger.debug(
      `Created contract with fast sync provider for ${contractType} on blockchain ${blockchain.id}`,
    );

    return contract;
  }

  /**
   * Clears all providers and contracts
   */
  clear(): void {
    this.providers.clear();
    this.fastSyncProviders.clear();
    this.contracts.clear();
    logger.debug('Cleared all providers and contracts');
  }

  /**
   * Removes all listeners from all contracts for a blockchain
   */
  async removeAllListeners(blockchainId: string): Promise<void> {
    const blockchainContracts = this.contracts.get(blockchainId);
    if (blockchainContracts) {
      try {
        const removePromises = Array.from(blockchainContracts.entries()).map(
          async ([contractType, contract]) => {
            await Promise.resolve(contract.removeAllListeners());
            logger.debug(
              `Removed all listeners for ${String(contractType)} contract on blockchain ${blockchainId}`,
            );
          },
        );

        await Promise.all(removePromises);
      } catch (error) {
        logger.error(
          `Error removing listeners for blockchain ${blockchainId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  /**
   * Removes all listeners from a specific contract type for a blockchain
   */
  async removeListeners(
    blockchainId: string,
    contractType: ContractType,
  ): Promise<void> {
    const blockchainContracts = this.contracts.get(blockchainId);
    if (blockchainContracts) {
      const contract = blockchainContracts.get(contractType);
      if (contract) {
        try {
          await Promise.resolve(contract.removeAllListeners());
          logger.debug(
            `Removed all listeners for ${String(contractType)} contract on blockchain ${blockchainId}`,
          );
        } catch (error) {
          logger.error(
            `Error removing listeners for ${String(contractType)} contract on blockchain ${blockchainId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }
  }
}
