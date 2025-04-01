import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserContract } from '../user-contracts/entities/user-contract.entity';
import { User } from 'src/users/entities/user.entity';
import { ethers } from 'ethers';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { Contract } from 'src/contracts/entities/contract.entity';

@Injectable()
export class UserContractsService {
  constructor(
    @InjectRepository(UserContract)
    private userContractRepository: Repository<UserContract>,
    @InjectRepository(Blockchain)
    private blockchainRepository: Repository<Blockchain>,
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
  ) {}

  async createUserContract(
    user: User,
    address: string,
    blockchainId: string,
    name?: string,
  ) {
    const userContract = await this.userContractRepository.findOne({
      where: {
        address,
        blockchain: { id: blockchainId },
        user: { id: user.id },
      },
    });

    if (userContract) {
      throw new BadRequestException('User contract already exists');
    }

    const blockchain = await this.blockchainRepository.findOne({
      where: { id: blockchainId },
    });

    if (!blockchain) {
      throw new BadRequestException('Blockchain not found');
    }

    const provider = new ethers.JsonRpcProvider(blockchain.rpcUrl); // TODO avoid envs within code.
    const bytecode = await provider.getCode(address);
    if (bytecode === '0x' || bytecode === '') {
      throw new BadRequestException(
        'The provided address is not a smart contract on the selected blockchain',
      );
    }
    const verifiedAddress = ethers.getAddress(address);
    const nonEmptyName = name || verifiedAddress;

    const contract = await this.contractRepository.findOne({
      where: { blockchain, address: verifiedAddress },
    });

    const newUserContract = this.userContractRepository.create({
      address,
      blockchain,
      ...(contract ? { contract } : {}),
      user,
      name: nonEmptyName,
    });

    return this.userContractRepository.save(newUserContract);
  }

  async getUserContracts(user: User, blockchainId: string) {
    //relate contract with bytecode as well

    return this.userContractRepository.find({
      where: { blockchain: { id: blockchainId }, user: { id: user.id } },
      relations: ['contract', 'contract.bytecode'],
    });
  }
}
