import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
import { UserContract } from '../entities/user-contract.entity';
import { User } from '../../users/entities/user.entity';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { UserContractsErrorHelpers } from '../user-contracts.errors';
import { MODULE_NAME, BLOCKCHAIN_CONSTANTS } from '../constants';
import { createModuleLogger } from '../../common/utils/logger.util';

@Injectable()
export class UserContractValidationService {
  private readonly logger = createModuleLogger(
    UserContractValidationService,
    MODULE_NAME,
  );

  constructor(
    @InjectRepository(UserContract)
    private userContractRepository: Repository<UserContract>,
    @InjectRepository(Blockchain)
    private blockchainRepository: Repository<Blockchain>,
  ) {}

  async validateUserContractCreation(
    user: User,
    address: string,
    blockchainId: string,
  ): Promise<{ blockchain: Blockchain; verifiedAddress: string }> {
    this.logger.log(
      `Validating user contract creation for user ${user.id} with address ${address} on blockchain ${blockchainId}`,
    );

    // Check if user contract already exists - migrated from original service
    const userContract = await this.userContractRepository.findOne({
      where: {
        address,
        blockchain: { id: blockchainId },
        user: { id: user.id },
      },
    });

    if (userContract) {
      this.logger.debug(
        `User contract already exists for address ${address} on blockchain ${blockchainId}`,
      );
      UserContractsErrorHelpers.throwContractAlreadyExists(address);
    }

    // Validate blockchain exists - migrated from original service
    const blockchain = await this.blockchainRepository.findOne({
      where: { id: blockchainId },
    });

    if (!blockchain) {
      this.logger.debug(`Blockchain ${blockchainId} not found`);
      UserContractsErrorHelpers.throwBlockchainNotFound(blockchainId);
      throw new Error('Unreachable');
    }

    this.logger.debug(`Blockchain ${blockchain.name} found`);

    // Verify address format - migrated from original service
    const verifiedAddress = ethers.getAddress(address);

    this.logger.log(
      `Successfully validated user contract creation for user ${user.id} with address ${verifiedAddress} on blockchain ${blockchain.name}`,
    );

    return { blockchain, verifiedAddress };
  }

  async validateContractOnBlockchain(
    address: string,
    blockchain: Blockchain,
  ): Promise<{ verifiedAddress: string; onChainBytecode: string }> {
    this.logger.log(
      `Validating contract ${address} on blockchain ${blockchain.name}`,
    );

    try {
      // Exact same logic as original service
      const provider = new ethers.JsonRpcProvider(blockchain.rpcUrl);
      const onChainBytecode = await provider.getCode(address);

      this.logger.debug(
        `Retrieved bytecode for contract ${address} on blockchain ${blockchain.name}`,
      );

      if (
        onChainBytecode === BLOCKCHAIN_CONSTANTS.EMPTY_BYTECODE ||
        onChainBytecode === BLOCKCHAIN_CONSTANTS.EMPTY_BYTECODE_ALT
      ) {
        this.logger.debug(
          `Contract ${address} has empty bytecode on blockchain ${blockchain.name}`,
        );
        UserContractsErrorHelpers.throwContractNotOnBlockchain(
          address,
          blockchain.name,
        );
      }

      const verifiedAddress = ethers.getAddress(address);

      this.logger.log(
        `Successfully validated contract ${verifiedAddress} on blockchain ${blockchain.name}`,
      );

      return { verifiedAddress, onChainBytecode };
    } catch (error) {
      this.logger.error(
        `Contract validation failed for ${address} on ${blockchain.name}`,
        error,
      );
      UserContractsErrorHelpers.throwContractValidationFailed(
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw new Error('Unreachable');
    }
  }
}
