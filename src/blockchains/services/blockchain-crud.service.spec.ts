import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BlockchainCrudService } from './blockchain-crud.service';
import {
  Blockchain,
  PUBLIC_BLOCKCHAIN_SELECT,
} from '../entities/blockchain.entity';

interface MockBlockchainRepository {
  find: jest.Mock;
  findOne: jest.Mock;
}

describe('BlockchainCrudService', () => {
  let service: BlockchainCrudService;
  let repository: MockBlockchainRepository;

  beforeEach(async () => {
    repository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainCrudService,
        { provide: getRepositoryToken(Blockchain), useValue: repository },
      ],
    }).compile();

    service = module.get(BlockchainCrudService);
  });

  it('findAll loads full entities for internal callers', async () => {
    await service.findAll();

    expect(repository.find).toHaveBeenCalledTimes(1);
    expect(repository.find).toHaveBeenCalledWith({ where: { enabled: true } });
  });

  it('findAllPublic selects only the public columns', async () => {
    await service.findAllPublic();

    expect(repository.find).toHaveBeenCalledTimes(1);
    expect(repository.find).toHaveBeenCalledWith({
      select: PUBLIC_BLOCKCHAIN_SELECT,
      where: { enabled: true },
    });

    const call = repository.find.mock.calls[0] as [{ select: object }];
    const selectedColumns = Object.keys(call[0].select);
    expect(selectedColumns).toEqual(
      expect.arrayContaining(['id', 'name', 'chainId', 'enabled']),
    );
    expect(selectedColumns).not.toContain('rpcUrl');
    expect(selectedColumns).not.toContain('fastSyncRpcUrl');
    expect(selectedColumns).not.toContain('rpcWssUrl');
  });
});
