import { ethers } from 'ethers';

export interface ContractStateData {
  entries: Array<{
    code: string;
    size: ethers.BigNumberish;
    bid: ethers.BigNumberish;
  }>;
  decayRate: ethers.BigNumberish;
  cacheSize: ethers.BigNumberish;
  queueSize: ethers.BigNumberish;
  isPaused: boolean;
}
