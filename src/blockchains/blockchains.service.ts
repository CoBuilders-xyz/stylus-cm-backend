import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blockchain } from './entities/blockchain.entity';

@Injectable()
export class BlockchainsService {
  constructor(
    @InjectRepository(Blockchain)
    private blockchainRepository: Repository<Blockchain>,
  ) {}
  findAll() {
    return this.blockchainRepository.find(); // TODO Add interceptor to only share the necessary data
  }
}
