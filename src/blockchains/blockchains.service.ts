import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blockchain } from './entities/blockchain.entity';

@Injectable()
export class BlockchainsService {
  constructor(
    @InjectRepository(Blockchain)
    private blockchainRepository: Repository<Blockchain>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const blockchainsConfig = this.configService.get(
      'blockchains',
    ) as Blockchain[];

    if (!blockchainsConfig || !Array.isArray(blockchainsConfig)) {
      return [];
    }

    for (const blockchain of blockchainsConfig) {
      const existingBlockchain = await this.blockchainRepository.findOne({
        where: { chainId: blockchain.chainId, rpcUrl: blockchain.rpcUrl },
      });

      if (!existingBlockchain) {
        await this.blockchainRepository.insert(blockchain);
      }
    }
  }

  findAll() {
    return this.blockchainRepository.find(); // TODO Add interceptor to only share the necessary data
  }
}
