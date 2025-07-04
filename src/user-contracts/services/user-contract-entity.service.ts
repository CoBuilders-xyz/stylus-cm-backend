import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { Contract } from '../../contracts/entities/contract.entity';
import { Bytecode } from '../../contracts/entities/bytecode.entity';
import {
  ContractType,
  ProviderManager,
} from '../../common/utils/provider.util';
import { UserContractsErrorHelpers } from '../user-contracts.errors';
import { MODULE_NAME, USER_CONTRACT_DEFAULTS } from '../constants';
import { createModuleLogger } from '../../common/utils/logger.util';

@Injectable()
export class UserContractEntityService {
  private readonly logger = createModuleLogger(
    UserContractEntityService,
    MODULE_NAME,
  );

  constructor(
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
    @InjectRepository(Bytecode)
    private bytecodeRepository: Repository<Bytecode>,
    private readonly providerManager: ProviderManager,
  ) {}

  async getOrCreateContract(
    address: string,
    blockchain: Blockchain,
    onChainBytecode: string,
  ): Promise<Contract> {
    try {
      const verifiedAddress = ethers.getAddress(address);

      // Check if contract already exists - exact same logic as original
      let contract = await this.contractRepository.findOne({
        where: { blockchain, address: verifiedAddress },
      });

      if (!contract) {
        // Get or create bytecode first
        const bytecode = await this.getOrCreateBytecode(
          blockchain,
          onChainBytecode,
        );

        // Create new contract with exact same defaults as original
        contract = this.contractRepository.create({
          blockchain,
          address: verifiedAddress,
          bytecode: bytecode,
          lastBid: USER_CONTRACT_DEFAULTS.CONTRACT.LAST_BID,
          bidPlusDecay: USER_CONTRACT_DEFAULTS.CONTRACT.BID_PLUS_DECAY,
          totalBidInvestment:
            USER_CONTRACT_DEFAULTS.CONTRACT.TOTAL_BID_INVESTMENT,
          isAutomated: USER_CONTRACT_DEFAULTS.CONTRACT.IS_AUTOMATED,
          maxBid: USER_CONTRACT_DEFAULTS.CONTRACT.MAX_BID,
        });
        contract = await this.contractRepository.save(contract);
      }

      return contract;
    } catch (error) {
      this.logger.error(
        `Failed to create contract entity for ${address}`,
        error,
      );
      UserContractsErrorHelpers.throwContractEntityCreationFailed(
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw new Error('Unreachable');
    }
  }

  async getOrCreateBytecode(
    blockchain: Blockchain,
    onChainBytecode: string,
  ): Promise<Bytecode> {
    try {
      const bytecodeHash = ethers.keccak256(onChainBytecode);

      // Check if bytecode already exists - exact same logic as original
      let bytecode = await this.bytecodeRepository.findOne({
        where: {
          blockchain,
          bytecodeHash: bytecodeHash,
        },
      });

      if (!bytecode) {
        // Get contract size using provider manager - exact same logic as original
        const arbWasmContract = this.providerManager.getContract(
          blockchain,
          ContractType.ARB_WASM,
        );
        const contractSizeRaw = (await arbWasmContract.codehashAsmSize(
          bytecodeHash,
        )) as bigint;
        const contractSize = contractSizeRaw.toString();

        // Create new bytecode with exact same defaults as original
        bytecode = this.bytecodeRepository.create({
          blockchain,
          bytecodeHash: bytecodeHash,
          size: contractSize,
          lastBid: USER_CONTRACT_DEFAULTS.BYTECODE.LAST_BID,
          bidPlusDecay: USER_CONTRACT_DEFAULTS.BYTECODE.BID_PLUS_DECAY,
          lastEvictionBid: USER_CONTRACT_DEFAULTS.BYTECODE.LAST_EVICTION_BID,
          isCached: USER_CONTRACT_DEFAULTS.BYTECODE.IS_CACHED,
          totalBidInvestment:
            USER_CONTRACT_DEFAULTS.BYTECODE.TOTAL_BID_INVESTMENT,
        });
        bytecode = await this.bytecodeRepository.save(bytecode);
      }

      return bytecode;
    } catch (error) {
      this.logger.error(
        `Failed to create bytecode entity for blockchain ${blockchain.id}`,
        error,
      );
      UserContractsErrorHelpers.throwBytecodeCreationFailed(
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw new Error('Unreachable');
    }
  }
}
