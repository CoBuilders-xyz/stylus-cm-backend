import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { abi } from '../../common/abis/cacheManager/cacheManager.json';
import { StateFetcherErrorHelpers } from '../state-fetcher.errors';
import { BlockchainStateData, ContractEntry } from '../interfaces';

@Injectable()
export class ContractInteractionService {
  private readonly logger = new Logger(ContractInteractionService.name);

  async getContractState(
    blockchain: Blockchain,
    provider: ethers.JsonRpcProvider,
  ): Promise<BlockchainStateData> {
    try {
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

      this.logger.verbose('Fetched smart contract state values', {
        blockchainId: blockchain.id,
        entries: entries.length,
        decayRate: decayRate.toString(),
        cacheSize: cacheSize.toString(),
        queueSize: queueSize.toString(),
        isPaused,
        blockNumber: block!.number,
        blockTimestamp: stateData.blockTimestamp,
      });

      return stateData;
    } catch (error) {
      this.logger.error(
        `Contract call failed for blockchain ${blockchain.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return StateFetcherErrorHelpers.throwContractCallFailed();
    }
  }
}
