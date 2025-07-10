import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import { Blockchain } from '../../../blockchains/entities/blockchain.entity';
import { EthersEvent } from '../../shared/interfaces';
import { EventProcessorService } from '../../shared';
import { ProviderManager } from '../../../common/utils/provider.util';
import { createModuleLogger } from '../../../common/utils/logger.util';
import { MODULE_NAME } from '../../constants/module.constants';
import { RedisConfig } from '../../../common/config/redis.config';

export interface EventQueueItem {
  blockchain: Blockchain;
  eventLog: EthersEvent;
  // provider: ethers.JsonRpcProvider; // REMOVED: Can't serialize provider to Redis
  eventType: string;
  eventData: Record<string, any>; // Store event arguments before Redis serialization
  blockNumber: number;
  logIndex: number;
  timestamp: Date;
  receivedAt: Date; // When we received this event
}

export interface BufferStatus {
  totalBlocks: number;
  totalEvents: number;
  oldestEventAge: number;
}

export interface QueueMetrics {
  blockchainId: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  bufferStatus: BufferStatus;
  lastProcessedAt?: Date;
}

@Injectable()
export class EventQueueService implements OnModuleDestroy {
  private readonly logger = createModuleLogger(EventQueueService, MODULE_NAME);
  private readonly eventQueues = new Map<string, Queue>();
  private readonly eventWorkers = new Map<string, Worker>();
  private readonly sortingBuffers = new Map<
    string,
    Map<number, EventQueueItem[]>
  >(); // blockNumber -> events
  private readonly flushTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly redisConfig: RedisConfig;

  constructor(
    private readonly eventProcessor: EventProcessorService,
    private readonly providerManager: ProviderManager,
    private readonly configService: ConfigService,
  ) {
    // Get the global Redis configuration
    this.redisConfig = this.configService.get<RedisConfig>('redis')!;
  }

  enqueueEvent(blockchain: Blockchain, event: EventQueueItem): void {
    // Use sorting buffer first, then add to BullMQ queue
    this.enqueueWithSorting(blockchain, event);
  }

  // Get queue metrics from BullMQ
  async getQueueMetrics(blockchainId: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.eventQueues.get(blockchainId);
    if (!queue) {
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }

    return {
      waiting: await queue.getWaiting().then((jobs) => jobs.length),
      active: await queue.getActive().then((jobs) => jobs.length),
      completed: await queue.getCompleted().then((jobs) => jobs.length),
      failed: await queue.getFailed().then((jobs) => jobs.length),
      delayed: await queue.getDelayed().then((jobs) => jobs.length),
    };
  }

  // Get detailed metrics for monitoring
  async getDetailedMetrics(): Promise<QueueMetrics[]> {
    const metrics: QueueMetrics[] = [];

    for (const [blockchainId] of this.eventQueues.entries()) {
      const basicMetrics = await this.getQueueMetrics(blockchainId);

      metrics.push({
        blockchainId,
        ...basicMetrics,
        bufferStatus: this.getBufferStatus(blockchainId),
        lastProcessedAt: await this.getLastProcessedTime(blockchainId),
      });
    }

    return metrics;
  }

  // Cleanup resources
  async cleanup(): Promise<void> {
    for (const [blockchainId, worker] of this.eventWorkers.entries()) {
      await worker.close();
      this.logger.debug(`🧹 Closed worker for blockchain ${blockchainId}`);
    }

    for (const [blockchainId, queue] of this.eventQueues.entries()) {
      await queue.close();
      this.logger.debug(`🧹 Closed queue for blockchain ${blockchainId}`);
    }

    // Clear timeouts
    for (const timeout of this.flushTimeouts.values()) {
      clearTimeout(timeout);
    }

    this.logger.log('🧹 EventQueueService cleanup completed');
  }

  // OnModuleDestroy lifecycle hook
  async onModuleDestroy(): Promise<void> {
    await this.cleanup();
  }

