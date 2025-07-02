import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blockchain } from '../entities/blockchain.entity';
import { BlockchainsErrorHelpers } from '../blockchains.errors';

@Injectable()
export class BlockchainCrudService {
  private readonly logger = new Logger(BlockchainCrudService.name);

  constructor(
    @InjectRepository(Blockchain)
    private readonly blockchainRepository: Repository<Blockchain>,
  ) {}

  /**
   * Find all enabled blockchains
   */
  async findAll(): Promise<Blockchain[]> {
    try {
      this.logger.log('Fetching all enabled blockchains');
      return await this.blockchainRepository.find({ where: { enabled: true } });
    } catch (error) {
      this.logger.error('Error fetching blockchains', error);
      throw error;
    }
  }

  /**
   * Find blockchain by ID
   */
  async findById(id: string): Promise<Blockchain> {
    try {
      this.logger.log(`Fetching blockchain with ID: ${id}`);
      const blockchain = await this.blockchainRepository.findOne({
        where: { id },
      });

      if (!blockchain) {
        BlockchainsErrorHelpers.throwBlockchainNotFound(id);
      }

      return blockchain!; // Safe to use ! because we throw if null
    } catch (error) {
      this.logger.error(`Error fetching blockchain with ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * Validate that a blockchain exists by ID
   */
  async validateBlockchainExists(id: string): Promise<Blockchain> {
    return this.findById(id);
  }
}
