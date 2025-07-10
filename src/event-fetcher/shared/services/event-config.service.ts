import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blockchain } from '../../../blockchains/entities/blockchain.entity';
import { EventFetcherConfig } from '../interfaces';

@Injectable()
export class EventConfigService {
  // Default event types to monitor
  private readonly DEFAULT_EVENT_TYPES = [
    'InsertBid',
    'DeleteBid',
    'Pause',
    'Unpause',
    'SetCacheSize',
    'SetDecayRate',
    'Initialized',
  ];

  // Default config values
  private readonly DEFAULT_CONFIG: EventFetcherConfig = {
    resyncBlocksBack: 100,
    eventTypes: this.DEFAULT_EVENT_TYPES,
    batchSize: 50,
    retries: 3,
    retryDelay: 2000,
  };

  constructor(
    @InjectRepository(Blockchain)
    private readonly blockchainRepository: Repository<Blockchain>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Initializes blockchain configurations from environment
   */
  async initializeBlockchains(): Promise<Blockchain[]> {
    const config = this.configService.get('blockchains') as Blockchain[];

    if (!config || !Array.isArray(config)) {
      return [];
    }

    for (const blockchain of config) {
      const existingBlockchain = await this.blockchainRepository.findOne({
        where: { chainId: blockchain.chainId, rpcUrl: blockchain.rpcUrl },
      });

      if (!existingBlockchain) {
        await this.blockchainRepository.insert(blockchain);
      }
    }

    return this.blockchainRepository.find();
  }

  /**
   * Gets all configured blockchains
   */
  async getBlockchains(): Promise<Blockchain[]> {
    return this.blockchainRepository.find({
      where: { enabled: true },
    });
  }

  /**
   * Gets event fetcher configuration
   */
  getEventFetcherConfig(): EventFetcherConfig {
    const config = this.configService.get(
      'eventFetcher',
    ) as Partial<EventFetcherConfig>;

    // Merge with defaults
    return {
      ...this.DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Gets the event types to monitor
   */
  getEventTypes(): string[] {
    return this.getEventFetcherConfig().eventTypes;
  }

  /**
   * Gets the number of blocks to look back during periodic resync
   */
  getResyncBlocksBack(): number {
    return this.getEventFetcherConfig().resyncBlocksBack;
  }

  /**
   * Gets the batch size for processing events
   */
  getBatchSize(): number {
    return this.getEventFetcherConfig().batchSize;
  }

  /**
   * Gets the number of retries for failed operations
   */
  getRetries(): number {
    return this.getEventFetcherConfig().retries;
  }

  /**
   * Gets the delay between retries in milliseconds
   */
  getRetryDelay(): number {
    return this.getEventFetcherConfig().retryDelay;
  }
}
