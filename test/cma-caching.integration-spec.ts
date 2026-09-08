import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.integration') });

import { ethers } from 'ethers';
import { TestClient, waitForCondition, ChainClient, DbClient } from './utils';

const BACKEND_URL = process.env.BACKEND_URL!;
const RPC_URL = process.env.RPC_URL!;
const FUNDED_PK = process.env.FUNDED_PK!;
const FUNDED_ADDRESS = process.env.FUNDED_ADDRESS!;
const L2_OWNER_PK = process.env.L2_OWNER_PK!;
const CMA_ADDRESS = process.env.CMA_ADDRESS!;

const EVENT_WAIT_TIMEOUT = 60_000;
const EVENT_POLL_INTERVAL = 2_000;

describe('CMA Caching - Full User Journey', () => {
  let api: TestClient;
  let chain: ChainClient;
  let db: DbClient;
  let blockchainId: string;

  let dummy1: string;
  let dummy2: string;

  beforeAll(async () => {
    api = new TestClient(BACKEND_URL);
    chain = new ChainClient(RPC_URL, FUNDED_PK, L2_OWNER_PK);
    db = new DbClient({
      host: process.env.POSTGRES_HOST!,
      port: parseInt(process.env.POSTGRES_PORT!, 10),
      user: process.env.POSTGRES_USER!,
      password: process.env.POSTGRES_PASSWORD!,
      database: process.env.POSTGRES_DB!,
    });

    await db.connect();

    // Deploy 2 dummy WASM contracts
    console.log('Deploying 2 dummy WASM contracts...');
    const addresses = chain.deployDummyWASM(2);
    dummy1 = addresses[0];
    dummy2 = addresses[1];
    console.log(`Deployed dummy1=${dummy1}, dummy2=${dummy2}`);

    // Activate programs via ArbWasm (required before caching)
    console.log('Activating programs via ArbWasm...');
    await chain.activateProgram(dummy1);
    await chain.activateProgram(dummy2);
    console.log('Programs activated');

    // Authenticate with backend
    await api.authenticate(FUNDED_ADDRESS, FUNDED_PK);
    console.log('Authenticated with backend');

    // Get local blockchain ID
    blockchainId = await api.getLocalBlockchainId();
    console.log(`Local blockchain ID: ${blockchainId}`);
  }, 180_000);

  afterAll(async () => {
    await db.disconnect();
  });

  it('should save contract in backend via API first', async () => {
    try {
      const { data, status } = await api.post('/user-contracts', {
        address: dummy1,
        blockchainId,
      });
      expect(status).toBe(201);
      expect(data).toBeDefined();
    } catch (error: any) {
      expect(error.response?.status).toBe(409);
    }
  });

  it('should register contract in CMA and backend picks up ContractAdded event', async () => {
    await chain.insertContract(CMA_ADDRESS, dummy1, {
      maxBid: ethers.parseEther('0.001'),
      biddingEnabled: true,
      autoActivate: false,
      maxActivationCost: 0n,
      funding: ethers.parseEther('0.005'),
    });

    // Wait for backend to ingest the ContractAdded event
    await waitForCondition(
      async () => {
        const count = await db.countEvents('ContractAdded', dummy1);
        return count > 0;
      },
      EVENT_WAIT_TIMEOUT,
      EVENT_POLL_INTERVAL,
      'ContractAdded event for dummy1',
    );

    // Contract already exists in DB (saved via API above), so isAutomated should be set
    await waitForCondition(
      async () => {
        const contract = await db.getContractByAddress(dummy1);
        return contract && contract.isAutomated === true;
      },
      EVENT_WAIT_TIMEOUT,
      EVENT_POLL_INTERVAL,
      'contract.isAutomated=true for dummy1',
    );

    const contract = await db.getContractByAddress(dummy1);
    expect(contract).toBeDefined();
    expect(contract.isAutomated).toBe(true);
    expect(contract.maxBid).toBeDefined();
  });

  it('should fund escrow and verify BalanceUpdated event in DB', async () => {
    const countBefore = await db.countEvents('BalanceUpdated');

    await chain.fundBalance(CMA_ADDRESS, ethers.parseEther('0.01'));

    await waitForCondition(
      async () => {
        const count = await db.countEvents('BalanceUpdated');
        return count > countBefore;
      },
      EVENT_WAIT_TIMEOUT,
      EVENT_POLL_INTERVAL,
      'new BalanceUpdated event after fundBalance',
    );

    const events = await db.getEventsByName('BalanceUpdated');
    expect(events.length).toBeGreaterThan(countBefore);

    const latestEvent = events[0]; // ordered by blockNumber DESC
    expect(latestEvent.eventData).toBeDefined();
  });

  it('should wait for backend automation to execute placeBids and cache contract', async () => {
    const AUTOMATION_TIMEOUT = 120_000;

    // The backend automation cron (@Cron EVERY_MINUTE) should select dummy1
    // (biddingEnabled, not cached, maxBid >= minBid, funded) and call placeBids via
    // the automation orchestrator. Any InsertBid event is proof the automation
    // engine executed successfully.

    await waitForCondition(
      async () => {
        const count = await db.countEvents('InsertBid', dummy1);
        return count > 0;
      },
      AUTOMATION_TIMEOUT,
      EVENT_POLL_INTERVAL,
      'InsertBid event for dummy1 placed by backend automation',
    );

    const events = await db.getEventsByName('InsertBid', dummy1);
    expect(events.length).toBeGreaterThan(0);

    // Verify the contract's bytecode is now marked as cached in the DB
    await waitForCondition(
      async () => db.isContractBytecodeCached(dummy1),
      EVENT_WAIT_TIMEOUT,
      EVENT_POLL_INTERVAL,
      'bytecode.isCached=true for dummy1 after automation bid',
    );

    const isCached = await db.isContractBytecodeCached(dummy1);
    expect(isCached).toBe(true);
  }, 180_000);

  it('should update contract maxBid and verify ContractUpdated event', async () => {
    const countBefore = await db.countEvents('ContractUpdated', dummy1);
    const contractBefore = await db.getContractByAddress(dummy1);
    const newMaxBid = ethers.parseEther('0.002');

    await chain.updateContract(CMA_ADDRESS, dummy1, {
      maxBid: newMaxBid,
      biddingEnabled: true,
      autoActivate: false,
      maxActivationCost: 0n,
    });

    await waitForCondition(
      async () => {
        const count = await db.countEvents('ContractUpdated', dummy1);
        return count > countBefore;
      },
      EVENT_WAIT_TIMEOUT,
      EVENT_POLL_INTERVAL,
      'new ContractUpdated event for dummy1 after updateContract',
    );

    const events = await db.getEventsByName('ContractUpdated', dummy1);
    expect(events.length).toBeGreaterThan(countBefore);

    const contractAfter = await db.getContractByAddress(dummy1);
    expect(contractAfter).toBeDefined();
    expect(contractAfter.maxBid).not.toEqual(contractBefore.maxBid);
  });

  it('should register second contract and automation caches it too', async () => {
    const AUTOMATION_TIMEOUT = 120_000;

    // Save via API first so the contract row exists when ContractAdded is processed
    try {
      await api.post('/user-contracts', {
        address: dummy2,
        blockchainId,
      });
    } catch {
      // 409 is fine if it already exists
    }

    const insertBidCountBefore = await db.countEvents('InsertBid', dummy2);

    await chain.insertContract(CMA_ADDRESS, dummy2, {
      maxBid: ethers.parseEther('0.001'),
      biddingEnabled: true,
      autoActivate: false,
      maxActivationCost: 0n,
      funding: ethers.parseEther('0.005'),
    });

    await waitForCondition(
      async () => {
        const count = await db.countEvents('ContractAdded', dummy2);
        return count > 0;
      },
      EVENT_WAIT_TIMEOUT,
      EVENT_POLL_INTERVAL,
      'ContractAdded event for dummy2',
    );

    // Wait for automation to pick up dummy2 and place bid
    await waitForCondition(
      async () => {
        const count = await db.countEvents('InsertBid', dummy2);
        return count > insertBidCountBefore;
      },
      AUTOMATION_TIMEOUT,
      EVENT_POLL_INTERVAL,
      'InsertBid event for dummy2 placed by automation',
    );

    const events = await db.getEventsByName('InsertBid', dummy2);
    expect(events.length).toBeGreaterThan(insertBidCountBefore);

    // Verify dummy2's bytecode is also cached
    await waitForCondition(
      async () => db.isContractBytecodeCached(dummy2),
      EVENT_WAIT_TIMEOUT,
      EVENT_POLL_INTERVAL,
      'bytecode.isCached=true for dummy2 after automation bid',
    );

    const isCached = await db.isContractBytecodeCached(dummy2);
    expect(isCached).toBe(true);
  }, 180_000);

  it('should remove contract and verify ContractRemoved event in DB', async () => {
    await chain.removeContract(CMA_ADDRESS, dummy1);

    await waitForCondition(
      async () => {
        const count = await db.countEvents('ContractRemoved', dummy1);
        return count > 0;
      },
      EVENT_WAIT_TIMEOUT,
      EVENT_POLL_INTERVAL,
      'ContractRemoved event for dummy1',
    );

    const events = await db.getEventsByName('ContractRemoved', dummy1);
    expect(events.length).toBeGreaterThan(0);
  });

  it('should return enriched contract data via user-contracts API', async () => {
    const { data } = await api.get('/user-contracts', { blockchainId });

    expect(data).toBeDefined();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);

    const contracts = data.data;
    expect(contracts.length).toBeGreaterThanOrEqual(1);
  });

  it('should return contract data via public contracts API', async () => {
    const { data } = await api.get('/contracts', { blockchainId });

    expect(data).toBeDefined();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
  });
});
