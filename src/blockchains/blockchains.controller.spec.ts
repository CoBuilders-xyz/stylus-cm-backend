import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainsController } from './blockchains.controller';

describe('BlockchainsController', () => {
  let controller: BlockchainsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlockchainsController],
    }).compile();

    controller = module.get<BlockchainsController>(BlockchainsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
