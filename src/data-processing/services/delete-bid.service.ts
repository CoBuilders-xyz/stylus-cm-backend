import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { Bytecode } from '../../contracts/entities/bytecode.entity';
@Injectable()
export class DeleteBidService {
  private readonly logger = new Logger(DeleteBidService.name);

  constructor(
    @InjectRepository(BlockchainEvent)
    private readonly blockchainEventRepository: Repository<BlockchainEvent>,
    @InjectRepository(Bytecode)
    private readonly bytecodeRepository: Repository<Bytecode>,
  ) {}

  async processDeleteBidEvent(blockchain: Blockchain, event: BlockchainEvent) {
    this.logger.debug(
      `Processing DeleteBid event for blockchain ${blockchain.name}`,
    );

    const eventDataArray = event.eventData as unknown[];

    if (!Array.isArray(eventDataArray) || eventDataArray.length < 3) {
      this.logger.warn(
        `DeleteBid event data is not in the expected format: ${JSON.stringify(event.eventData)}`,
      );
      return;
    }

    const bytecodeHash = String(eventDataArray[0]);
    const bidValue = String(eventDataArray[1]);
    // Not used, but kept for completeness and future reference
    // const size = Number(eventDataArray[2]);

    // If no codehash in bytecode db, create new entry
    const existingBytecode = await this.bytecodeRepository.findOne({
      where: {
        blockchain: { id: blockchain.id },
        bytecodeHash,
      },
    });

    if (!existingBytecode) {
      this.logger.error(
        `A DeleteBid event was received for ${bytecodeHash}, but no bytecode was found in the database.`,
      );
      return;
    }

    // If bytecode exists, update bid, bidPlusDecay, size, totalBidInvestment, cacheStatus
    existingBytecode.lastEvictionBid = bidValue;
    existingBytecode.isCached = false;
    await this.bytecodeRepository.save(existingBytecode);
  }
}
