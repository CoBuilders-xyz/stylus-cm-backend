import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { BlockchainState } from '../../blockchains/entities/blockchain-state.entity';
import { Contract } from '../../contracts/entities/contract.entity';
import { Bytecode } from '../../contracts/entities/bytecode.entity';

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
   * Process an InsertBid event and update the contract bytecode state map
   *
   * @param event The InsertBid event to process
   * @param contractBytecodeStates Map of contract bytecode states to update
   * @param decayRate Current decay rate to apply
   */
  async processContractAddedEvent(
    blockchain: Blockchain,
    event: BlockchainEvent,
  ) {
    this.logger.debug(
      `Processing Automation ContractAdded event for blockchain ${blockchain.name}`,
    );

    const eventDataArray = event.eventData as unknown[];

    if (!Array.isArray(eventDataArray) || eventDataArray.length < 3) {
      this.logger.warn(
        `ContractAdded event data is not in the expected format: ${JSON.stringify(event.eventData)}`,
      );
      return;
    }

    const user = String(eventDataArray[0]);
    const address = String(eventDataArray[1]);
    const maxBid = String(eventDataArray[2]);
    const bidBlockNumber = event.blockNumber;
    const bidBlockTimestamp = event.blockTimestamp;

    this.logger.debug(
      `Processing Automation ContractAdded for user ${user} and address ${address} with maxBid ${maxBid}`,
    );

    // If no address in contract db, create new entry
    const existingContract = await this.contractRepository.findOne({
      where: { blockchain: { id: blockchain.id }, address },
    });

    if (!existingContract) {
      this.logger.warn(`No contract found for ${address}`);
      return;
    } else {
      this.logger.debug(`Contract found for ${address}, updating entry`);
      existingContract.maxBid = maxBid;
      existingContract.isAutomated = true;
      existingContract.bidBlockNumber = bidBlockNumber;
      existingContract.bidBlockTimestamp = bidBlockTimestamp;
    }

    await this.contractRepository.save(existingContract);
  }

  async processContractUpdatedEvent(
    blockchain: Blockchain,
    event: BlockchainEvent,
  ) {
    this.logger.debug(
      `Processing Automation ContractUpdated event for blockchain ${blockchain.name}`,
    );

    const eventDataArray = event.eventData as unknown[];

    if (!Array.isArray(eventDataArray) || eventDataArray.length < 3) {
      this.logger.warn(
        `ContractUpdated event data is not in the expected format: ${JSON.stringify(event.eventData)}`,
      );
      return;
    }
    const address = String(eventDataArray[1]);
    const maxBid = String(eventDataArray[2]);
    const bidBlockNumber = event.blockNumber;
    const bidBlockTimestamp = event.blockTimestamp;

    this.logger.debug(
      `Processing Automation ContractUpdated for address ${address} with maxBid ${maxBid}`,
    );

    const existingContract = await this.contractRepository.findOne({
      where: { blockchain: { id: blockchain.id }, address },
    });

    if (!existingContract) {
      this.logger.warn(`No contract found for ${address}`);
      return;
    } else {
      this.logger.debug(`Contract found for ${address}, updating entry`);
      existingContract.maxBid = maxBid;
      existingContract.bidBlockNumber = bidBlockNumber;
      existingContract.bidBlockTimestamp = bidBlockTimestamp;
    }

    await this.contractRepository.save(existingContract);
  }
}
