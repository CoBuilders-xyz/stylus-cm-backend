export interface BlockchainEventResponse {
  id: string;
  blockchainId: string;
  blockchainName: string;
  contractName: string;
  contractAddress: string;
  eventName: string;
  blockTimestamp: Date;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  isRealTime: boolean;
  originAddress: string;
  eventData: Record<string, any>;
}
