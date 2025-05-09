export default () => ({
  blockchains: [
    {
      name: 'Arbitrum Local',
      rpcUrl: 'http://localhost:8547',
      chainId: 412346,
      cacheManagerAddress: '0x0f1f89aaf1c6fdb7ff9d361e4388f5f3997f12a8',
      arbWasmCacheAddress: '0x0000000000000000000000000000000000000072',
      cacheManagerAutomationAddress:
        '0x343FAF37071Ae1Bb8676b5a116c82D9db52696C0',
      lastSyncedBlock: 0,
    },
    // {
    //   name: 'Arbitrum Sepolia',
    //   rpcUrl: 'https://arb-sepolia.g.alchemy.com/v2/4Fz5j6zHZW8RjDfSnUmER1rvh4iiBWgm',
    //   chainId: 421614,
    //   cacheManagerAddress: '0x0c9043d042ab52cfa8d0207459260040cca54253',
    //   arbWasmCacheAddress: '0x0000000000000000000000000000000000000072',
    //   lastSyncedBlock: 0,
    // },
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
