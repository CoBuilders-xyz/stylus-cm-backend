import { Injectable, Logger } from '@nestjs/common';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { Bytecode } from '../../contracts/entities/bytecode.entity';
import { ContractBytecodeState } from '../interfaces/contract-bytecode-state.interface';
import {
  calculateActualBid,
  calculateBidPlusDecay,
  updateTotalBidInvestment,
} from '../utils/bid-utils';
import { isMoreRecentEvent } from '../utils/event-utils';
import { Contract } from 'src/contracts/entities/contract.entity';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
@Injectable()
export class InsertBidService {
  private readonly logger = new Logger(InsertBidService.name);

  constructor(
    @InjectRepository(Bytecode)
    private readonly bytecodeRepository: Repository<Bytecode>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
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
    const bidValue = Number(eventDataArray[2]);
    const size = Number(eventDataArray[3]);

    // Find the applicable decay rate for this event
    // const applicableDecayRate = findApplicableDecayRate(
    //   event,
    //   decayRateEvents,
    //   currentDecayRate,
    // );

    this.logger.debug(
      `Processing InsertBid for bytecode ${bytecodeHash} at address ${address} with bid ${bidValue} and size ${size}`,
    );

    // If no codehash in bytecode db, create new entry
    const existingBytecode = await this.bytecodeRepository.findOne({
      where: { blockchain, bytecodeHash },
    });

    let bytecode = new Bytecode();
    if (!existingBytecode) {
      this.logger.debug(
        `No bytecode found for ${bytecodeHash}, creating new entry`,
      );
      bytecode.blockchain = blockchain;
      bytecode.bytecodeHash = bytecodeHash;
      bytecode.size = size;
      bytecode.lastBid = bidValue.toString(); // TODO Calculate minus decay
      bytecode.bidPlusDecay = bidValue.toString();
      bytecode.totalBidInvestment = bidValue.toString();
      bytecode.isCached = true;
    } else {
      this.logger.debug(`Bytecode found for ${bytecodeHash}, updating entry`);
      bytecode = existingBytecode;
      bytecode.lastBid = bidValue.toString(); // TODO Calculate minus decay
      bytecode.bidPlusDecay = bidValue.toString();
      bytecode.totalBidInvestment =
        existingBytecode.totalBidInvestment + bidValue;
      bytecode.isCached = true;
    }
    await this.bytecodeRepository.save(bytecode);

    // If no address in contract db, create new entry
    const existingContract = await this.contractRepository.findOne({
      where: { blockchain, address },
    });

    let contract = new Contract();
    if (!existingContract) {
      this.logger.debug(`No contract found for ${address}, creating new entry`);
      contract.blockchain = blockchain;
      contract.address = address;
      contract.bytecode = bytecode;
      contract.lastBid = bidValue.toString(); // TODO Calculate minus decay
      contract.bidPlusDecay = bidValue.toString();
      contract.totalBidInvestment = bidValue.toString();
    } else {
      this.logger.debug(`Contract found for ${address}, updating entry`);
      contract = existingContract;
      contract.lastBid = bidValue.toString(); // TODO Calculate minus decay
      contract.bidPlusDecay = bidValue.toString();
      contract.totalBidInvestment =
        existingContract.totalBidInvestment + bidValue;
    }

    await this.contractRepository.save(contract);

    // If address in contract db, update bid, bidPlusDecay, size, totalBidInvestment, cacheStatus
  }
}
