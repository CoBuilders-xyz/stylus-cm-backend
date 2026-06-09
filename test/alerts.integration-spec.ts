import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.integration') });

import { ethers } from 'ethers';
import {
  TestClient,
  waitForCondition,
  ChainClient,
  DbClient,
  advanceVmTime,
} from './utils';

const BACKEND_URL = process.env.BACKEND_URL!;
const RPC_URL = process.env.RPC_URL!;
const FUNDED_PK = process.env.FUNDED_PK!;
const FUNDED_ADDRESS = process.env.FUNDED_ADDRESS!;
const L2_OWNER_PK = process.env.L2_OWNER_PK!;
const CMA_ADDRESS = process.env.CMA_ADDRESS!;
const CACHE_MANAGER_ADDRESS = process.env.CACHE_MANAGER_ADDRESS!;
const MULTIPASS_VM_NAME = process.env.MULTIPASS_VM_NAME!;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const EVENT_WAIT_TIMEOUT = 60_000;
const EVENT_POLL_INTERVAL = 2_000;
const AUTOMATION_TIMEOUT = 180_000;
const ALERT_TRIGGER_TIMEOUT = 90_000;

const channelFlags = {
  webhookChannelEnabled: !!WEBHOOK_URL,
  telegramChannelEnabled: !!TELEGRAM_CHAT_ID,
};

