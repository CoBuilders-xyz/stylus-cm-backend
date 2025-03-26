export default () => ({
  blockchains: [
    {
      name: 'Arbitrum Local',
      rpcUrl: 'http://localhost:8547',
      chainId: 412346,
      cacheManagerAddress: '0x0f1f89aaf1c6fdb7ff9d361e4388f5f3997f12a8',
      arbWasmCacheAddress: '0x0000000000000000000000000000000000000072',
      lastSyncedBlock: 0,
    },
    // {
    //   name: 'Arbitrum Sepolia',
    //   rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    //   chainId: 421614,
    //   cacheManagerAddress: '0x0c9043d042ab52cfa8d0207459260040cca54253',
    //   lastSyncedBlock: 0,
    // },
  ],
});
