import { Test, TestingModule } from '@nestjs/testing';
import { EventFetcherService } from './event-fetcher.service';

describe('EventFetcherService', () => {
  let service: EventFetcherService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventFetcherService],
    }).compile();

    service = module.get<EventFetcherService>(EventFetcherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
