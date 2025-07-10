import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { abi } from '../../common/abis/cacheManager/cacheManager.json';
import { StateFetcherErrorHelpers } from '../state-fetcher.errors';
import { BlockchainStateData, ContractEntry } from '../interfaces';
import { createModuleLogger } from '../../common/utils/logger.util';
import { MODULE_NAME } from '../constants';

@Injectable()
export class ContractInteractionService {
  private readonly logger = createModuleLogger(
    ContractInteractionService,
    MODULE_NAME,
  );

  async getContractState(
    blockchain: Blockchain,
    provider: ethers.JsonRpcProvider,
  ): Promise<BlockchainStateData> {
    try {
      this.logger.debug(
        `Fetching contract state for blockchain ${blockchain.id}`,
      );

      const cacheManagerContract = new ethers.Contract(
        blockchain.cacheManagerAddress,
        abi as ethers.InterfaceAbi,
        provider,
      );

      const results = await Promise.all([
        cacheManagerContract.getEntries() as Promise<ContractEntry[]>,
        cacheManagerContract.decay() as Promise<ethers.BigNumberish>,
        cacheManagerContract.cacheSize() as Promise<ethers.BigNumberish>,
        cacheManagerContract.queueSize() as Promise<ethers.BigNumberish>,
        cacheManagerContract.isPaused() as Promise<boolean>,
        provider.getBlock('latest'),
      ]);

      const [entries, decayRate, cacheSize, queueSize, isPaused, block] =
        results;

      if (!block) {
        this.logger.error(
          `Failed to fetch latest block for blockchain ${blockchain.id}`,
        );
        StateFetcherErrorHelpers.throwBlockFetchFailed();
      }

      const stateData: BlockchainStateData = {
        entries,
        decayRate,
        cacheSize,
        queueSize,
        isPaused,
        blockNumber: block!.number,
        blockTimestamp: new Date(Number(block!.timestamp) * 1000),
        totalContractsCached: entries.length,
      };

      this.logger.log(
        `Contract state fetched for blockchain ${blockchain.id}: ${entries.length} contracts, queue ${queueSize}/${cacheSize}, block ${block!.number}`,
      );

      return stateData;
    } catch (error) {
      this.logger.error(
        `Contract call failed for blockchain ${blockchain.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return StateFetcherErrorHelpers.throwContractCallFailed();
    }
  }
}
