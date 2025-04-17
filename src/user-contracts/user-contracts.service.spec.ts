import { Test, TestingModule } from '@nestjs/testing';
import { UserContractsService } from './user-contracts.service';

describe('UserContractsService', () => {
  let service: UserContractsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserContractsService],
    }).compile();

    service = module.get<UserContractsService>(UserContractsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
