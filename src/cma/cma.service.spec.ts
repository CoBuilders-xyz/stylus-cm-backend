import { Test, TestingModule } from '@nestjs/testing';
import { CmaService } from './cma.service';

describe('CmaService', () => {
  let service: CmaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CmaService],
    }).compile();

    service = module.get<CmaService>(CmaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
