import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { Contract } from 'src/contracts/entities/contract.entity';
import { ContractType, ProviderManager } from 'src/common/utils/provider.util';
import { createModuleLogger } from 'src/common/utils/logger.util';
import { CacheManagerAutomation } from 'src/common/types/contracts/cacheManagerAutomation/CacheManagerAutomation';
import { ArbWasm } from 'src/common/types/contracts/arbWasm/ArbWasm';
import { ICacheManagerAutomationV2 } from 'src/common/types/contracts/cacheManagerAutomation/CacheManagerAutomation';

import { CmaConfig } from '../cma.config';
import { SelectedContract } from '../interfaces';
import { MODULE_NAME } from '../constants';

@Injectable()
export class ActivationSelectionService {
  private readonly logger = createModuleLogger(
    ActivationSelectionService,
    MODULE_NAME,
  );

  constructor(
    private readonly providerManager: ProviderManager,
    private readonly configService: ConfigService,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
  ) {}

  async selectOptimalActivations(
    blockchain: Blockchain,
  ): Promise<SelectedContract[]> {
    const config = this.configService.get<CmaConfig>('cma');

    try {
      const cmaContract = this.providerManager.getContract(
        blockchain,
        ContractType.CACHE_MANAGER_AUTOMATION,
      ) as unknown as CacheManagerAutomation;

      const arbWasmContract = this.providerManager.getContract(
        blockchain,
        ContractType.ARB_WASM,
      ) as unknown as ArbWasm;

      let automatedUserConfigs: ICacheManagerAutomationV2.UserContractsDataStructOutput[] =
        [];
      let offset = 0n;
      const limit = BigInt(config?.paginationLimit || 30);
      let hasMore = true;

      this.logger.log(
        `Fetching contracts for activation selection on ${blockchain.name}...`,
      );

      while (hasMore) {
        const result = await cmaContract.getContractsPaginated(offset, limit);
        const batchContracts = result.userData;
        hasMore = result.hasMore;

        automatedUserConfigs = automatedUserConfigs.concat(batchContracts);

        if (!hasMore) {
          break;
        }
        offset += limit;
      }

      this.logger.log(
        `Found ${automatedUserConfigs.length} users to check for activation eligibility`,
      );

      const selectedContracts: SelectedContract[] = [];

      for (const auc of automatedUserConfigs) {
        for (const contractConfig of auc.contracts) {
          if (!contractConfig.enabled) {
            continue;
          }

          const eligible = await this.isEligibleForActivation(
            blockchain,
            auc.user,
            contractConfig.contractAddress,
            arbWasmContract,
          );

          if (eligible) {
            selectedContracts.push({
              user: auc.user,
              address: contractConfig.contractAddress,
            });
          }
        }
      }

      this.logger.log(
        `Selected ${selectedContracts.length} contracts for activation on ${blockchain.name}`,
      );
      return selectedContracts;
    } catch (error) {
      this.logger.error(
        `Activation selection failed for ${blockchain.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  private async isEligibleForActivation(
    blockchain: Blockchain,
    user: string,
    contractAddress: string,
    arbWasmContract: ArbWasm,
  ): Promise<boolean> {
    try {
      const dbContract = await this.contractRepository.findOne({
        where: {
          blockchain: { id: blockchain.id },
          address: contractAddress,
        },
      });

      if (!dbContract) {
        return false;
      }

      if (!dbContract.autoActivate) {
        return false;
      }

      if (
        !dbContract.maxActivationCost ||
        BigInt(dbContract.maxActivationCost) <= 0n
      ) {
        return false;
      }

      const expired = await this.isProgramExpired(
        contractAddress,
        arbWasmContract,
      );

      if (!expired) {
        return false;
      }

      this.logger.debug(
        `Contract ${contractAddress} (user: ${user}) is expired and eligible for activation`,
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `Error checking activation eligibility for ${contractAddress}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * ArbWasm.programTimeLeft reverts with ProgramExpired (0xc9b12e52) when the
   * program has expired. A successful return with timeLeft > 0 means still active.
   * timeLeft == 0 also means expired. ProgramNotActivated means never activated.
   */
  private async isProgramExpired(
    contractAddress: string,
    arbWasmContract: ArbWasm,
  ): Promise<boolean> {
    try {
      const timeLeft = await arbWasmContract.programTimeLeft(contractAddress);
      return timeLeft <= 0n;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('ProgramExpired') || msg.includes('0xc9b12e52')) {
        return true;
      }
      if (msg.includes('ProgramNotActivated')) {
        return false;
      }
      throw error;
    }
  }
}
