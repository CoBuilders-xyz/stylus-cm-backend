import { Injectable, Logger } from '@nestjs/common';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { ContractBytecodeState } from '../interfaces/contract-bytecode-state.interface';
import {
  calculateActualBid,
  calculateBidPlusDecay,
  updateTotalBidInvestment,
} from '../utils/bid-utils';
import { isMoreRecentEvent } from '../utils/event-utils';

@Injectable()
export class InsertBidService {
  private readonly logger = new Logger(InsertBidService.name);

  /**
   * Process an InsertBid event and update the contract bytecode state map
   *
   * @param event The InsertBid event to process
   * @param contractBytecodeStates Map of contract bytecode states to update
   * @param decayRate Current decay rate to apply
   */
  processInsertBidEvent(
    event: BlockchainEvent,
    contractBytecodeStates: Map<string, ContractBytecodeState>,
    decayRate: string = '0',
  ): void {
    // Based on the logs, we know that eventData is an array:
    // [codeHash, address, bid, size]
    const eventDataArray = event.eventData as unknown[];

    if (!Array.isArray(eventDataArray) || eventDataArray.length < 4) {
      this.logger.warn(
        `InsertBid event data is not in the expected format: ${JSON.stringify(event.eventData)}`,
      );
      return;
    }

    const codeHash = String(eventDataArray[0]);
    const address = String(eventDataArray[1]);
    const bidValue = String(eventDataArray[2]);
    const size = Number(eventDataArray[3]);

    this.logger.debug(
      `Processing InsertBid for contract ${codeHash} at address ${address} with bid ${bidValue} and size ${size}`,
    );

    if (!codeHash) {
      this.logger.warn(`Missing codehash in InsertBid event`);
      return;
    }

    // Calculate bid values
    const bidPlusDecay = calculateBidPlusDecay(bidValue);
    const bid = calculateActualBid(bidValue, decayRate, event.blockTimestamp);

    this.logger.debug(
      `Calculated values: actual bid = ${bid}, bidPlusDecay = ${bidPlusDecay}, using decay rate: ${decayRate}`,
    );

    const existingState = contractBytecodeStates.get(codeHash);

    if (existingState) {
      this.logger.debug(
        `Found existing state for contract bytecode ${codeHash}: cached=${existingState.isCached}, lastEvent=${existingState.lastEventName} at block ${existingState.lastEventBlock}`,
      );
    } else {
      this.logger.debug(
        `No existing state found for contract bytecode ${codeHash}, creating new entry`,
      );
    }

    // Check if this event is more recent than what we have
    const shouldUpdate = isMoreRecentEvent(
      event,
      existingState?.lastEventBlock,
    );

    if (shouldUpdate) {
      this.logger.debug(
        `Will update contract bytecode state for ${codeHash} as event from block ${event.blockNumber} is newer than existing state from block ${existingState?.lastEventBlock || 'none'}`,
      );

      // Calculate total bid investment - only add if this is a new bid, not an update to an existing one
      // If last event was DeleteBid or no previous event, add the bid to total
      const previousTotal = existingState?.totalBidInvestment || 0;
      const isNewBid =
        !existingState || existingState.lastEventName === 'DeleteBid';
      const totalBidInvestment = updateTotalBidInvestment(
        previousTotal,
        bid,
        isNewBid,
      );

      // Create or update contract bytecode state, marking as cached since this is an InsertBid event
      contractBytecodeStates.set(codeHash, {
        isCached: true, // InsertBid means the contract bytecode is cached
        bid,
        bidPlusDecay,
        size,
        address,
        lastEventBlock: event.blockNumber,
        lastEventName: 'InsertBid',
        totalBidInvestment,
      });

      this.logger.debug(
        `InsertBid: Contract bytecode ${codeHash} inserted with actual bid ${bid} ETH, original bid (including decay) ${bidPlusDecay} ETH ` +
          `at address ${address} at block ${event.blockNumber}` +
          (event.logIndex !== undefined
            ? ` (logIndex: ${event.logIndex})`
            : '') +
          `, total investment: ${totalBidInvestment}`,
      );
    } else {
      this.logger.debug(
        `Skipping older InsertBid event for contract bytecode ${codeHash} at block ${event.blockNumber}` +
          (event.logIndex !== undefined
            ? ` (logIndex: ${event.logIndex})`
            : '') +
          ` (already have event from block ${existingState?.lastEventBlock})`,
      );
    }
  }
}
