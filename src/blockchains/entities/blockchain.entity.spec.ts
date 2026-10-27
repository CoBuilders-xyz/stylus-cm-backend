import { instanceToPlain, plainToInstance } from 'class-transformer';
import { getMetadataArgsStorage } from 'typeorm';
import { Blockchain, PUBLIC_BLOCKCHAIN_SELECT } from './blockchain.entity';

const SECRET_COLUMNS = ['rpcUrl', 'fastSyncRpcUrl', 'rpcWssUrl'] as const;

const FAKE_RPC_URL = 'https://rpc.example/v2/FAKEKEY';
const FAKE_FAST_SYNC_RPC_URL = 'https://fast-rpc.example/v2/FAKEKEY';
const FAKE_RPC_WSS_URL = 'wss://ws.example/v2/FAKEKEY';

function createBlockchain(): Blockchain {
  return Object.assign(new Blockchain(), {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Fixture Chain',
    rpcUrl: FAKE_RPC_URL,
    fastSyncRpcUrl: FAKE_FAST_SYNC_RPC_URL,
    rpcWssUrl: FAKE_RPC_WSS_URL,
    cacheManagerAddress: '0x' + '1'.repeat(40),
    cacheManagerAutomationAddress: '0x' + '2'.repeat(40),
    arbWasmCacheAddress: '0x' + '3'.repeat(40),
    arbWasmAddress: '0x' + '4'.repeat(40),
    chainId: 421614,
    originBlock: 0,
    lastSyncedBlock: 100,
    lastProcessedBlockNumber: 100,
    enabled: true,
  });
}

describe('Blockchain entity serialization', () => {
  it('keeps RPC URLs under JSON.stringify (BullMQ job payloads in Redis)', () => {
    const json = JSON.parse(JSON.stringify(createBlockchain())) as Record<
      string,
      unknown
    >;

    expect(json.rpcUrl).toBe(FAKE_RPC_URL);
    expect(json.fastSyncRpcUrl).toBe(FAKE_FAST_SYNC_RPC_URL);
    expect(json.rpcWssUrl).toBe(FAKE_RPC_WSS_URL);
  });

  it('drops RPC URLs under instanceToPlain (HTTP responses)', () => {
    const plain = instanceToPlain(createBlockchain());

    for (const column of SECRET_COLUMNS) {
      expect(plain).not.toHaveProperty(column);
    }
    expect(plain).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Fixture Chain',
      chainId: 421614,
      enabled: true,
    });
  });

  it('drops RPC URLs from blockchains nested in plain objects and arrays', () => {
    const plain = instanceToPlain({
      contract: { blockchain: createBlockchain() },
      list: [createBlockchain()],
    });

    expect(JSON.stringify(plain)).not.toContain('FAKEKEY');
    expect(plain).toMatchObject({
      contract: { blockchain: { chainId: 421614 } },
      list: [{ chainId: 421614 }],
    });
  });

  it('keeps RPC URLs when hydrating with plainToInstance (exclusion is toPlainOnly)', () => {
    const hydrated = plainToInstance(
      Blockchain,
      JSON.parse(JSON.stringify(createBlockchain())) as object,
    );

    expect(hydrated.rpcUrl).toBe(FAKE_RPC_URL);
    expect(hydrated.fastSyncRpcUrl).toBe(FAKE_FAST_SYNC_RPC_URL);
    expect(hydrated.rpcWssUrl).toBe(FAKE_RPC_WSS_URL);
  });

  it('public select allowlist covers every column except the secret ones', () => {
    const entityColumns = getMetadataArgsStorage()
      .columns.filter((column) => column.target === Blockchain)
      .map((column) => column.propertyName)
      .sort();

    for (const column of SECRET_COLUMNS) {
      expect(PUBLIC_BLOCKCHAIN_SELECT).not.toHaveProperty(column);
    }
    expect(
      [...Object.keys(PUBLIC_BLOCKCHAIN_SELECT), ...SECRET_COLUMNS].sort(),
    ).toEqual(entityColumns);
  });
});
