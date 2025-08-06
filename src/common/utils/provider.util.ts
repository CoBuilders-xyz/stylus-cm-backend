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
 * Callback type for handling provider reconnection
 */
export type ReconnectionCallback = (blockchainId: string) => Promise<void>;

/**
 * A cache for ethers providers to avoid creating new instances
 */
export class ProviderManager {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private fastSyncProviders: Map<string, ethers.JsonRpcProvider> = new Map();
  private wssProviders: Map<string, ethers.WebSocketProvider> = new Map();
  private contracts: Map<string, Map<ContractType, ethers.Contract>> =
    new Map();

  // Reconnection management
  private reconnectionCallbacks: ReconnectionCallback[] = [];
  private reconnectionAttempts: Map<string, number> = new Map();
  private reconnectionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private baseReconnectionDelay = 5000; // 5 seconds
  private maxReconnectionDelay = 300000; // 5 minutes maximum delay

  // WebSocket failure tracking for backup fallback
  private wssFailureCount: Map<string, number> = new Map();

  /**
   * Get WebSocket connection state for debugging
   */
  getWebSocketState(blockchainId: string): string {
    const provider = this.wssProviders.get(blockchainId);
    if (!provider || !provider.websocket) {
      return 'No WebSocket provider';
    }

    const readyStates = {
      0: 'CONNECTING',
      1: 'OPEN',
      2: 'CLOSING',
      3: 'CLOSED',
    };

    return (
      readyStates[provider.websocket.readyState as 0 | 1 | 2 | 3] ||
      `Unknown (${provider.websocket.readyState})`
    );
  }

  /**
   * Check all WebSocket connections and log their states
   */
  checkAllWebSocketConnections(): void {
    logger.log('Checking all WebSocket connections:');
    this.wssProviders.forEach((provider, blockchainId) => {
      const state = this.getWebSocketState(blockchainId);
      logger.log(`  Blockchain ${blockchainId}: ${state}`);
    });
  }

  /**
   * Register a callback to be called when a provider disconnects and needs reconnection
   */
  registerReconnectionCallback(callback: ReconnectionCallback): void {
    this.reconnectionCallbacks.push(callback);
  }

  /**
   * Unregister a reconnection callback
   */
  unregisterReconnectionCallback(callback: ReconnectionCallback): void {
    const index = this.reconnectionCallbacks.indexOf(callback);
    if (index > -1) {
      this.reconnectionCallbacks.splice(index, 1);
    }
  }

