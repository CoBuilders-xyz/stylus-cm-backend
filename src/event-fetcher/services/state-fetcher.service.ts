import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { EventConfigService } from './event-config.service';
import { ProviderManager } from '../utils/provider.util';
import { safeContractCall } from '../utils/contract-call.util';

/**
 * Service to fetch state data from blockchains periodically
 * This service handles the 'getEntries' call that was failing in the logs
 */
@Injectable()
export class StateFetcherService {
  private readonly logger = new Logger(StateFetcherService.name);

  constructor(
    private readonly eventConfigService: EventConfigService,
    private readonly providerManager: ProviderManager,
  ) {}

  /**
   * Poll blockchain state every minute
   */
  @Cron('0 * * * * *')
  async pollBlockchainState(): Promise<void> {
    try {
      const blockchains = await this.eventConfigService.getBlockchains();

      for (const blockchain of blockchains) {
        await this.fetchStateForBlockchain(blockchain).catch((error) => {
          this.logger.error(
            `Error polling blockchain ${blockchain.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        });
      }
    } catch (error) {
      this.logger.error(
        `Error in blockchain state polling: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Fetch state for a specific blockchain
   */
  async fetchStateForBlockchain(blockchain: Blockchain): Promise<void> {
    if (!blockchain.rpcUrl || !blockchain.cacheManagerAddress) {
      this.logger.warn(
        `Skipping blockchain ${blockchain.id} due to missing RPC URL or contract address.`,
      );
      return;
    }

    const contract = this.providerManager.getContract(blockchain);

    try {
      // Safely call getEntries with retry and fallback
      const entries = await safeContractCall<any[]>(
        contract,
        'getEntries',
        [],
        {
          retries: 2,
          retryDelay: 1000,
          fallbackValue: [], // Use empty array as fallback if the call fails
        },
      );

      if (entries && Array.isArray(entries)) {
        this.logger.debug(
          `Successfully fetched ${entries.length} entries from blockchain ${blockchain.id}`,
        );

        // Process entries if needed
        // ...
      } else {
        this.logger.warn(
          `No valid entries returned from blockchain ${blockchain.id}`,
        );
      }
    } catch (error) {
      // This will only happen if all retries fail and there's no fallback value
      this.logger.error(
        `Failed to fetch entries from blockchain ${blockchain.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Manually fetch state for all blockchains
   */
  async manualFetchState(): Promise<string> {
    const blockchains = await this.eventConfigService.getBlockchains();
    let successCount = 0;
    let errorCount = 0;

    for (const blockchain of blockchains) {
      try {
        await this.fetchStateForBlockchain(blockchain);
        successCount++;
      } catch (error) {
        errorCount++;
        this.logger.error(
          `Error fetching state for blockchain ${blockchain.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return `State fetch completed: ${successCount} successful, ${errorCount} failed`;
  }
}
