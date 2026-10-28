import { EventEmitter } from 'node:events';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { captureFailure } from '../../../monitoring/sentry';
import type { ProviderManager } from '../../../common/utils/provider.util';
import type { EventProcessorService } from '../../shared';
import { EventQueueService } from './event-queue.service';

jest.mock('../../../monitoring/sentry', () => ({ captureFailure: jest.fn() }));
jest.mock('bullmq', () => {
  const actual: typeof import('node:events') =
    jest.requireActual('node:events');
  return {
    Queue: jest.fn(() => new actual.EventEmitter()),
    Worker: jest.fn(() => new actual.EventEmitter()),
  };
});

describe('queue connection error reporting', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('shares one report per minute across a queue and worker without suppressing terminal job failures', () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const service = new EventQueueService(
      {} as EventProcessorService,
      {} as ProviderManager,
      new ConfigService({ redis: { connection: {} } }),
    );
    service['initializeQueueForBlockchain']('test-chain');
    const queue = jest.mocked(Queue).mock.results[0].value as EventEmitter;
    const worker = jest.mocked(Worker).mock.results[0].value as EventEmitter;
    const first = new Error('connection unavailable');
    queue.emit('error', first);
    worker.emit('error', new Error('retry with a different Error instance'));
    jest.advanceTimersByTime(59_999);
    queue.emit('error', new Error('connection still unavailable'));
    expect(captureFailure).toHaveBeenCalledTimes(1);
    expect(captureFailure).toHaveBeenLastCalledWith(first, 'events.queue');

    const terminal = new Error('terminal job failure');
    worker.emit('failed', { attemptsMade: 3, opts: { attempts: 3 } }, terminal);
    expect(captureFailure).toHaveBeenCalledTimes(2);
    expect(captureFailure).toHaveBeenLastCalledWith(terminal, 'events.queue');

    jest.advanceTimersByTime(1);
    const next = new Error('connection still unavailable next minute');
    worker.emit('error', next);
    expect(captureFailure).toHaveBeenCalledTimes(3);
    expect(captureFailure).toHaveBeenLastCalledWith(next, 'events.queue');
  });
});