  /**
   * Gets a provider for a blockchain, creating it if necessary
   */
  getProvider(blockchain: Blockchain): ethers.JsonRpcProvider {
    if (!blockchain.rpcUrl) {
      throw new Error(`Blockchain ${blockchain.id} has no RPC URL`);
    }

    let provider = this.providers.get(blockchain.id);
    if (!provider) {
      // Create network object for consistent network specification
      const network = ethers.Network.from({
        name: blockchain.name,
        chainId: blockchain.chainId,
      });
      provider = new ethers.JsonRpcProvider(blockchain.rpcUrl, network, {
        staticNetwork: network, // Prevent network detection
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

      // Create network object for consistent network specification
      const network = ethers.Network.from({
        name: blockchain.name,
        chainId: blockchain.chainId,
      });

      provider = new ethers.JsonRpcProvider(rpcUrl, network);
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
    const failureCount = this.wssFailureCount.get(blockchain.id) || 0;
    const mainUrl = blockchain.rpcWssUrl;
    const backupUrl = blockchain.rpcWssUrlBackup;
    const shouldUseBackup = failureCount === 2 && backupUrl;
    const wssUrl = shouldUseBackup ? backupUrl : mainUrl;
    if (!wssUrl) {
      throw new Error(`Blockchain ${blockchain.id} has no WebSocket RPC URL`);
    }

    let provider = this.wssProviders.get(blockchain.id);
    if (!provider) {
      logger.log(
        `Creating WebSocket provider for blockchain ${blockchain.id} using ${shouldUseBackup ? 'backup' : 'primary'} URL`,
      );

      // Create network object for consistent network specification
      const network = ethers.Network.from({
        name: blockchain.name,
        chainId: blockchain.chainId,
      });

      provider = new ethers.WebSocketProvider(wssUrl, network, {
        staticNetwork: network, // Prevent network detection
      });

      // Store provider reference for the interval
      const wsProvider = provider;

      // Set up reconnection with a ping interval
      const pingInterval = setInterval(() => {
        const connectionState = this.getWebSocketState(blockchain.id);
        logger.log(
          `Pinging WebSocket provider for blockchain ${blockchain.name} (state: ${connectionState})`,
        );
        // Check if provider is still in our map (not already removed)
        if (this.wssProviders.has(blockchain.id)) {
          // Check WebSocket connection state first
          if (wsProvider.websocket && wsProvider.websocket.readyState !== 1) {
            logger.warn(
              `WebSocket connection is not open for blockchain ${blockchain.id}, readyState: ${wsProvider.websocket.readyState} (${connectionState})`,
            );
            clearInterval(pingInterval);
            this.incrementFailureAndReconnect(blockchain);
            return;
          }

          // Create a timeout promise that rejects after 10 seconds
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error('WebSocket ping timeout after 10 seconds'));
            }, 10000);
          });

          // Race the getBlockNumber call against the timeout
          Promise.race([wsProvider.getBlockNumber(), timeoutPromise])
            .then((blockNumber) => {
              logger.log(
                `WebSocket ping successful for blockchain ${blockchain.name}: blockNumber=${blockNumber}`,
              );
            })
            .catch((error) => {
              logger.error(
                `WebSocket ping failed for blockchain ${blockchain.id}: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
              // Connection failed, clean up
              clearInterval(pingInterval);
              this.incrementFailureAndReconnect(blockchain);
            });
        } else {
          // Provider was already removed, clear the interval
          clearInterval(pingInterval);
          return;
        }
      }, 15000); // Check every 15 seconds for faster disconnection detection

      this.wssProviders.set(blockchain.id, provider);
      logger.log(
        `Created new WebSocket provider for blockchain ${blockchain.id}`,
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
    // Cancel all pending reconnection attempts
    this.reconnectionTimeouts.forEach((timeout, blockchainId) => {
      clearTimeout(timeout);
      logger.debug(
        `Cancelled reconnection attempts for blockchain ${blockchainId}`,
      );
    });
    this.reconnectionTimeouts.clear();
    this.reconnectionAttempts.clear();

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
    this.wssFailureCount.clear();
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
   * Handles provider disconnection by removing it from the cache and cleaning up listeners
   */
  private handleWssProviderReconnect(blockchain: Blockchain): void {
    const blockchainId = blockchain.id;
    logger.warn(
      `WebSocket provider disconnected for blockchain ${blockchainId}`,
    );

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

    // Trigger automatic reconnection
    this.attemptReconnection(blockchain);
  }

  /**
   * Attempts to reconnect to a blockchain with exponential backoff
   */
  private attemptReconnection(blockchain: Blockchain): void {
    const blockchainId = blockchain.id;
    const currentAttempts = this.reconnectionAttempts.get(blockchainId) || 0;

    const calculatedDelay =
      this.baseReconnectionDelay * Math.pow(2, currentAttempts);
    const delay = Math.min(calculatedDelay, this.maxReconnectionDelay);
    this.reconnectionAttempts.set(blockchainId, currentAttempts + 1);

    logger.log(
      `Attempting reconnection ${currentAttempts + 1} for blockchain ${blockchainId} in ${delay}ms`,
    );

    const timeout = setTimeout(() => {
      // Clear the timeout from our tracking
      this.reconnectionTimeouts.delete(blockchainId);

      // Notify all registered callbacks about the reconnection attempt
      const reconnectionPromises = this.reconnectionCallbacks.map((callback) =>
        callback(blockchainId).catch((error) => {
          logger.error(
            `Reconnection callback failed for blockchain ${blockchainId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }),
      );

      Promise.allSettled(reconnectionPromises)
        .then(() => {
          // Reset reconnection attempts on successful reconnection
          this.reconnectionAttempts.delete(blockchainId);
          logger.log(`Successfully reconnected to blockchain ${blockchainId}`);
        })
        .catch((error) => {
          logger.error(
            `Reconnection attempt failed for blockchain ${blockchainId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );

          // Schedule next reconnection attempt
          this.attemptReconnection(blockchain);
        });
    }, delay);

    this.reconnectionTimeouts.set(blockchainId, timeout);
  }

  private incrementFailureAndReconnect(blockchain: Blockchain): void {
    const blockchainId = blockchain.id;
    const currentFailureCount = this.wssFailureCount.get(blockchainId) || 0;
    this.wssFailureCount.set(blockchainId, currentFailureCount + 1);
    logger.warn(
      `WebSocket provider failed for blockchain ${blockchainId} (failure count: ${currentFailureCount + 1})`,
    );

    // Call the existing reconnection handler
    this.handleWssProviderReconnect(blockchain);
  }
}
