import { ethers } from 'ethers';
import { Logger } from '@nestjs/common';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { abi as cacheManagerAbi } from '../abis/cacheManager/cacheManager.json';
import { abi as cacheManagerAutomationAbi } from '../abis/cacheManagerAutomation/CacheManagerAutomation.json';
import { abi as arbWasmCacheAbi } from '../abis/arbWasmCache/arbWasmCache.json';
import { abi as arbWasmAbi } from '../abis/arbWasm/ArbWasm.json';

const logger = new Logger('ProviderUtil');

/**
 * Contract types supported by the provider manager
 */
export enum ContractType {
  CACHE_MANAGER = 'cacheManager',
  ARB_WASM_CACHE = 'arbWasmCache',
  ARB_WASM = 'arbWasm',
  CACHE_MANAGER_AUTOMATION = 'cacheManagerAutomation',
}

/**
 * A cache for ethers providers to avoid creating new instances
 */
export class ProviderManager {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private fastSyncProviders: Map<string, ethers.JsonRpcProvider> = new Map();
  private wssProviders: Map<string, ethers.WebSocketProvider> = new Map();
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
   * Gets a WebSocket provider for a blockchain, creating it if necessary.
   * This is specifically for event listeners to reduce polling and RPC request load.
   */
  getWssProvider(blockchain: Blockchain): ethers.WebSocketProvider {
    if (!blockchain.rpcWssUrl) {
      throw new Error(`Blockchain ${blockchain.id} has no WebSocket RPC URL`);
    }

    let provider = this.wssProviders.get(blockchain.id);
    if (!provider) {
      provider = new ethers.WebSocketProvider(blockchain.rpcWssUrl);

      // Store provider reference for the interval
      const wsProvider = provider;

      // Set up reconnection with a ping interval
      const pingInterval = setInterval(() => {
        // Check if provider is still in our map (not already removed)
        if (this.wssProviders.has(blockchain.id)) {
          // Send a simple request to check if connection is alive
          wsProvider.getBlockNumber().catch((error) => {
            logger.error(
              `WebSocket ping failed for blockchain ${blockchain.id}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            // Connection failed, clean up
            clearInterval(pingInterval);
            this.handleProviderDisconnect(blockchain.id);
          });
        } else {
          // Provider was already removed, clear the interval
          clearInterval(pingInterval);
        }
      }, 30000); // Check every 30 seconds

      this.wssProviders.set(blockchain.id, provider);
      logger.log(
        `Created new WebSocket provider for blockchain ${blockchain.id}`,
      );
    }

    return provider;
  }

  /**
   * Handles provider disconnection by removing it from the cache and cleaning up listeners
   */
  private handleProviderDisconnect(blockchainId: string): void {
    // Get provider before removing it
    const provider = this.wssProviders.get(blockchainId);

    // Remove the closed provider from the cache
    this.wssProviders.delete(blockchainId);

    // Properly clean up the provider if it exists
    if (provider) {
      try {
        // Destroy the provider to close any underlying connection
        provider.destroy();
      } catch (error) {
        logger.error(
          `Error destroying WebSocket provider for blockchain ${blockchainId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    // Remove associated contracts that use this provider
    this.removeAllListeners(blockchainId).catch((error) => {
      logger.error(
        `Error removing listeners for blockchain ${blockchainId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
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
      case ContractType.ARB_WASM_CACHE:
        if (!blockchain.arbWasmCacheAddress) {
          throw new Error(
            `Blockchain ${blockchain.id} has no ArbWasmCache contract address`,
          );
        }
        contractAddress = blockchain.arbWasmCacheAddress;
        contractAbi = arbWasmCacheAbi;
        break;
      case ContractType.ARB_WASM:
        if (!blockchain.arbWasmAddress) {
          throw new Error(
            `Blockchain ${blockchain.id} has no ArbWasm contract address`,
          );
        }
        contractAddress = blockchain.arbWasmAddress;
        contractAbi = arbWasmAbi;
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
   * Gets a contract instance connected to WebSocket provider for a blockchain
   * and contract type, creating it if necessary. Used for event listeners.
   */
  getContractWithWssProvider(
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

    // Get the WebSocket provider
    const provider = this.getWssProvider(blockchain);

    // Create a new contract instance connected to the WebSocket provider
    const contract = new ethers.Contract(
      contractAddress,
      contractAbi,
      provider,
    );

    logger.log(
      `Created contract with WebSocket provider for ${contractType} on blockchain ${blockchain.id}`,
    );

    return contract;
  }

  /**
   * Clears all providers and contracts
   */
  clear(): void {
    // Close all WebSocket connections before clearing
    this.wssProviders.forEach((provider, blockchainId) => {
      try {
        // Clean up the provider
        provider.destroy();
        logger.debug(
          `Closed WebSocket connection for blockchain ${blockchainId}`,
        );
      } catch (error) {
        logger.error(
          `Error closing WebSocket for blockchain ${blockchainId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });

    this.providers.clear();
    this.fastSyncProviders.clear();
    this.wssProviders.clear();
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
