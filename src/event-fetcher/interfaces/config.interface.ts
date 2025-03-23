export interface EventFetcherConfig {
  // Number of blocks to look back during periodic resync
  resyncBlocksBack: number;

  // Event types to monitor
  eventTypes: string[];

  // Batch size for inserting events
  batchSize: number;
}

export interface ProviderConfig {
  chainId: number;
  rpcUrl: string;
  contractAddress: string;
}
