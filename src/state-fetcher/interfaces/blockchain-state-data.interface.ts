import { ethers } from 'ethers';

export interface ContractEntry {
  code: string;
  size: ethers.BigNumberish;
  bid: ethers.BigNumberish;
}

export interface BlockchainStateData {
  entries: ContractEntry[];
  decayRate: ethers.BigNumberish;
  cacheSize: ethers.BigNumberish;
  queueSize: ethers.BigNumberish;
  isPaused: boolean;
  blockNumber: number;
  blockTimestamp: Date;
  totalContractsCached: number;
}
