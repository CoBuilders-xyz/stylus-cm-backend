const assert = require('node:assert/strict');
const { test } = require('node:test');
const { request } = require('node:http');
const { spawnSync } = require('node:child_process');
const Sentry = require('@sentry/nestjs');
const {
  sentryOptions,
  captureFailure,
} = require('../dist/src/monitoring/sentry');
const envelopes = [];
const secret = 'sensitive-auth-cookie-rpc-token';
Sentry.init({
  ...sentryOptions({
    SENTRY_DSN: 'https://public@example.invalid/1',
    SENTRY_TRACES_SAMPLE_RATE: '1',
  }),
  transport: () => ({
    send: (envelope) => {
      envelopes.push(envelope);
      return Promise.resolve({ statusCode: 200 });
    },
    flush: () => Promise.resolve(true),
  }),
});

// Import the framework only after initialization, matching main.ts.
const {
  Controller,
  Get,
  Module,
  BadRequestException,
  InternalServerErrorException,
} = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { SentryModule } = require('@sentry/nestjs/setup');
const { Cron } = require('@nestjs/schedule');
const { Processor, WorkerHost } = require('@nestjs/bullmq');
const { setupAppMiddleware } = require('../dist/src/app.setup');

class TestController {
  failure() {
    throw new TypeError(secret);
  }
  explicit() {
    throw new InternalServerErrorException(secret);
  }
  expected() {
    throw new BadRequestException(secret);
  }
}
Controller()(TestController);
for (const method of ['failure', 'explicit', 'expected']) {
  Get(method)(
    TestController.prototype,
    method,
    Object.getOwnPropertyDescriptor(TestController.prototype, method),
  );
}
class TestModule {}
Module({ imports: [SentryModule.forRoot()], controllers: [TestController] })(
  TestModule,
);

function get(port, route) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: '127.0.0.1',
        port,
        path: `/${route}?token=${secret}`,
        headers: {
          authorization: `Bearer ${secret}`,
          cookie: `session=${secret}`,
        },
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      },
    );
    req.on('error', reject);
    req.end();
  });
}
function events() {
  return envelopes.flatMap((envelope) =>
    envelope[1]
      .filter(([header]) => header.type === 'event')
      .map(([, event]) => event),
  );
}

test('real HTTP pipeline captures each 5xx once and excludes 4xx/private telemetry', async () => {
  Sentry.getGlobalScope().addAttachment({
    filename: 'private.txt',
    data: secret,
  });
  const app = await NestFactory.create(TestModule, { logger: false });
  setupAppMiddleware(app);
  await app.listen(0, '127.0.0.1');
  try {
    const port = app.getHttpServer().address().port;
    assert.equal(await get(port, 'failure'), 500);
    assert.equal(await get(port, 'explicit'), 500);
    assert.equal(await get(port, 'expected'), 400);
    assert.equal(await get(port, 'missing'), 404);
    await Sentry.flush(2000);
    assert.equal(events().length, 2);
    assert.deepEqual(
      events().map((event) => event.tags.operation),
      ['http', 'http'],
    );
    assert.ok(
      envelopes.some((envelope) =>
        envelope[1].some(([header]) => header.type === 'transaction'),
      ),
    );
    assert.ok(!JSON.stringify(envelopes).includes(secret));
  } finally {
    Sentry.getGlobalScope().clearAttachments();
    await app.close();
  }
});

test('SDK catches escaping scheduled and BullMQ failures once; explicit capture deduplicates', async () => {
  const start = events().length;
  class ScheduledTask {
    async run() {
      const error = new Error(secret);
      captureFailure(error, 'state.poll');
      captureFailure(error, 'state.poll');
      throw error;
    }
  }
  const descriptor = Object.getOwnPropertyDescriptor(
    ScheduledTask.prototype,
    'run',
  );
  Cron('* * * * *')(ScheduledTask.prototype, 'run', descriptor);
  Object.defineProperty(ScheduledTask.prototype, 'run', descriptor);
  class QueueTask extends WorkerHost {
    async process() {
      throw new Error(secret);
    }
  }
  Processor('test-queue')(QueueTask);
  await assert.rejects(new ScheduledTask().run());
  await assert.rejects(new QueueTask().process({ data: { token: secret } }));
  await Sentry.flush(2000);
  assert.equal(events().length - start, 2);
  assert.ok(!JSON.stringify(envelopes).includes(secret));
});

