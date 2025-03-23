import { Test, TestingModule } from '@nestjs/testing';
import { StateFetcherService } from './state-fetcher.service';

describe('StateFetcherService', () => {
  let service: StateFetcherService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StateFetcherService],
    }).compile();

    service = module.get<StateFetcherService>(StateFetcherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
