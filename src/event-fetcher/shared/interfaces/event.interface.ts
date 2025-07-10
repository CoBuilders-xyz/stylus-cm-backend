import { ethers } from 'ethers';
import { Blockchain } from '../../../blockchains/entities/blockchain.entity';

export interface BlockchainEventData {
  blockchain: Blockchain;
  contractName: string;
  contractAddress: string;
  eventName: string;
  blockTimestamp: Date;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  isRealTime: boolean;
  eventData: Record<string, any>;
  isSynced?: boolean;
  originAddress?: string;
}

export interface EventOptions {
  fromBlock?: number;
  toBlock?: number;
  isRealTime?: boolean;
}

export interface EventTypeDefinition {
  name: string;
  filter?: (...args: any[]) => any;
}

export interface EventProcessResult {
  successCount: number;
  errorCount: number;
  totalEvents: number;
}

export type EthersEvent = ethers.Log | ethers.EventLog;
