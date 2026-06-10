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
const MULTIPASS_VM_NAME = process.env.MULTIPASS_VM_NAME!;

const EVENT_WAIT_TIMEOUT = 60_000;
const EVENT_POLL_INTERVAL = 2_000;
const AUTOMATION_TIMEOUT = 180_000;

describe('CMA Activation - Auto-Reactivation Flow', () => {
  let api: TestClient;
  let chain: ChainClient;
  let db: DbClient;
  let blockchainId: string;

  let autoActivateContract: string;
  let controlContract: string;

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
    console.log('Deploying 2 dummy WASM contracts for activation test...');
    const addresses = chain.deployDummyWASM(2);
    autoActivateContract = addresses[0];
    controlContract = addresses[1];
    console.log(
      `Deployed autoActivate=${autoActivateContract}, control=${controlContract}`,
    );

    // Set short expiry: 1 day expiry, 0 keepalive days
    console.log('Setting WasmExpiryDays=1, WasmKeepaliveDays=0...');
    await chain.setWasmExpiryDays(1);
    await chain.setWasmKeepaliveDays(0);
    console.log('WASM expiry configured');

    // Activate both programs via ArbWasm
    console.log('Activating programs via ArbWasm...');
    await chain.activateProgram(autoActivateContract);
    await chain.activateProgram(controlContract);
    console.log('Programs activated');

    // Verify both have programTimeLeft > 0
    const timeLeft1 = await chain.programTimeLeft(autoActivateContract);
    const timeLeft2 = await chain.programTimeLeft(controlContract);
    console.log(
      `programTimeLeft: autoActivate=${timeLeft1}s, control=${timeLeft2}s`,
    );
    expect(timeLeft1).toBeGreaterThan(0n);
    expect(timeLeft2).toBeGreaterThan(0n);

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

  it('should save both contracts in backend via API', async () => {
    const { status: status1 } = await api.post('/user-contracts', {
      address: autoActivateContract,
      blockchainId,
    });
    expect(status1).toBe(201);

    const { status: status2 } = await api.post('/user-contracts', {
      address: controlContract,
      blockchainId,
    });
    expect(status2).toBe(201);
  });

  it('should register autoActivate=true contract in CMA', async () => {
    await chain.insertContract(CMA_ADDRESS, autoActivateContract, {
      maxBid: ethers.parseEther('0.001'),
      enabled: true,
      autoActivate: true,
      maxActivationCost: ethers.parseEther('0.01'),
      funding: ethers.parseEther('0.02'),
    });

    await waitForCondition(
      async () => {
        const count = await db.countEvents(
          'ContractAdded',
          autoActivateContract,
        );
        return count > 0;
      },
      EVENT_WAIT_TIMEOUT,
      EVENT_POLL_INTERVAL,
      'ContractAdded event for autoActivateContract',
    );

    await waitForCondition(
      async () => {
        const contract = await db.getContractByAddress(autoActivateContract);
        return contract && contract.autoActivate === true;
      },
      EVENT_WAIT_TIMEOUT,
      EVENT_POLL_INTERVAL,
      'contract.autoActivate=true in DB',
    );

    const contract = await db.getContractByAddress(autoActivateContract);
    expect(contract).toBeDefined();
    expect(contract.isAutomated).toBe(true);
    expect(contract.autoActivate).toBe(true);
    expect(BigInt(contract.maxActivationCost)).toBeGreaterThan(0n);
  });

  it('should register control contract with autoActivate=false', async () => {
    await chain.insertContract(CMA_ADDRESS, controlContract, {
      maxBid: ethers.parseEther('0.001'),
      enabled: true,
      autoActivate: false,
      maxActivationCost: 0n,
      funding: ethers.parseEther('0.005'),
    });

    await waitForCondition(
      async () => {
        const count = await db.countEvents('ContractAdded', controlContract);
        return count > 0;
      },
      EVENT_WAIT_TIMEOUT,
      EVENT_POLL_INTERVAL,
      'ContractAdded event for controlContract',
    );

    const contract = await db.getContractByAddress(controlContract);
    expect(contract).toBeDefined();
    expect(contract.isAutomated).toBe(true);
    expect(contract.autoActivate).toBe(false);
  });

  it('should expire both programs by advancing VM time 25 hours', async () => {
    console.log('Advancing VM time by 25 hours to expire programs...');
    await advanceVmTime(MULTIPASS_VM_NAME, 25, chain);
    console.log('VM time advanced');

    const timeLeft1 = await chain.programTimeLeft(autoActivateContract);
    const timeLeft2 = await chain.programTimeLeft(controlContract);
    console.log(
      `After time advance - programTimeLeft: autoActivate=${timeLeft1}, control=${timeLeft2}`,
    );

    // Control must be expired. The autoActivate contract might already have
    // been re-activated if the cron fired during time-advance — that's fine,
    // the important assertion is in the next tests.
    expect(timeLeft2).toBeLessThanOrEqual(0n);
  }, 60_000);

  it(
    'should wait for backend automation to re-activate the expired contract',
    async () => {
      await waitForCondition(
        async () => {
          const count = await db.countEvents(
            'ActivationPerformed',
            autoActivateContract,
          );
          return count > 0;
        },
        AUTOMATION_TIMEOUT,
        EVENT_POLL_INTERVAL,
        'ActivationPerformed event for autoActivateContract',
      );

      const events = await db.getEventsByName(
        'ActivationPerformed',
        autoActivateContract,
      );
      expect(events.length).toBeGreaterThan(0);
      console.log(
        `ActivationPerformed event: ${JSON.stringify(events[0].eventData)}`,
      );
    },
    AUTOMATION_TIMEOUT + 30_000,
  );

  it('should verify re-activated program has programTimeLeft > 0 on-chain', async () => {
    const timeLeft = await chain.programTimeLeft(autoActivateContract);
    console.log(`programTimeLeft after re-activation: ${timeLeft}s`);
    expect(timeLeft).toBeGreaterThan(0n);
  });

  it('should verify activationStatus=active in DB', async () => {
    await waitForCondition(
      async () => {
        const contract = await db.getContractByAddress(autoActivateContract);
        return contract && contract.activationStatus === 'active';
      },
      EVENT_WAIT_TIMEOUT,
      EVENT_POLL_INTERVAL,
      'activationStatus=active in DB',
    );

    const contract = await db.getContractByAddress(autoActivateContract);
    expect(contract.activationStatus).toBe('active');
    expect(contract.lastActivationBlockNumber).toBeDefined();
    expect(contract.lastActivationTimestamp).toBeDefined();
  });

  it('should verify the control contract was NOT reactivated', async () => {
    const events = await db.getEventsByName(
      'ActivationPerformed',
      controlContract,
    );
    expect(events.length).toBe(0);

    const timeLeft = await chain.programTimeLeft(controlContract);
    expect(timeLeft).toBeLessThanOrEqual(0n);

    const contract = await db.getContractByAddress(controlContract);
    expect(contract.activationStatus).not.toBe('active');
  });
});