test('compiled module frames keep their injected debug IDs after sanitization', async () => {
  const start = events().length;
  const {
    StateFetcherErrorHelpers,
  } = require('../dist/src/state-fetcher/state-fetcher.errors');
  try {
    StateFetcherErrorHelpers.throwProviderCreationFailed();
  } catch (error) {
    captureFailure(error, 'state.poll');
  }
  await Sentry.flush(2000);
  assert.equal(events().length - start, 1);
  const event = events()[start];
  const frames = event.exception.values.flatMap(
    (value) => value.stacktrace.frames,
  );
  const image = event.debug_meta.images.find((image) =>
    image.code_file.endsWith('/state-fetcher.errors.js'),
  );
  assert.ok(image, 'compiled error module must have a debug image');
  assert.match(image.debug_id, /^[a-f\d-]{36}$/);
  assert.ok(
    frames.some(
      (frame) => frame.abs_path === image.code_file && frame.lineno > 0,
    ),
  );
});

test('swallowed scheduled resync failures produce one sanitized event', async () => {
  const start = events().length;
  const {
    EventSchedulerService,
  } = require('../dist/src/event-fetcher/sync/services/event-scheduler.service');
  const task = new EventSchedulerService(
    {
      getBlockchains: async () => {
        throw new Error(secret);
      },
    },
    {},
    {},
  );
  task.logger = { log() {}, error() {}, warn() {} };
  await task.periodicEventResync();
  await Sentry.flush(2000);
  assert.equal(events().length - start, 1);
  assert.equal(events()[start].tags.operation, 'events.resync');
  assert.ok(!JSON.stringify(envelopes).includes(secret));
});

test('computed function names cannot leak wallet addresses into real envelopes', async () => {
  const start = events().length;
  const wallet = '0x' + 'a'.repeat(40);
  const target = {
    [wallet]() {
      throw new Error(secret);
    },
  };
  try {
    target[wallet]();
  } catch (error) {
    captureFailure(error, 'http');
  }
  await Sentry.flush(2000);
  assert.equal(events().length - start, 1);
  assert.ok(!JSON.stringify(events().slice(start)).includes(wallet));
  assert.ok(!JSON.stringify(events().slice(start)).includes(secret));
});

test('CMA reports absorbed outer, per-chain, and batch failures without changing results', async () => {
  const { CmaService } = require('../dist/src/cma/cma.service');
  const {
    AutomationOrchestratorService,
  } = require('../dist/src/cma/services/automation-orchestrator.service');
  const {
    BatchProcessorService,
  } = require('../dist/src/cma/services/batch-processor.service');
  const {
    ContractSelectionService,
  } = require('../dist/src/cma/services/contract-selection.service');
  const {
    ActivationSelectionService,
  } = require('../dist/src/cma/services/activation-selection.service');
  const start = events().length;
  const fail = async () => {
    throw new Error(secret);
  };
  const config = {
    get: () => ({
      cachingAutomationEnabled: true,
      activationAutomationEnabled: true,
      batchSize: 1,
    }),
  };
  const blockchain = {
    name: 'synthetic-test-chain',
    chainId: 1,
    cacheManagerAutomationAddress: secret,
  };
  const batch = new BatchProcessorService({ writeContract: fail }, config);
  const orchestrator = new AutomationOrchestratorService(
    { find: async () => [blockchain] },
    config,
    { selectOptimalBids: fail },
    { selectOptimalActivations: fail },
    batch,
  );
  await new CmaService({
    executeCachingAutomation: fail,
    executeActivationAutomation: fail,
  }).handleCmaAutomation();
  assert.equal((await orchestrator.executeCachingAutomation()).success, false);
  assert.equal(
    (await orchestrator.executeActivationAutomation()).success,
    false,
  );
  const contracts = [{ user: secret, address: secret }];
  assert.equal(
    (await batch.processContractBatches(blockchain, contracts)).failedBatches,
    1,
  );
  assert.equal(
    (await batch.processActivationBatches(blockchain, contracts)).failedBatches,
    1,
  );
  await Sentry.flush(2000);
  const provider = {
    getContract() {
      throw new Error(secret);
    },
  };
  assert.deepEqual(
    await new ContractSelectionService(provider, config).selectOptimalBids(
      blockchain,
    ),
    [],
  );
  assert.deepEqual(
    (
      await new ActivationSelectionService(
        provider,
        config,
        {},
      ).selectOptimalActivations(blockchain)
    ).selectedContracts,
    [],
  );
  await Sentry.flush(2000);
  const captured = events().slice(start);
  assert.equal(captured.length, 8);
  assert.ok(captured.every((event) => event.tags?.operation === 'cma'));
  assert.ok(!JSON.stringify(captured).includes(secret));
});

test('built instrumentation remains completely disabled without a DSN', () => {
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      "require('./dist/src/instrument'); const s = require('@sentry/nestjs'); if (s.getClient()) process.exit(2)",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SENTRY_DSN: '',
        DOTENV_CONFIG_PATH: '/nonexistent',
      },
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0);
});

test.after(async () => {
  await Sentry.close(2000);
});
