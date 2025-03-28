import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserContract } from './entities/user-contract.entity';

@Injectable()
export class UserContractsService {
  constructor(
    @InjectRepository(UserContract)
    private userContractRepository: Repository<UserContract>,
  ) {}

  async createUserContract(
    address: string,
    blockchainId: string,
    name?: string,
  ) {
    const userContract = await this.userContractRepository.findOne({
      where: { address, blockchain: { id: blockchainId } },
    });

    if (userContract) {
      throw new BadRequestException('User contract already exists');
    }
    const nonEmptyName = name || address;
    const newUserContract = this.userContractRepository.create({
      address,
      blockchain: { id: blockchainId },
      name: nonEmptyName,
    });
    return this.userContractRepository.save(newUserContract);
  }

  // async getUserContracts(userId: number) {
  //   return this.userContractRepository.find({ where: { userId } });
  // }
}
