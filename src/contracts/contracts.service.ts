import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './entities/contract.entity';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
  ) {}

  findAll() {
    return this.contractRepository.find({
      relations: ['bytecode'],
    });
  }

  findOne(id: string) {
    return this.contractRepository.findOne({ where: { id } });
  }
}