describe('Alerts Integration Tests', () => {
  let api: TestClient;
  let chain: ChainClient;
  let db: DbClient;
  let blockchainId: string;

  let contract1: string;
  let contract2: string;
  let userContractId1: string;
  let userContractId2: string;

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

    console.log('Deploying 2 dummy WASM contracts for alerts test...');
    const addresses = chain.deployDummyWASM(2);
    contract1 = addresses[0];
    contract2 = addresses[1];
    console.log(`Deployed contract1=${contract1}, contract2=${contract2}`);

    console.log('Activating programs via ArbWasm...');
    await chain.activateProgram(contract1);
    await chain.activateProgram(contract2);
    console.log('Programs activated');

    await api.authenticate(FUNDED_ADDRESS, FUNDED_PK);
    console.log('Authenticated with backend');

    // Configure notification channels if env vars are set
    if (WEBHOOK_URL) {
      await api.patch('/users/alerts-settings/webhook', {
        enabled: true,
        destination: WEBHOOK_URL,
      });
      console.log(`Webhook notifications enabled: ${WEBHOOK_URL}`);
    }
    if (TELEGRAM_CHAT_ID) {
      await api.patch('/users/alerts-settings/telegram', {
        enabled: true,
        destination: TELEGRAM_CHAT_ID,
      });
      console.log(`Telegram notifications enabled: chatId=${TELEGRAM_CHAT_ID}`);
    }

    blockchainId = await api.getLocalBlockchainId();
    console.log(`Local blockchain ID: ${blockchainId}`);

    // Register contracts in backend
    const resp1 = await api.post('/user-contracts', {
      address: contract1,
      blockchainId,
    });
    userContractId1 = resp1.data.id;
    console.log(`Registered contract1 userContractId=${userContractId1}`);

    const resp2 = await api.post('/user-contracts', {
      address: contract2,
      blockchainId,
    });
    userContractId2 = resp2.data.id;
    console.log(`Registered contract2 userContractId=${userContractId2}`);

    // Register both in CMA
    await chain.insertContract(CMA_ADDRESS, contract1, {
      maxBid: ethers.parseEther('0.001'),
      enabled: true,
      autoActivate: false,
      maxActivationCost: 0n,
      funding: ethers.parseEther('0.005'),
    });
    await chain.insertContract(CMA_ADDRESS, contract2, {
      maxBid: ethers.parseEther('0.001'),
      enabled: true,
      autoActivate: false,
      maxActivationCost: 0n,
      funding: ethers.parseEther('0.005'),
    });

    await chain.fundBalance(CMA_ADDRESS, ethers.parseEther('0.02'));
    console.log(
      'CMA funded, waiting for automation to cache both contracts...',
    );

    // Wait for both contracts to be cached
    await waitForCondition(
      async () => {
        const c1 = await db.countEvents('InsertBid', contract1);
        const c2 = await db.countEvents('InsertBid', contract2);
        return c1 > 0 && c2 > 0;
      },
      AUTOMATION_TIMEOUT,
      EVENT_POLL_INTERVAL,
      'InsertBid events for both contracts',
    );
    console.log('Both contracts cached via automation');

    // Verify bytecode records exist (needed for alert matching)
    await waitForCondition(
      async () => {
        const cached1 = await db.isContractBytecodeCached(contract1);
        const cached2 = await db.isContractBytecodeCached(contract2);
        return cached1 && cached2;
      },
      EVENT_WAIT_TIMEOUT,
      EVENT_POLL_INTERVAL,
      'bytecodes marked as cached for both contracts',
    );
    console.log('Setup complete');
  }, 300_000);

  afterAll(async () => {
    await db.disconnect();
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Part 1: Alert CRUD Validation
  // ═══════════════════════════════════════════════════════════════════════

  let evictionAlertId1: string;
  let bidSafetyAlertId1: string;

  it('should create an eviction alert', async () => {
    const { data, status } = await api.post('/alerts', {
      type: 'eviction',
      isActive: true,
      userContractId: userContractId1,
      ...channelFlags,
    });

    expect(status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.type).toBe('eviction');
    expect(data.isActive).toBe(true);
    expect(data.triggeredCount).toBe(0);

    evictionAlertId1 = data.id;
    console.log(`Created eviction alert: ${evictionAlertId1}`);
  });

  it('should reject bidSafety alert without value', async () => {
    try {
      await api.post('/alerts', {
        type: 'bidSafety',
        isActive: true,
        userContractId: userContractId1,
      });
      fail('Expected 400 error for bidSafety without value');
    } catch (error: any) {
      expect(error.response?.status).toBe(400);
    }
  });

  it('should create a bidSafety alert with value', async () => {
    const { data, status } = await api.post('/alerts', {
      type: 'bidSafety',
      value: 50,
      isActive: true,
      userContractId: userContractId1,
      ...channelFlags,
    });

    expect(status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.type).toBe('bidSafety');
    expect(Number(data.value)).toBe(50);
    expect(data.isActive).toBe(true);
    expect(data.triggeredCount).toBe(0);

    bidSafetyAlertId1 = data.id;
    console.log(`Created bidSafety alert: ${bidSafetyAlertId1}`);
  });

  it('should upsert alert with updated value', async () => {
    const { data, status } = await api.post('/alerts', {
      type: 'bidSafety',
      value: 30,
      isActive: true,
      userContractId: userContractId1,
      ...channelFlags,
    });

    expect(status).toBe(201);
    expect(data.id).toBe(bidSafetyAlertId1);
    expect(Number(data.value)).toBe(30);

    // Verify only one bidSafety alert exists for this user-contract
    const alerts = await db.getAlertsByUserContract(userContractId1);
    const bidSafetyAlerts = alerts.filter((a: any) => a.type === 'bidSafety');
    expect(bidSafetyAlerts.length).toBe(1);
  });

  it('should list alerts for blockchain', async () => {
    const { data, status } = await api.get('/alerts', {
      blockchainId,
    });

    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(2);

    const types = data.map((a: any) => a.type);
    expect(types).toContain('eviction');
    expect(types).toContain('bidSafety');
  });

  it('should reject alert with invalid userContractId', async () => {
    try {
      await api.post('/alerts', {
        type: 'eviction',
        isActive: true,
        userContractId: '00000000-0000-0000-0000-000000000000',
      });
      fail('Expected error for non-existent userContractId');
    } catch (error: any) {
      expect(error.response?.status).toBeGreaterThanOrEqual(400);
    }
  });

  // Deactivate CRUD alerts before trigger tests to avoid interference
  it('should deactivate CRUD alerts before trigger tests', async () => {
    await api.post('/alerts', {
      type: 'eviction',
      isActive: false,
      userContractId: userContractId1,
      ...channelFlags,
    });
    await api.post('/alerts', {
      type: 'bidSafety',
      value: 30,
      isActive: false,
      userContractId: userContractId1,
      ...channelFlags,
    });

    const alert1 = await db.getAlertById(evictionAlertId1);
    expect(alert1.isActive).toBe(false);

    const alert2 = await db.getAlertById(bidSafetyAlertId1);
    expect(alert2.isActive).toBe(false);
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Part 2: Bid Safety Alert Triggering
  // ═══════════════════════════════════════════════════════════════════════

  let bidSafetyAlertId2: string;

  it('should create cache pressure via setCacheSize', async () => {
    const cm = chain.getCacheManager(CACHE_MANAGER_ADDRESS);
    const entries: any[] = await cm.getEntries();
    console.log(`Cache has ${entries.length} entries`);
    expect(entries.length).toBeGreaterThanOrEqual(2);

    const totalSize = entries.reduce(
      (sum: bigint, e: any) => sum + BigInt(e.size),
      0n,
    );
    console.log(`Total cached size: ${totalSize} bytes`);

    // Set cache size to exactly the total → cache is 100% full → minBid > 0
    await chain.setCacheSize(CACHE_MANAGER_ADDRESS, totalSize);
    console.log(`Cache size set to ${totalSize} (exactly full)`);

    const minBid = await chain.getMinBid(CACHE_MANAGER_ADDRESS, contract2);
    console.log(`getMinBid(contract2) = ${minBid}`);
  });

  it('should create bidSafety alert on contract2', async () => {
    const { data } = await api.post('/alerts', {
      type: 'bidSafety',
      value: 50,
      isActive: true,
      userContractId: userContractId2,
      ...channelFlags,
    });

    expect(data.id).toBeDefined();
    bidSafetyAlertId2 = data.id;
    console.log(`Created bidSafety alert on contract2: ${bidSafetyAlertId2}`);
  });

  it(
    'should trigger bidSafety alert after cron evaluation',
    async () => {
      // The cron runs every minute. Wait for at least one cycle.
      await waitForCondition(
        async () => {
          const alert = await db.getAlertById(bidSafetyAlertId2);
          return alert && alert.triggeredCount > 0;
        },
        ALERT_TRIGGER_TIMEOUT,
        5_000,
        'bidSafety alert triggeredCount > 0',
      );

      const alert = await db.getAlertById(bidSafetyAlertId2);
      expect(alert.triggeredCount).toBeGreaterThan(0);
      expect(alert.lastTriggered).toBeDefined();
      console.log(
        `bidSafety alert triggered: count=${alert.triggeredCount}, lastTriggered=${alert.lastTriggered}`,
      );
    },
    ALERT_TRIGGER_TIMEOUT + 10_000,
  );

  it('should not re-trigger deactivated bidSafety alert', async () => {
    // Record current count
    const alertBefore = await db.getAlertById(bidSafetyAlertId2);
    const countBefore = alertBefore.triggeredCount;

    // Deactivate
    await api.post('/alerts', {
      type: 'bidSafety',
      value: 50,
      isActive: false,
      userContractId: userContractId2,
      ...channelFlags,
    });

    const deactivated = await db.getAlertById(bidSafetyAlertId2);
    expect(deactivated.isActive).toBe(false);

    // Wait 70s for at least one cron cycle to pass
    await new Promise((r) => setTimeout(r, 70_000));

    const alertAfter = await db.getAlertById(bidSafetyAlertId2);
    expect(alertAfter.triggeredCount).toBe(countBefore);
    console.log(
      `Deactivated bidSafety alert not re-triggered (count stayed at ${countBefore})`,
    );
  }, 100_000);

  // ═══════════════════════════════════════════════════════════════════════
  //  Part 3: Eviction Alert Triggering
  // ═══════════════════════════════════════════════════════════════════════

  let evictionAlertId2: string;

  it('should create active eviction alert on contract2', async () => {
    const { data } = await api.post('/alerts', {
      type: 'eviction',
      isActive: true,
      userContractId: userContractId2,
      ...channelFlags,
    });

    expect(data.id).toBeDefined();
    evictionAlertId2 = data.id;
    console.log(
      `Created active eviction alert on contract2: ${evictionAlertId2}`,
    );
  });

  it('should verify inactive eviction alert exists on contract1', async () => {
    // contract1's eviction alert was deactivated in the CRUD cleanup step
    const alert = await db.getAlertById(evictionAlertId1);
    expect(alert).toBeDefined();
    expect(alert.isActive).toBe(false);
    expect(alert.triggeredCount).toBe(0);
  });

  it('should trigger eviction via evictAll', async () => {
    // Restore a large cache size first so evictAll works cleanly
    await chain.setCacheSize(CACHE_MANAGER_ADDRESS, BigInt(64 * 1024 * 1024));

    const deleteBidCountBefore = await db.countEvents('DeleteBid');
    console.log(`DeleteBid events before evictAll: ${deleteBidCountBefore}`);

    await chain.evictAll(CACHE_MANAGER_ADDRESS);
    console.log('evictAll called');

    // Wait for DeleteBid events to be ingested
    await waitForCondition(
      async () => {
        const count = await db.countEvents('DeleteBid');
        return count > deleteBidCountBefore;
      },
      EVENT_WAIT_TIMEOUT,
      EVENT_POLL_INTERVAL,
      'new DeleteBid events after evictAll',
    );

    const deleteBidCount = await db.countEvents('DeleteBid');
    console.log(`DeleteBid events after evictAll: ${deleteBidCount}`);
    expect(deleteBidCount).toBeGreaterThan(deleteBidCountBefore);
  });

  it(
    'should verify active eviction alert triggered on contract2',
    async () => {
      await waitForCondition(
        async () => {
          const alert = await db.getAlertById(evictionAlertId2);
          return alert && alert.triggeredCount > 0;
        },
        ALERT_TRIGGER_TIMEOUT,
        EVENT_POLL_INTERVAL,
        'eviction alert triggeredCount > 0 for contract2',
      );

      const alert = await db.getAlertById(evictionAlertId2);
      expect(alert.triggeredCount).toBeGreaterThan(0);
      expect(alert.lastTriggered).toBeDefined();
      console.log(
        `Eviction alert triggered: count=${alert.triggeredCount}, lastTriggered=${alert.lastTriggered}`,
      );
    },
    ALERT_TRIGGER_TIMEOUT + 10_000,
  );

  it('should verify inactive eviction alert NOT triggered on contract1', async () => {
    const alert = await db.getAlertById(evictionAlertId1);
    expect(alert.triggeredCount).toBe(0);
    expect(alert.lastTriggered).toBeNull();
    console.log('Inactive eviction alert correctly not triggered');
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Part 4: Gas Alerts (noGas / lowGas)
  // ═══════════════════════════════════════════════════════════════════════

  let noGasAlertId: string;
  let lowGasAlertId: string;

  it('should reject lowGas alert without value', async () => {
    try {
      await api.post('/alerts', {
        type: 'lowGas',
        isActive: true,
        userContractId: userContractId1,
      });
      fail('Expected 400 error for lowGas without value');
    } catch (error: any) {
      expect(error.response?.status).toBe(400);
    }
  });

  it('should create a noGas alert (no value needed)', async () => {
    const { data, status } = await api.post('/alerts', {
      type: 'noGas',
      isActive: true,
      userContractId: userContractId1,
      ...channelFlags,
    });

    expect(status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.type).toBe('noGas');
    expect(data.isActive).toBe(true);
    expect(data.triggeredCount).toBe(0);

    noGasAlertId = data.id;
    console.log(`Created noGas alert: ${noGasAlertId}`);
  });

  it('should create a lowGas alert with ETH threshold', async () => {
    const { data, status } = await api.post('/alerts', {
      type: 'lowGas',
      value: 10,
      isActive: true,
      userContractId: userContractId1,
      ...channelFlags,
    });

    expect(status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.type).toBe('lowGas');
    expect(Number(data.value)).toBe(10);
    expect(data.isActive).toBe(true);
    expect(data.triggeredCount).toBe(0);

    lowGasAlertId = data.id;
    console.log(`Created lowGas alert (threshold=10 ETH): ${lowGasAlertId}`);
  });

  it(
    'should trigger lowGas alert when balance is below threshold',
    async () => {
      // The lowGas threshold is 10 ETH — escrow balance is well below that
      const balance = await chain.getUserBalance(CMA_ADDRESS);
      console.log(`Current escrow balance: ${ethers.formatEther(balance)} ETH`);
      expect(balance).toBeLessThan(ethers.parseEther('10'));

      await waitForCondition(
        async () => {
          const alert = await db.getAlertById(lowGasAlertId);
          return alert && alert.triggeredCount > 0;
        },
        ALERT_TRIGGER_TIMEOUT,
        5_000,
        'lowGas alert triggeredCount > 0',
      );

      const alert = await db.getAlertById(lowGasAlertId);
      expect(alert.triggeredCount).toBeGreaterThan(0);
      expect(alert.lastTriggered).toBeDefined();
      console.log(
        `lowGas alert triggered: count=${alert.triggeredCount}, lastTriggered=${alert.lastTriggered}`,
      );
    },
    ALERT_TRIGGER_TIMEOUT + 10_000,
  );

  it('should deactivate lowGas alert', async () => {
    await api.post('/alerts', {
      type: 'lowGas',
      value: 10,
      isActive: false,
      userContractId: userContractId1,
      ...channelFlags,
    });

    const alert = await db.getAlertById(lowGasAlertId);
    expect(alert.isActive).toBe(false);
    console.log('lowGas alert deactivated');
  });

  it('should trigger noGas alert after withdrawing all balance', async () => {
    const balanceBefore = await chain.getUserBalance(CMA_ADDRESS);
    console.log(
      `Escrow balance before withdraw: ${ethers.formatEther(balanceBefore)} ETH`,
    );

    await chain.withdrawBalance(CMA_ADDRESS);

    const balanceAfter = await chain.getUserBalance(CMA_ADDRESS);
    console.log(
      `Escrow balance after withdraw: ${ethers.formatEther(balanceAfter)} ETH`,
    );
    expect(balanceAfter).toBe(0n);
  });

  it(
    'should verify noGas alert triggered after cron evaluation',
    async () => {
      await waitForCondition(
        async () => {
          const alert = await db.getAlertById(noGasAlertId);
          return alert && alert.triggeredCount > 0;
        },
        ALERT_TRIGGER_TIMEOUT,
        5_000,
        'noGas alert triggeredCount > 0',
      );

      const alert = await db.getAlertById(noGasAlertId);
      expect(alert.triggeredCount).toBeGreaterThan(0);
      expect(alert.lastTriggered).toBeDefined();
      console.log(
        `noGas alert triggered: count=${alert.triggeredCount}, lastTriggered=${alert.lastTriggered}`,
      );
    },
    ALERT_TRIGGER_TIMEOUT + 10_000,
  );

  it('should not re-trigger deactivated noGas alert', async () => {
    const alertBefore = await db.getAlertById(noGasAlertId);
    const countBefore = alertBefore.triggeredCount;

    await api.post('/alerts', {
      type: 'noGas',
      isActive: false,
      userContractId: userContractId1,
      ...channelFlags,
    });

    const deactivated = await db.getAlertById(noGasAlertId);
    expect(deactivated.isActive).toBe(false);

    // Wait 70s for at least one cron cycle
    await new Promise((r) => setTimeout(r, 70_000));

    const alertAfter = await db.getAlertById(noGasAlertId);
    expect(alertAfter.triggeredCount).toBe(countBefore);
    console.log(
      `Deactivated noGas alert not re-triggered (count stayed at ${countBefore})`,
    );
  }, 100_000);

  // ═══════════════════════════════════════════════════════════════════════
  //  Part 5: Activation Lifecycle Alerts
  // ═══════════════════════════════════════════════════════════════════════

  let activationContract: string;
  let activationUserContractId: string;
  let approachingExpirationAlertId: string;
  let expiredAlertId: string;
  let reactivationSucceededAlertId: string;
  let reactivationFailedAlertId: string;

  it(
    'should setup activation test: deploy, activate, register with autoActivate',
    async () => {
      // Set short expiry: 1 day, no keepalive protection
      console.log('Setting WasmExpiryDays=1, WasmKeepaliveDays=0...');
      await chain.setWasmExpiryDays(1);
      await chain.setWasmKeepaliveDays(0);

      // Deploy and activate a fresh WASM contract
      console.log('Deploying 1 WASM contract for activation alerts...');
      const addresses = chain.deployDummyWASM(1);
      activationContract = addresses[0];
      console.log(`Deployed activationContract=${activationContract}`);

      console.log('Activating program via ArbWasm...');
      await chain.activateProgram(activationContract);

      const timeLeft = await chain.programTimeLeft(activationContract);
      console.log(`programTimeLeft = ${timeLeft}s`);
      expect(timeLeft).toBeGreaterThan(0n);

      // Register in backend
      const resp = await api.post('/user-contracts', {
        address: activationContract,
        blockchainId,
      });
      activationUserContractId = resp.data.id;
      console.log(
        `Registered activationContract userContractId=${activationUserContractId}`,
      );

      // Register in CMA with autoActivate=true and fund escrow for re-activation
      await chain.insertContract(CMA_ADDRESS, activationContract, {
        maxBid: ethers.parseEther('0.001'),
        enabled: true,
        autoActivate: true,
        maxActivationCost: ethers.parseEther('0.1'),
        funding: ethers.parseEther('0.2'),
      });
      console.log(
        'Registered in CMA with autoActivate=true, funded escrow',
      );
    },
    120_000,
  );

  // --- CRUD ---

  it('should reject approachingExpiration alert without value', async () => {
    try {
      await api.post('/alerts', {
        type: 'approachingExpiration',
        isActive: true,
        userContractId: activationUserContractId,
      });
      fail('Expected 400 error for approachingExpiration without value');
    } catch (error: any) {
      expect(error.response?.status).toBe(400);
    }
  });

  it('should create approachingExpiration alert', async () => {
    const { data, status } = await api.post('/alerts', {
      type: 'approachingExpiration',
      value: 1, // 1 day threshold
      isActive: true,
      userContractId: activationUserContractId,
      ...channelFlags,
    });

    expect(status).toBe(201);
    expect(data.type).toBe('approachingExpiration');
    expect(Number(data.value)).toBe(1);
    approachingExpirationAlertId = data.id;
    console.log(
      `Created approachingExpiration alert: ${approachingExpirationAlertId}`,
    );
  });

  it('should create expired alert', async () => {
    const { data, status } = await api.post('/alerts', {
      type: 'expired',
      isActive: true,
      userContractId: activationUserContractId,
      ...channelFlags,
    });

    expect(status).toBe(201);
    expect(data.type).toBe('expired');
    expiredAlertId = data.id;
    console.log(`Created expired alert: ${expiredAlertId}`);
  });

  it('should create reactivationSucceeded alert', async () => {
    const { data, status } = await api.post('/alerts', {
      type: 'reactivationSucceeded',
      isActive: true,
      userContractId: activationUserContractId,
      ...channelFlags,
    });

    expect(status).toBe(201);
    expect(data.type).toBe('reactivationSucceeded');
    reactivationSucceededAlertId = data.id;
    console.log(
      `Created reactivationSucceeded alert: ${reactivationSucceededAlertId}`,
    );
  });

  it('should create reactivationFailed alert', async () => {
    const { data, status } = await api.post('/alerts', {
      type: 'reactivationFailed',
      isActive: true,
      userContractId: activationUserContractId,
      ...channelFlags,
    });

    expect(status).toBe(201);
    expect(data.type).toBe('reactivationFailed');
    reactivationFailedAlertId = data.id;
    console.log(
      `Created reactivationFailed alert: ${reactivationFailedAlertId}`,
    );
  });

  // --- Trigger: approachingExpiration ---
  // Program was activated with 1-day expiry, threshold is 1 day.
  // As soon as any seconds tick, timeLeft < 86400 → triggers.

  it(
    'should trigger approachingExpiration alert via cron',
    async () => {
      await waitForCondition(
        async () => {
          const alert = await db.getAlertById(approachingExpirationAlertId);
          return alert && alert.triggeredCount > 0;
        },
        ALERT_TRIGGER_TIMEOUT,
        5_000,
        'approachingExpiration triggeredCount > 0',
      );

      const alert = await db.getAlertById(approachingExpirationAlertId);
      expect(alert.triggeredCount).toBeGreaterThan(0);
      expect(alert.lastTriggered).toBeDefined();
      console.log(
        `approachingExpiration alert triggered: count=${alert.triggeredCount}`,
      );
    },
    ALERT_TRIGGER_TIMEOUT + 10_000,
  );

  it('should deactivate approachingExpiration alert before time advance', async () => {
    await api.post('/alerts', {
      type: 'approachingExpiration',
      value: 1,
      isActive: false,
      userContractId: activationUserContractId,
      ...channelFlags,
    });
    const alert = await db.getAlertById(approachingExpirationAlertId);
    expect(alert.isActive).toBe(false);
    console.log('approachingExpiration alert deactivated');
  });

  // --- Time advance to expire the program ---

  it(
    'should advance VM time by 25 hours to expire the program',
    async () => {
      console.log('Advancing VM time by 25 hours...');
      await advanceVmTime(MULTIPASS_VM_NAME, 25, chain);
      console.log('VM time advanced');

      const timeLeft = await chain.programTimeLeft(activationContract);
      console.log(`programTimeLeft after advance = ${timeLeft}s`);
      expect(timeLeft).toBeLessThanOrEqual(0n);
    },
    60_000,
  );

  // --- Trigger: expired ---

  it(
    'should trigger expired alert after program expiry',
    async () => {
      await waitForCondition(
        async () => {
          const alert = await db.getAlertById(expiredAlertId);
          return alert && alert.triggeredCount > 0;
        },
        ALERT_TRIGGER_TIMEOUT,
        5_000,
        'expired alert triggeredCount > 0',
      );

      const alert = await db.getAlertById(expiredAlertId);
      expect(alert.triggeredCount).toBeGreaterThan(0);
      expect(alert.lastTriggered).toBeDefined();
      console.log(`expired alert triggered: count=${alert.triggeredCount}`);
    },
    ALERT_TRIGGER_TIMEOUT + 10_000,
  );

  // --- Trigger: reactivationSucceeded ---
  // CMA automation should detect expired autoActivate=true contract and re-activate.
  // This emits ActivationPerformed which triggers the alert.

  it(
    'should trigger reactivationSucceeded after CMA re-activates',
    async () => {
      await waitForCondition(
        async () => {
          const alert = await db.getAlertById(reactivationSucceededAlertId);
          return alert && alert.triggeredCount > 0;
        },
        AUTOMATION_TIMEOUT,
        5_000,
        'reactivationSucceeded triggeredCount > 0',
      );

      const alert = await db.getAlertById(reactivationSucceededAlertId);
      expect(alert.triggeredCount).toBeGreaterThan(0);
      expect(alert.lastTriggered).toBeDefined();
      console.log(
        `reactivationSucceeded alert triggered: count=${alert.triggeredCount}`,
      );

      // Verify program is active again
      const timeLeft = await chain.programTimeLeft(activationContract);
      console.log(`programTimeLeft after re-activation = ${timeLeft}s`);
      expect(timeLeft).toBeGreaterThan(0n);
    },
    AUTOMATION_TIMEOUT + 30_000,
  );

  // --- Negative: deactivated expired alert should not re-trigger ---

  it('should deactivate expired alert', async () => {
    await api.post('/alerts', {
      type: 'expired',
      isActive: false,
      userContractId: activationUserContractId,
      ...channelFlags,
    });
    const alert = await db.getAlertById(expiredAlertId);
    expect(alert.isActive).toBe(false);
    console.log('expired alert deactivated');
  });

  it('should verify reactivationFailed alert exists but was not triggered', async () => {
    const alert = await db.getAlertById(reactivationFailedAlertId);
    expect(alert).toBeDefined();
    expect(alert.type).toBe('reactivationFailed');
    expect(alert.isActive).toBe(true);
    expect(alert.triggeredCount).toBe(0);
    console.log(
      'reactivationFailed alert exists, not triggered (no ActivationError occurred)',
    );
  });
});
