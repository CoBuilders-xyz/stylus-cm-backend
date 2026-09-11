import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { Contract } from '../../contracts/entities/contract.entity';
import { DataProcessingErrorHelpers } from '../data-processing.errors';
import { EventDataGuards } from '../interfaces/event-data.interface';
import { createModuleLogger } from '../../common/utils/logger.util';
import { MODULE_NAME } from '../constants/module.constants';

@Injectable()
export class ActivationService {
  private readonly logger = createModuleLogger(ActivationService, MODULE_NAME);

  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
  ) {}

  async processActivationPerformedEvent(
    blockchain: Blockchain,
    event: BlockchainEvent,
  ): Promise<void> {
    this.logger.debug(
      `Processing ActivationPerformed event for blockchain ${blockchain.name}`,
    );

    try {
      const eventDataArray = event.eventData as unknown[];

      if (!EventDataGuards.isActivationPerformedEventData(eventDataArray)) {
        this.logger.warn(
          `ActivationPerformed event data is not in the expected format: ${JSON.stringify(event.eventData)}`,
        );
        DataProcessingErrorHelpers.throwInvalidEventData(
          event.id,
          'ActivationPerformed',
          event.eventData,
        );
        return;
      }

      const [, contractAddress] = eventDataArray;

      const contract = await this.contractRepository.findOne({
        where: { blockchain: { id: blockchain.id }, address: contractAddress },
      });

      if (!contract) {
        this.logger.warn(
          `No contract found for ${contractAddress} during ActivationPerformed processing`,
        );
        return;
      }

      contract.activationStatus = 'active';
      contract.lastActivationBlockNumber = event.blockNumber;
      contract.lastActivationTimestamp = event.blockTimestamp;
      contract.activationRetryCount = 0;
      await this.contractRepository.save(contract);

      this.logger.log(
        `Successfully processed ActivationPerformed for ${contractAddress}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing ActivationPerformed event: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      DataProcessingErrorHelpers.throwEventProcessingFailed(
        event.id,
        'ActivationPerformed',
      );
    }
  }

  async processActivationErrorEvent(
    blockchain: Blockchain,
    event: BlockchainEvent,
  ): Promise<void> {
    this.logger.debug(
      `Processing ActivationError event for blockchain ${blockchain.name}`,
    );

    try {
      const eventDataArray = event.eventData as unknown[];

      if (!EventDataGuards.isActivationErrorEventData(eventDataArray)) {
        this.logger.warn(
          `ActivationError event data is not in the expected format: ${JSON.stringify(event.eventData)}`,
        );
        DataProcessingErrorHelpers.throwInvalidEventData(
          event.id,
          'ActivationError',
          event.eventData,
        );
        return;
      }

      const [user, contractAddress, , reason] = eventDataArray;

      this.logger.warn(
        `ActivationError for contract ${contractAddress} by user ${user}: ${reason}`,
      );

      const contract = await this.contractRepository.findOne({
        where: { blockchain: { id: blockchain.id }, address: contractAddress },
      });

      if (contract) {
        contract.activationStatus = 'error';
        contract.activationRetryCount =
          (contract.activationRetryCount || 0) + 1;
        await this.contractRepository.save(contract);
      }
    } catch (error) {
      this.logger.error(
        `Error processing ActivationError event: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      DataProcessingErrorHelpers.throwEventProcessingFailed(
        event.id,
        'ActivationError',
      );
    }
  }

  async processContractAutoActivateUpdatedEvent(
    blockchain: Blockchain,
    event: BlockchainEvent,
  ): Promise<void> {
    this.logger.debug(
      `Processing ContractAutoActivateUpdated event for blockchain ${blockchain.name}`,
    );

    try {
      const eventDataArray = event.eventData as unknown[];

      if (
        !EventDataGuards.isContractAutoActivateUpdatedEventData(eventDataArray)
      ) {
        this.logger.warn(
          `ContractAutoActivateUpdated event data is not in the expected format: ${JSON.stringify(event.eventData)}`,
        );
        DataProcessingErrorHelpers.throwInvalidEventData(
          event.id,
          'ContractAutoActivateUpdated',
          event.eventData,
        );
        return;
      }

      const [, contractAddress, autoActivate] = eventDataArray;

      const contract = await this.contractRepository.findOne({
        where: { blockchain: { id: blockchain.id }, address: contractAddress },
      });

      if (!contract) {
        this.logger.warn(
          `No contract found for ${contractAddress} during ContractAutoActivateUpdated processing`,
        );
        return;
      }

      contract.autoActivate = autoActivate;
      await this.contractRepository.save(contract);

      this.logger.log(
        `Successfully updated autoActivate=${autoActivate} for ${contractAddress}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing ContractAutoActivateUpdated event: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      DataProcessingErrorHelpers.throwEventProcessingFailed(
        event.id,
        'ContractAutoActivateUpdated',
      );
    }
  }

  async processContractMaxActivationCostUpdatedEvent(
    blockchain: Blockchain,
    event: BlockchainEvent,
  ): Promise<void> {
    this.logger.debug(
      `Processing ContractMaxActivationCostUpdated event for blockchain ${blockchain.name}`,
    );

    try {
      const eventDataArray = event.eventData as unknown[];

      if (
        !EventDataGuards.isContractMaxActivationCostUpdatedEventData(
          eventDataArray,
        )
      ) {
        this.logger.warn(
          `ContractMaxActivationCostUpdated event data is not in the expected format: ${JSON.stringify(event.eventData)}`,
        );
        DataProcessingErrorHelpers.throwInvalidEventData(
          event.id,
          'ContractMaxActivationCostUpdated',
          event.eventData,
        );
        return;
      }

      const [, contractAddress, maxActivationCost] = eventDataArray;

      const contract = await this.contractRepository.findOne({
        where: { blockchain: { id: blockchain.id }, address: contractAddress },
      });

      if (!contract) {
        this.logger.warn(
          `No contract found for ${contractAddress} during ContractMaxActivationCostUpdated processing`,
        );
        return;
      }

      contract.maxActivationCost = maxActivationCost;
      await this.contractRepository.save(contract);

      this.logger.log(
        `Successfully updated maxActivationCost=${maxActivationCost} for ${contractAddress}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing ContractMaxActivationCostUpdated event: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      DataProcessingErrorHelpers.throwEventProcessingFailed(
        event.id,
        'ContractMaxActivationCostUpdated',
      );
    }
  }
}
