import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { setupAppMiddleware } from './app.setup';
import { OptionalAuthGuard } from './auth/auth.guard';
import { Blockchain } from './blockchains/entities/blockchain.entity';
import { BlockchainsController } from './blockchains/blockchains.controller';
import { BlockchainsService } from './blockchains/blockchains.service';
import { ContractsController } from './contracts/contracts.controller';
import { ContractsService } from './contracts/contracts.service';
import { Contract } from './contracts/entities/contract.entity';
import { AlertsController } from './alerts/alerts.controller';
import { AlertsService } from './alerts/alerts.service';
import { Alert, AlertType } from './alerts/entities/alert.entity';
import { UserContract } from './user-contracts/entities/user-contract.entity';

/**
 * HTTP-level proof that the global response serialization strips the
 * provider URLs from Blockchain entities, top-level and nested, and leaves
 * every other response shape unchanged.
 */

const BLOCKCHAIN_ID = '11111111-1111-4111-8111-111111111111';
const CONTRACT_ID = '22222222-2222-4222-8222-222222222222';

// Fixture URLs only. The marker lets us assert that no value leaked either.
const LEAK_PATTERN = /rpcUrl|fastSyncRpcUrl|rpcWssUrl|FAKEKEY/;

function createBlockchain(): Blockchain {
  return Object.assign(new Blockchain(), {
    id: BLOCKCHAIN_ID,
    name: 'Fixture Chain',
    rpcUrl: 'https://rpc.example/v2/FAKEKEY',
    fastSyncRpcUrl: 'https://fast-rpc.example/v2/FAKEKEY',
    rpcWssUrl: 'wss://ws.example/v2/FAKEKEY',
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

function createContract(): Contract {
  return Object.assign(new Contract(), {
    id: CONTRACT_ID,
    address: '0x' + 'c'.repeat(40),
    blockchain: createBlockchain(),
    lastBid: '1000',
    bidPlusDecay: '1000',
    totalBidInvestment: '1000',
    isAutomated: false,
    maxBid: '0',
    biddingEnabled: false,
    autoActivate: false,
    activationStatus: 'unknown',
    activationRetryCount: 0,
  });
}

function createAlert(): Alert {
  return Object.assign(new Alert(), {
    id: '33333333-3333-4333-8333-333333333333',
    type: AlertType.EVICTION,
    isActive: true,
    triggeredCount: 0,
    slackChannelEnabled: false,
    telegramChannelEnabled: false,
    webhookChannelEnabled: false,
    userContract: Object.assign(new UserContract(), {
      id: '44444444-4444-4444-8444-444444444444',
      address: '0x' + 'c'.repeat(40),
      name: 'My contract',
      blockchain: createBlockchain(),
    }),
  });
}

const probePayload = {
  when: new Date('2026-01-02T03:04:05.000Z'),
  count: 1,
  label: 'text',
  nothing: null,
  list: [{ a: 1 }, 2, 'three'],
  nested: { deep: { ok: true } },
};

@Controller('probe')
class ProbeController {
  @Get()
  plainObject() {
    return probePayload;
  }

  @Get('text')
  text() {
    return 'plain text';
  }
}

describe('HTTP response serialization (setupAppMiddleware)', () => {
  let app: INestApplication<App>;

  const fakeUser = { id: 'user-1', address: '0x' + 'a'.repeat(40) };
  const blockchainsService = { findAllPublic: jest.fn() };
  const contractsService = { findAll: jest.fn(), findOne: jest.fn() };
  const alertsService = { getAlerts: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [
        BlockchainsController,
        ContractsController,
        AlertsController,
        ProbeController,
      ],
      providers: [
        { provide: BlockchainsService, useValue: blockchainsService },
        { provide: ContractsService, useValue: contractsService },
        { provide: AlertsService, useValue: alertsService },
      ],
    })
      .overrideGuard(OptionalAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    // Stand-in for AuthGuard (lives in AuthModule, not loaded here).
    app.use(
      (
        req: Request & { user?: unknown },
        _res: Response,
        next: NextFunction,
      ) => {
        req.user = fakeUser;
        next();
      },
    );
    setupAppMiddleware(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /blockchains carries no RPC URLs even when the service returns full entities', async () => {
    blockchainsService.findAllPublic.mockResolvedValue([
      createBlockchain(),
      createBlockchain(),
    ]);

    const res = await request(app.getHttpServer())
      .get('/blockchains')
      .expect(200);

    const body = res.body as Array<Record<string, unknown>>;
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({
      id: BLOCKCHAIN_ID,
      name: 'Fixture Chain',
      chainId: 421614,
      enabled: true,
    });
    expect(JSON.stringify(body)).not.toMatch(LEAK_PATTERN);
  });

  it('GET /contracts strips the nested blockchain inside the pagination wrapper', async () => {
    contractsService.findAll.mockResolvedValue({
      data: [createContract()],
      meta: {
        page: 1,
        limit: 10,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });

    const res = await request(app.getHttpServer())
      .get('/contracts')
      .query({ blockchainId: BLOCKCHAIN_ID })
      .expect(200);

    const body = res.body as {
      data: Array<{ blockchain: Record<string, unknown> }>;
      meta: Record<string, unknown>;
    };
    expect(body.meta).toMatchObject({ page: 1, totalItems: 1 });
    expect(body.data[0].blockchain).toMatchObject({
      id: BLOCKCHAIN_ID,
      chainId: 421614,
    });
    expect(JSON.stringify(body)).not.toMatch(LEAK_PATTERN);
  });

  it('GET /contracts/:id strips the nested blockchain from a spread (plain) contract', async () => {
    // ContractEnrichmentService spreads the entity into a plain object; the
    // nested blockchain stays a class instance, so it must still be cleaned.
    contractsService.findOne.mockResolvedValue({
      ...createContract(),
      programTimeLeft: null,
      programTimeLeftReason: null,
    });

    const res = await request(app.getHttpServer())
      .get(`/contracts/${CONTRACT_ID}`)
      .expect(200);

    const body = res.body as {
      id: string;
      blockchain: Record<string, unknown>;
    };
    expect(body.id).toBe(CONTRACT_ID);
    expect(body.blockchain).toMatchObject({
      id: BLOCKCHAIN_ID,
      chainId: 421614,
    });
    expect(JSON.stringify(body)).not.toMatch(LEAK_PATTERN);
  });

  it('GET /alerts strips the blockchain two levels deep (alert.userContract.blockchain)', async () => {
    alertsService.getAlerts.mockResolvedValue([createAlert()]);

    const res = await request(app.getHttpServer())
      .get('/alerts')
      .query({ blockchainId: BLOCKCHAIN_ID })
      .expect(200);

    const body = res.body as Array<{
      userContract: { blockchain: Record<string, unknown> };
    }>;
    expect(body).toHaveLength(1);
    expect(body[0].userContract.blockchain).toMatchObject({
      id: BLOCKCHAIN_ID,
      chainId: 421614,
    });
    expect(JSON.stringify(body)).not.toMatch(LEAK_PATTERN);
  });

  it('leaves plain-object responses (dates, nulls, arrays, nesting) unchanged', async () => {
    const res = await request(app.getHttpServer()).get('/probe').expect(200);

    const body: unknown = res.body;
    expect(body).toEqual(JSON.parse(JSON.stringify(probePayload)));
  });

  it('leaves string responses unchanged', async () => {
    const res = await request(app.getHttpServer())
      .get('/probe/text')
      .expect(200);

    expect(res.text).toBe('plain text');
  });
});
