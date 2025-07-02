import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blockchain } from '../entities/blockchain.entity';
import { BlockchainsErrorHelpers } from '../blockchains.errors';
import { createModuleLogger } from '../../common/utils/logger.util';
import { MODULE_NAME } from '../constants';

@Injectable()
export class BlockchainCrudService {
  private readonly logger = createModuleLogger(
    BlockchainCrudService,
    MODULE_NAME,
  );

  constructor(
    @InjectRepository(Blockchain)
    private readonly blockchainRepository: Repository<Blockchain>,
  ) {}

  /**
   * Find all enabled blockchains
   */
  async findAll(): Promise<Blockchain[]> {
    try {
      this.logger.debug('Querying database for all enabled blockchains');
      const blockchains = await this.blockchainRepository.find({
        where: { enabled: true },
      });

      this.logger.log(
        `Successfully retrieved ${blockchains.length} enabled blockchains`,
      );
      this.logger.debug(
        `Blockchain IDs: [${blockchains.map((b) => b.id).join(', ')}]`,
      );

      return blockchains;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to fetch enabled blockchains: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Find blockchain by ID
   */
  async findById(id: string): Promise<Blockchain> {
    try {
      this.logger.debug(`Querying database for blockchain with ID: ${id}`);
      const blockchain = await this.blockchainRepository.findOne({
        where: { id },
      });

      if (!blockchain) {
        this.logger.warn(`Blockchain not found with ID: ${id}`);
        BlockchainsErrorHelpers.throwBlockchainNotFound(id);
      }

      this.logger.log(
        `Successfully retrieved blockchain: ${blockchain!.name} (${id})`,
      );
      this.logger.debug(
        `Blockchain details - Chain ID: ${blockchain!.chainId}, Enabled: ${blockchain!.enabled}`,
      );

      return blockchain!; // Safe to use ! because we throw if null
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to fetch blockchain with ID ${id}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Validate that a blockchain exists by ID
   */
  async validateBlockchainExists(id: string): Promise<Blockchain> {
    this.logger.debug(`Validating existence of blockchain with ID: ${id}`);
    const blockchain = await this.findById(id);
    this.logger.debug(`Blockchain validation successful for ID: ${id}`);
    return blockchain;
  }
}
