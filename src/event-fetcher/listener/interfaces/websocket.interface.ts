import { ethers } from 'ethers';

export interface WebSocketContracts {
  cacheManagerContract: ethers.Contract;
  cacheManagerAutomationContract: ethers.Contract;
}
