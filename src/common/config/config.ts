export default () => ({
  blockchains: [
    {
      name: 'Arbitrum One',
      rpcUrl: process.env.ARB_ONE_RPC,
      rpcWssUrl: process.env.ARB_ONE_RPC_WSS,
      fastSyncRpcUrl: process.env.ARB_ONE_FAST_SYNC_RPC,
      chainId: 42161,
      cacheManagerAddress: '0x51dedbd2f190e0696afbee5e60bfde96d86464ec',
      arbWasmCacheAddress: '0x0000000000000000000000000000000000000072',
      arbWasmAddress: '0x0000000000000000000000000000000000000071',
      cacheManagerAutomationAddress:
        process.env.ARB_ONE_CMA_ADDRESS ||
        '0x0000000000000000000000000000000000000000',
      originBlock: 249721686, // First TX on CM contract.
      enabled: process.env.ARB_ONE_ENABLED === 'true',
    },
    {
      name: 'Arbitrum Sepolia',
      rpcUrl: process.env.ARB_SEPOLIA_RPC,
      rpcWssUrl: process.env.ARB_SEPOLIA_RPC_WSS,
      fastSyncRpcUrl: process.env.ARB_SEPOLIA_FAST_SYNC_RPC,
      chainId: 421614,
      cacheManagerAddress: '0x0c9043d042ab52cfa8d0207459260040cca54253',
      arbWasmCacheAddress: '0x0000000000000000000000000000000000000072',
      arbWasmAddress: '0x0000000000000000000000000000000000000071',
      cacheManagerAutomationAddress:
        process.env.ARB_SEPOLIA_CMA_ADDRESS ||
        '0x0000000000000000000000000000000000000000',
      originBlock: 109913803, // First TX on CM contract.
      enabled: process.env.ARB_SEPOLIA_ENABLED === 'true',
    },
    {
      name: 'Arbitrum Local',
      rpcUrl: process.env.ARB_LOCAL_RPC,
      rpcWssUrl: process.env.ARB_LOCAL_RPC_WSS,
      fastSyncRpcUrl: process.env.ARB_LOCAL_FAST_SYNC_RPC,
      chainId: 412346,
      cacheManagerAddress: '0x0f1f89aaf1c6fdb7ff9d361e4388f5f3997f12a8',
      arbWasmCacheAddress: '0x0000000000000000000000000000000000000072',
      arbWasmAddress: '0x0000000000000000000000000000000000000071',
      cacheManagerAutomationAddress:
        process.env.ARB_LOCAL_CMA_ADDRESS ||
        '0x0000000000000000000000000000000000000000',
      originBlock: 1,
      enabled: process.env.ARB_LOCAL_ENABLED === 'true',
    },
  ],
  eventTypes: [
    // CacheManager
    'InsertBid',
    'DeleteBid',
    'Pause',
    'Unpause',
    'SetCacheSize',
    'SetDecayRate',
    'Initialized',
    // CacheManagerAutomation
    'ContractAdded',
    'ContractUpdated',
    'ContractRemoved',
    'BidAttempted',
    'BidPlaced',
    'BidError',
    'BalanceUpdated',
    'UpkeepPerformed',
    'UserBalanceOperation',
  ],
});
