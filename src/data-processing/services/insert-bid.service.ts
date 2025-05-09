import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { BlockchainState } from '../../blockchains/entities/blockchain-state.entity';
import { Contract } from '../../contracts/entities/contract.entity';
import { Bytecode } from '../../contracts/entities/bytecode.entity';
import {
  calculateActualBid,
  updateTotalBidInvestment,
} from '../utils/bid-utils';
@Injectable()
export class InsertBidService {
  private readonly logger = new Logger(InsertBidService.name);

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
  async processInsertBidEvent(blockchain: Blockchain, event: BlockchainEvent) {
    this.logger.debug(
      `Processing InsertBid event for blockchain ${blockchain.name}`,
    );

    const eventDataArray = event.eventData as unknown[];

    if (!Array.isArray(eventDataArray) || eventDataArray.length < 4) {
      this.logger.warn(
        `InsertBid event data is not in the expected format: ${JSON.stringify(event.eventData)}`,
      );
      return;
    }

    const bytecodeHash = String(eventDataArray[0]);
    const address = String(eventDataArray[1]);
    const bidValue = String(eventDataArray[2]);
    const size = String(eventDataArray[3]);
    const bidBlockNumber = event.blockNumber;
    const bidBlockTimestamp = event.blockTimestamp;

    const blockchainState = await this.blockchainStateRepository.findOne({
      where: { blockchain: { id: blockchain.id } },
      order: { blockNumber: 'DESC' },
    });
    const lastBidDecayRate = blockchainState?.decayRate ?? '0';
    // find decay rate events until event.blockNumber
    const mostRecentDecayRateEvent =
      await this.blockchainEventRepository.findOne({
        where: {
          blockchain: { id: blockchain.id },
          blockNumber: LessThanOrEqual(event.blockNumber),
          eventName: 'SetDecayRate',
        },
        order: { blockNumber: 'DESC' },
      });
    // Find the applicable decay rate for this event
    const applicableDecayRate = mostRecentDecayRateEvent
      ? mostRecentDecayRateEvent.eventData[0]
      : lastBidDecayRate;

    const actualBid = calculateActualBid(
      bidValue,
      applicableDecayRate,
      event.blockTimestamp,
    );
    this.logger.debug(
      `Processing InsertBid for bytecode ${bytecodeHash} at address ${address} with bid ${bidValue} and size ${size}`,
    );

    // If no codehash in bytecode db, create new entry
    const existingBytecode = await this.bytecodeRepository.findOne({
      where: { blockchain: { id: blockchain.id }, bytecodeHash },
    });

    let bytecode = new Bytecode();
    if (!existingBytecode) {
      this.logger.debug(
        `No bytecode found for ${bytecodeHash}, creating new entry`,
      );
      bytecode.blockchain = blockchain;
      bytecode.bytecodeHash = bytecodeHash;
      bytecode.size = size;
      bytecode.lastBid = actualBid;
      bytecode.bidPlusDecay = bidValue;
      bytecode.totalBidInvestment = actualBid;
      bytecode.isCached = true;
      bytecode.bidBlockNumber = bidBlockNumber;
      bytecode.bidBlockTimestamp = bidBlockTimestamp;
    } else {
      this.logger.debug(`Bytecode found for ${bytecodeHash}, updating entry`);
      bytecode = existingBytecode;
      bytecode.lastBid = actualBid;
      bytecode.bidPlusDecay = bidValue;
      bytecode.totalBidInvestment = updateTotalBidInvestment(
        existingBytecode.totalBidInvestment,
        actualBid,
      );
      bytecode.isCached = true;
      bytecode.bidBlockNumber = bidBlockNumber;
      bytecode.bidBlockTimestamp = bidBlockTimestamp;
    }
    await this.bytecodeRepository.save(bytecode);

    // If no address in contract db, create new entry
    const existingContract = await this.contractRepository.findOne({
      where: { blockchain: { id: blockchain.id }, address },
    });

    let contract = new Contract();
    if (!existingContract) {
      this.logger.debug(`No contract found for ${address}, creating new entry`);
      contract.blockchain = blockchain;
      contract.address = address;
      contract.bytecode = bytecode;
      contract.lastBid = actualBid;
      contract.bidPlusDecay = bidValue;
      contract.totalBidInvestment = actualBid;
      contract.bidBlockNumber = bidBlockNumber;
      contract.bidBlockTimestamp = bidBlockTimestamp;
    } else {
      this.logger.debug(`Contract found for ${address}, updating entry`);
      contract = existingContract;
      contract.lastBid = actualBid;
      contract.bidPlusDecay = bidValue;
      contract.totalBidInvestment = updateTotalBidInvestment(
        existingContract.totalBidInvestment,
        actualBid,
      );
      contract.bidBlockNumber = bidBlockNumber;
      contract.bidBlockTimestamp = bidBlockTimestamp;
    }

    await this.contractRepository.save(contract);

    // If address in contract db, update bid, bidPlusDecay, size, totalBidInvestment, cacheStatus
  }
}
