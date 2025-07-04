import { Test, TestingModule } from '@nestjs/testing';
import { UserContractsController } from './user-contracts.controller';
import { UserContractsService } from './user-contracts.service';

describe('UserContractsController', () => {
  let controller: UserContractsController;
  let mockUserContractsService: Partial<UserContractsService>;

  beforeEach(async () => {
    mockUserContractsService = {
      createUserContract: jest.fn(),
      getUserContracts: jest.fn(),
      getUserContract: jest.fn(),
      updateUserContractName: jest.fn(),
      deleteUserContract: jest.fn(),
      checkContractsSavedByUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserContractsController],
      providers: [
        {
          provide: UserContractsService,
          useValue: mockUserContractsService,
        },
      ],
    }).compile();

    controller = module.get<UserContractsController>(UserContractsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