  // Initialize BullMQ queue and worker for a blockchain
  private initializeQueueForBlockchain(blockchainId: string): void {
    if (this.eventQueues.has(blockchainId)) return;

    // Create BullMQ queue using global Redis configuration
    const queue = new Queue(`events-${blockchainId}`, {
      connection: this.redisConfig.connection,
      defaultJobOptions: {
        ...this.redisConfig.defaultJobOptions,
        // Override specific options for event processing
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: 3, // Retry failed jobs 3 times
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    // Create worker for sequential processing using global Redis configuration
    const worker = new Worker(
      `events-${blockchainId}`,
      async (job: Job<EventQueueItem>) => {
        return this.processEventSequentially(job.data);
      },
      {
        connection: this.redisConfig.connection,
        concurrency: 1, // CRITICAL: Only 1 job at a time for sequential processing
      },
    );

    // Add event listeners for monitoring
    worker.on('completed', (job) => {
      this.logger.debug(
        `Completed processing ${job.data.eventType} for block ${job.data.blockNumber} logIndex ${job.data.logIndex}`,
      );
    });

    worker.on('failed', (job, err) => {
      this.logger.error(
        `Failed processing ${job?.data?.eventType} for block ${job?.data?.blockNumber}: ${err.message}`,
      );
    });

    worker.on('stalled', (jobId) => {
      this.logger.warn(`Job ${jobId} stalled`);
    });

    this.eventQueues.set(blockchainId, queue);
    this.eventWorkers.set(blockchainId, worker);

    this.logger.log(
      `Initialized BullMQ queue and worker for blockchain ${blockchainId}`,
    );
  }

  private async processEventSequentially(item: EventQueueItem): Promise<void> {
    this.logger.debug(
      `Processing event: ${item.eventType} 
       Block ${item.blockNumber} LogIndex ${item.logIndex}
       Blockchain: ${item.blockchain.id}`,
    );

    // Recreate the provider since it can't be serialized through Redis
    const provider = this.providerManager.getProvider(item.blockchain);

    // Delegate to existing EventProcessorService
    await this.eventProcessor.processEvent(
      item.blockchain,
      item.eventLog,
      provider,
      item.eventType,
      item.eventData,
    );
  }

  // Buffer events from same block and process when complete/timeout
  private enqueueWithSorting(
    blockchain: Blockchain,
    event: EventQueueItem,
  ): void {
    const blockchainId = blockchain.id;
    const blockNumber = event.blockNumber;

    // Initialize queue if needed
    this.initializeQueueForBlockchain(blockchainId);

    // DEBUG: Track event arrival
    this.logger.debug(
      `BUFFERING EVENT - ${blockchain.id} Block ${blockNumber} LogIndex ${event.logIndex} Type ${event.eventType}
       Received at: ${event.receivedAt.toISOString()}`,
    );

    // Add to sorting buffer
    if (!this.sortingBuffers.has(blockchainId)) {
      this.sortingBuffers.set(blockchainId, new Map());
      this.logger.debug(
        `Created sorting buffer for blockchain ${blockchainId}`,
      );
    }

    const blockchainBuffer = this.sortingBuffers.get(blockchainId)!;
    if (!blockchainBuffer.has(blockNumber)) {
      blockchainBuffer.set(blockNumber, []);
      this.logger.debug(
        `Created block buffer for ${blockchainId} block ${blockNumber}`,
      );
    }

    const currentBlockEvents = blockchainBuffer.get(blockNumber)!;
    currentBlockEvents.push(event);

    // DEBUG: Check if this event arrived out of order
    if (currentBlockEvents.length > 1) {
      const lastEvent = currentBlockEvents[currentBlockEvents.length - 2];
      if (event.logIndex < lastEvent.logIndex) {
        this.logger.warn(
          `OUT-OF-ORDER ARRIVAL - ${blockchainId} Block ${blockNumber}:
           Previous: ${lastEvent.eventType}(${lastEvent.logIndex}) at ${lastEvent.receivedAt.toISOString()}
           Current:  ${event.eventType}(${event.logIndex}) at ${event.receivedAt.toISOString()}
           Delay: ${event.receivedAt.getTime() - lastEvent.receivedAt.getTime()}ms`,
        );
      }
    }

    // DEBUG: Show current buffer state
    const bufferState = currentBlockEvents
      .map((e) => `${e.eventType}(${e.logIndex})`)
      .join(', ');
    this.logger.debug(
      `Buffer state for block ${blockNumber}: [${bufferState}] (${currentBlockEvents.length} events)`,
    );

    // Clear existing timeout for this block
    const timeoutKey = `${blockchainId}_${blockNumber}`;
    const existingTimeout = this.flushTimeouts.get(timeoutKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout to flush this block's events
    const timeout = setTimeout(() => {
      this.flushBlockEventsToBullMQ(blockchainId, blockNumber);
    }, 2000); // 2 second timeout

    this.flushTimeouts.set(timeoutKey, timeout);
  }

  private async flushBlockEventsToBullMQ(
    blockchainId: string,
    blockNumber: number,
  ): Promise<void> {
    const blockchainBuffer = this.sortingBuffers.get(blockchainId);
    if (!blockchainBuffer?.has(blockNumber)) {
      this.logger.debug(
        `No events to flush for ${blockchainId} block ${blockNumber}`,
      );
      return;
    }

    const blockEvents = blockchainBuffer.get(blockNumber)!;

    // DEBUG: Track flush trigger
    const eventsToFlush = blockEvents
      .map((e) => `${e.eventType}(${e.logIndex})`)
      .join(', ');

    this.logger.log(
      `FLUSHING TO BULLMQ - Block ${blockNumber}
       Events to queue: [${eventsToFlush}] (${blockEvents.length} total)
       Time since first event: ${
         blockEvents.length > 0
           ? Date.now() - blockEvents[0].receivedAt.getTime()
           : 0
       }ms`,
    );

    blockchainBuffer.delete(blockNumber);

    if (blockEvents.length === 0) {
      this.logger.debug(`No events in block ${blockNumber} buffer, skipping`);
      return;
    }

    // Sort events from this block by log index
    const sortedEvents = this.sortEventsByBlockAndLogIndex(blockEvents);

    // 🐛 DEBUG: Show processing order
    const processingOrder = sortedEvents
      .map((e) => `${e.eventType}(${e.logIndex})`)
      .join(' → ');
    this.logger.log(
      `QUEUEING ORDER for block ${blockNumber}: ${processingOrder}`,
    );

    // Add events to BullMQ queue in sorted order
    const queue = this.eventQueues.get(blockchainId)!;

    for (const event of sortedEvents) {
      const jobName = `${event.eventType}_${event.blockNumber}_${event.logIndex}`;
      const priority = this.calculateJobPriority(
        event.blockNumber,
        event.logIndex,
      );

      await queue.add(jobName, event, {
        priority, // Higher priority = processed first
        delay: 0,
      });

      this.logger.debug(
        `Added to BullMQ: ${jobName} with priority ${priority}`,
      );
    }

    // Clean up timeout
    const timeoutKey = `${blockchainId}_${blockNumber}`;
    this.flushTimeouts.delete(timeoutKey);
  }

  // Calculate job priority to ensure proper ordering (higher number = higher priority)
  private calculateJobPriority(blockNumber: number, logIndex: number): number {
    // BullMQ priority limit is 2,097,152
    // Use a smaller multiplier to avoid exceeding the limit
    // This still ensures proper ordering: older blocks get lower priority
    const MAX_PRIORITY = 2097152;
    const LOG_INDEX_RANGE = 1000; // Assume max 1000 events per block

    // Calculate relative priority within the limit
    // Use modulo to handle very large block numbers
    const blockPriority = (blockNumber % 2000) * LOG_INDEX_RANGE; // Max 2,000,000
    const priority = blockPriority + logIndex;

    // Ensure we don't exceed the maximum
    return Math.min(priority, MAX_PRIORITY - 1);
  }

  private sortEventsByBlockAndLogIndex(
    events: EventQueueItem[],
  ): EventQueueItem[] {
    // 🐛 DEBUG: Log original order vs sorted order
    const originalOrder = events
      .map((e) => `${e.eventType}(${e.logIndex})`)
      .join(', ');

    const sortedEvents = events.sort((a, b) => {
      // First sort by block number
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber - b.blockNumber;
      }
      // Then sort by log index within the same block
      return a.logIndex - b.logIndex;
    });

    const sortedOrder = sortedEvents
      .map((e) => `${e.eventType}(${e.logIndex})`)
      .join(', ');

    if (originalOrder !== sortedOrder) {
      this.logger.warn(
        `EVENT REORDERING DETECTED - Block ${events[0]?.blockNumber}:
         Original: [${originalOrder}]
         Sorted:   [${sortedOrder}]`,
      );
    } else {
      this.logger.debug(
        `Events already in order - Block ${events[0]?.blockNumber}: [${originalOrder}]`,
      );
    }

    return sortedEvents;
  }

  private getBufferStatus(blockchainId: string): BufferStatus {
    const buffer = this.sortingBuffers.get(blockchainId);
    if (!buffer) return { totalBlocks: 0, totalEvents: 0, oldestEventAge: 0 };

    let totalEvents = 0;
    let oldestEventAge = 0;

    for (const [, events] of buffer.entries()) {
      totalEvents += events.length;
      if (events.length > 0) {
        const age = Date.now() - events[0].receivedAt.getTime();
        oldestEventAge = Math.max(oldestEventAge, age);
      }
    }

    return {
      totalBlocks: buffer.size,
      totalEvents,
      oldestEventAge,
    };
  }

  private async getLastProcessedTime(
    blockchainId: string,
  ): Promise<Date | undefined> {
    const queue = this.eventQueues.get(blockchainId);
    if (!queue) return undefined;

    try {
      const completedJobs = await queue.getCompleted(0, 0); // Get latest completed job
      if (completedJobs.length > 0) {
        // Handle BullMQ job type safely - jobs have a processedOn property
        const job = completedJobs[0] as { processedOn?: number };
        const processedOn = job.processedOn;
        return new Date(processedOn || 0);
      }
    } catch (error) {
      this.logger.error(
        `Failed to get last processed time for ${blockchainId}:`,
        error,
      );
    }

    return undefined;
  }
}
