import { Test, TestingModule } from '@nestjs/testing';
import { UserContractsController } from './user-contracts.controller';

describe('UserContractsController', () => {
  let controller: UserContractsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserContractsController],
    }).compile();

    controller = module.get<UserContractsController>(UserContractsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
