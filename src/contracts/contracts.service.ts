import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { ContractsUtilsService } from './contracts.utils.service';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    private readonly contractsUtilsService: ContractsUtilsService,
  ) {}

  async findAll(blockchainId: string) {
    const contracts = await this.contractRepository.find({
      where: { blockchain: { id: blockchainId } },
      relations: ['bytecode', 'blockchain'],
    });

    // Process contracts to add calculated fields
    return this.contractsUtilsService.processContracts(contracts);
  }

  async findOne(id: string) {
    const contract = await this.contractRepository.findOne({
      where: { id },
      relations: ['bytecode', 'blockchain'],
    });

    if (!contract) {
      return null;
    }

    // Process the single contract to add calculated fields
    return this.contractsUtilsService.processContract(contract);
  }
}
