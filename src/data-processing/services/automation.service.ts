import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { BlockchainState } from '../../blockchains/entities/blockchain-state.entity';
import { Contract } from '../../contracts/entities/contract.entity';
import { Bytecode } from '../../contracts/entities/bytecode.entity';
import { DataProcessingErrorHelpers } from '../data-processing.errors';
import { EventDataGuards } from '../interfaces/event-data.interface';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    @InjectRepository(Bytecode)
    private readonly bytecodeRepository: Repository<Bytecode>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(BlockchainState)
    private readonly blockchainStateRepository: Repository<BlockchainState>,
    @InjectRepository(BlockchainEvent)
    private readonly blockchainEventRepository: Repository<BlockchainEvent>,
  ) {}

  /**
   * Process a ContractAdded event for automation
   *
   * @param blockchain The blockchain context
   * @param event The ContractAdded event to process
   */
  async processContractAddedEvent(
    blockchain: Blockchain,
    event: BlockchainEvent,
  ): Promise<void> {
    this.logger.debug(
      `Processing Automation ContractAdded event for blockchain ${blockchain.name}`,
    );

    try {
      const eventDataArray = event.eventData as unknown[];

      // Validate event data using type guards
      if (!EventDataGuards.isContractAddedEventData(eventDataArray)) {
        this.logger.warn(
          `ContractAdded event data is not in the expected format: ${JSON.stringify(event.eventData)}`,
        );
        DataProcessingErrorHelpers.throwInvalidEventData(
          event.id,
          'ContractAdded',
          event.eventData,
        );
        return;
      }

      const [user, address, maxBid] = eventDataArray;
      const bidBlockNumber = event.blockNumber;
      const bidBlockTimestamp = event.blockTimestamp;

      this.logger.debug(
        `Processing Automation ContractAdded for user ${user} and address ${address} with maxBid ${maxBid}`,
      );

      await this.updateContractForAutomation(
        blockchain,
        address,
        maxBid,
        bidBlockNumber,
        bidBlockTimestamp,
        true, // isAutomated
      );

      this.logger.log(
        `Successfully processed ContractAdded event for address ${address}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing ContractAdded event: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      DataProcessingErrorHelpers.throwEventProcessingFailed(
        event.id,
        'ContractAdded',
      );
    }
  }

  /**
   * Process a ContractUpdated event for automation
   *
   * @param blockchain The blockchain context
   * @param event The ContractUpdated event to process
   */
  async processContractUpdatedEvent(
    blockchain: Blockchain,
    event: BlockchainEvent,
  ): Promise<void> {
    this.logger.debug(
      `Processing Automation ContractUpdated event for blockchain ${blockchain.name}`,
    );

    try {
      const eventDataArray = event.eventData as unknown[];

      // Validate event data using type guards
      if (!EventDataGuards.isContractUpdatedEventData(eventDataArray)) {
        this.logger.warn(
          `ContractUpdated event data is not in the expected format: ${JSON.stringify(event.eventData)}`,
        );
        DataProcessingErrorHelpers.throwInvalidEventData(
          event.id,
          'ContractUpdated',
          event.eventData,
        );
        return;
      }

      const [address, maxBid] = eventDataArray;
      const bidBlockNumber = event.blockNumber;
      const bidBlockTimestamp = event.blockTimestamp;

      this.logger.debug(
        `Processing Automation ContractUpdated for address ${address} with maxBid ${maxBid}`,
      );

      await this.updateContractForAutomation(
        blockchain,
        address,
        maxBid,
        bidBlockNumber,
        bidBlockTimestamp,
        false, // don't change isAutomated flag
      );

      this.logger.log(
        `Successfully processed ContractUpdated event for address ${address}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing ContractUpdated event: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      DataProcessingErrorHelpers.throwEventProcessingFailed(
        event.id,
        'ContractUpdated',
      );
    }
  }

  /**
   * Update contract for automation
   */
  private async updateContractForAutomation(
    blockchain: Blockchain,
    address: string,
    maxBid: string,
    bidBlockNumber: number,
    bidBlockTimestamp: Date,
    setAutomated: boolean,
  ): Promise<void> {
    try {
      // Find existing contract
      const existingContract = await this.contractRepository.findOne({
        where: { blockchain: { id: blockchain.id }, address },
      });

      if (!existingContract) {
        this.logger.warn(`No contract found for ${address}`);
        DataProcessingErrorHelpers.throwDatabaseOperationFailed(
          `contract not found for automation: ${address}`,
        );
        return;
      }

      this.logger.debug(`Contract found for ${address}, updating entry`);

      // Update contract properties
      existingContract.maxBid = maxBid;
      existingContract.bidBlockNumber = bidBlockNumber;
      existingContract.bidBlockTimestamp = bidBlockTimestamp;

      // Only set isAutomated if explicitly requested (for ContractAdded events)
      if (setAutomated) {
        existingContract.isAutomated = true;
      }

      await this.contractRepository.save(existingContract);
      this.logger.debug(`Updated contract ${address} for automation`);
    } catch (error) {
      this.logger.error(
        `Error updating contract for automation: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      DataProcessingErrorHelpers.throwDatabaseOperationFailed(
        'contract automation update',
      );
    }
  }
}
