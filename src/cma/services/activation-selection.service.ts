import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ethers } from 'ethers';

import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { Contract } from 'src/contracts/entities/contract.entity';
import { ContractType, ProviderManager } from 'src/common/utils/provider.util';
import { createModuleLogger } from 'src/common/utils/logger.util';
import { CacheManagerAutomation } from 'src/common/types/contracts/cacheManagerAutomation/CacheManagerAutomation';
import { ArbWasm } from 'src/common/types/contracts/arbWasm/ArbWasm';

import { CmaConfig } from '../cma.config';
import { ActivationSelectionResult, SelectedContract } from '../interfaces';
import { MODULE_NAME } from '../constants';

const ESCROW_ABI = ['function depositsOf(address) view returns (uint256)'];

const MAX_RETRY_COUNT = 5;
const RETRY_BACKOFF_MINUTES = 5;

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
  ): Promise<ActivationSelectionResult> {
    const config = this.configService.get<CmaConfig>('cma');
    const emptyResult: ActivationSelectionResult = {
      selectedContracts: [],
      maxActivationsPerIteration: 5,
    };

    try {
      const cmaContract = this.providerManager.getContract(
        blockchain,
        ContractType.CACHE_MANAGER_AUTOMATION,
      ) as unknown as CacheManagerAutomation;

      const arbWasmContract = this.providerManager.getContract(
        blockchain,
        ContractType.ARB_WASM,
      ) as unknown as ArbWasm;

      const maxActivationsPerIteration = Number(
        await cmaContract.maxActivationsPerIteration(),
      );

      const allUserConfigs = await this.fetchAllUserConfigs(
        cmaContract,
        config?.paginationLimit || 30,
      );

      if (allUserConfigs.length === 0) {
        return { ...emptyResult, maxActivationsPerIteration };
      }

      const candidateAddresses = this.extractCandidateAddresses(allUserConfigs);

      if (candidateAddresses.length === 0) {
        return { ...emptyResult, maxActivationsPerIteration };
      }

      const eligibleContracts = await this.contractRepository.find({
        where: {
          blockchain: { id: blockchain.id },
          address: In(candidateAddresses),
          autoActivate: true,
        },
      });

      const eligibleMap = new Map(
        eligibleContracts
          .filter((c) => this.passesRetryBackoff(c))
          .filter(
            (c) => c.maxActivationCost && BigInt(c.maxActivationCost) > 0n,
          )
          .map((c) => [c.address.toLowerCase(), c]),
      );

      if (eligibleMap.size === 0) {
        return { ...emptyResult, maxActivationsPerIteration };
      }

      const selectedContracts = await this.filterByOnChainState(
        allUserConfigs,
        eligibleMap,
        cmaContract,
        arbWasmContract,
      );

      this.logger.log(
        `Selected ${selectedContracts.length} contracts for activation on ${blockchain.name}`,
      );

      return { selectedContracts, maxActivationsPerIteration };
    } catch (error) {
      this.logger.error(
        `Activation selection failed for ${blockchain.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return emptyResult;
    }
  }

  private async fetchAllUserConfigs(
    cmaContract: CacheManagerAutomation,
    paginationLimit: number,
  ) {
    type UserConfigs = Awaited<
      ReturnType<CacheManagerAutomation['getContractsPaginated']>
    >['userData'];

    let allConfigs: UserConfigs[number][] = [];
    let offset = 0n;
    const limit = BigInt(paginationLimit);

    while (true) {
      const result = await cmaContract.getContractsPaginated(offset, limit);
      allConfigs = allConfigs.concat([...result.userData]);
      if (!result.hasMore) break;
      offset += limit;
    }

    return allConfigs;
  }

  private extractCandidateAddresses(
    allUserConfigs: Awaited<
      ReturnType<ActivationSelectionService['fetchAllUserConfigs']>
    >,
  ): string[] {
    const addresses: string[] = [];
    for (const userConfig of allUserConfigs) {
      for (const contractConfig of userConfig.contracts) {
        if (contractConfig.enabled && contractConfig.autoActivate) {
          addresses.push(contractConfig.contractAddress);
        }
      }
    }
    return addresses;
  }

  private passesRetryBackoff(contract: Contract): boolean {
    if (
      contract.activationStatus !== 'error' ||
      contract.activationRetryCount === 0
    ) {
      return true;
    }

    if (contract.activationRetryCount >= MAX_RETRY_COUNT) {
      return false;
    }

    if (!contract.lastActivationTimestamp) {
      return true;
    }

    const backoffMs =
      contract.activationRetryCount * RETRY_BACKOFF_MINUTES * 60 * 1000;
    const nextRetryAt =
      new Date(contract.lastActivationTimestamp).getTime() + backoffMs;

    return Date.now() >= nextRetryAt;
  }

  private async filterByOnChainState(
    allUserConfigs: Awaited<
      ReturnType<ActivationSelectionService['fetchAllUserConfigs']>
    >,
    eligibleMap: Map<string, Contract>,
    cmaContract: CacheManagerAutomation,
    arbWasmContract: ArbWasm,
  ): Promise<SelectedContract[]> {
    const selected: SelectedContract[] = [];

    const escrowAddress = await cmaContract.escrow();
    const provider = (cmaContract as unknown as ethers.BaseContract).runner;
    const escrowContract = new ethers.Contract(
      escrowAddress,
      ESCROW_ABI,
      provider,
    );

    const usersToCheck = new Map<string, string[]>();
    for (const userConfig of allUserConfigs) {
      for (const contractConfig of userConfig.contracts) {
        if (!contractConfig.enabled || !contractConfig.autoActivate) continue;
        const addr = contractConfig.contractAddress.toLowerCase();
        if (!eligibleMap.has(addr)) continue;

        if (!usersToCheck.has(userConfig.user)) {
          usersToCheck.set(userConfig.user, []);
        }
        usersToCheck.get(userConfig.user)!.push(contractConfig.contractAddress);
      }
    }

    for (const [user, contractAddresses] of usersToCheck) {
      let userBalance: bigint;
      try {
        userBalance = BigInt((await escrowContract.depositsOf(user)) as string);
      } catch {
        this.logger.warn(`Failed to fetch escrow balance for user ${user}`);
        continue;
      }

      for (const contractAddress of contractAddresses) {
        const dbContract = eligibleMap.get(contractAddress.toLowerCase());
        if (!dbContract) continue;

        const maxCost = BigInt(dbContract.maxActivationCost ?? '0');
        if (userBalance < maxCost) {
          this.logger.debug(
            `User ${user} insufficient escrow (${userBalance}) for ${contractAddress} (needs ${maxCost})`,
          );
          continue;
        }

        const expired = await this.isProgramExpired(
          contractAddress,
          arbWasmContract,
        );
        if (!expired) continue;

        selected.push({ user, address: contractAddress });
        userBalance -= maxCost;
      }
    }

    return selected;
  }

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
