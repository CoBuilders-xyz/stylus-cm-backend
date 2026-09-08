import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AutomationService } from './automation.service';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { Contract } from '../../contracts/entities/contract.entity';

const USER = '0x1111111111111111111111111111111111111111';
const CONTRACT_ADDRESS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('AutomationService', () => {
  let service: AutomationService;
  let mockContractRepository: {
    findOne: jest.Mock;
    save: jest.Mock<Promise<Contract>, [Contract]>;
  };

  const blockchain = { id: 'blockchain-123', name: 'Test' } as Blockchain;

  const makeEvent = (eventName: string, eventData: unknown[]) =>
    ({
      id: 'event-1',
      eventName,
      eventData,
      blockNumber: 10,
      blockTimestamp: new Date('2026-01-01T00:00:00Z'),
    }) as unknown as BlockchainEvent;

  beforeEach(async () => {
    mockContractRepository = {
      findOne: jest.fn(),
      save: jest
        .fn<Promise<Contract>, [Contract]>()
        .mockImplementation((c) => Promise.resolve(c)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationService,
        {
          provide: getRepositoryToken(Contract),
          useValue: mockContractRepository,
        },
      ],
    }).compile();

    service = module.get(AutomationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processContractBiddingEnabledUpdatedEvent', () => {
    it('persists biddingEnabled=false from the event', async () => {
      const contract = {
        address: CONTRACT_ADDRESS,
        biddingEnabled: true,
        autoActivate: true,
      } as Contract;
      mockContractRepository.findOne.mockResolvedValue(contract);

      await service.processContractBiddingEnabledUpdatedEvent(
        blockchain,
        makeEvent('ContractBiddingEnabledUpdated', [
          USER,
          CONTRACT_ADDRESS,
          false,
        ]),
      );

      expect(mockContractRepository.findOne).toHaveBeenCalledWith({
        where: { blockchain: { id: blockchain.id }, address: CONTRACT_ADDRESS },
      });
      expect(mockContractRepository.save).toHaveBeenCalledTimes(1);
      const saved = mockContractRepository.save.mock.calls[0][0];
      expect(saved.biddingEnabled).toBe(false);
      // Unrelated automation flags must not be touched.
      expect(saved.autoActivate).toBe(true);
    });

    it('persists biddingEnabled=true from the event', async () => {
      const contract = {
        address: CONTRACT_ADDRESS,
        biddingEnabled: false,
      } as Contract;
      mockContractRepository.findOne.mockResolvedValue(contract);

      await service.processContractBiddingEnabledUpdatedEvent(
        blockchain,
        makeEvent('ContractBiddingEnabledUpdated', [
          USER,
          CONTRACT_ADDRESS,
          true,
        ]),
      );

      const saved = mockContractRepository.save.mock.calls[0][0];
      expect(saved.biddingEnabled).toBe(true);
    });

    it('skips silently when the contract is unknown', async () => {
      mockContractRepository.findOne.mockResolvedValue(null);

      await service.processContractBiddingEnabledUpdatedEvent(
        blockchain,
        makeEvent('ContractBiddingEnabledUpdated', [
          USER,
          CONTRACT_ADDRESS,
          true,
        ]),
      );

      expect(mockContractRepository.save).not.toHaveBeenCalled();
    });

    it('rejects malformed event data', async () => {
      await expect(
        service.processContractBiddingEnabledUpdatedEvent(
          blockchain,
          // A string instead of a bool (as a v1-style uint payload would look)
          makeEvent('ContractBiddingEnabledUpdated', [
            USER,
            CONTRACT_ADDRESS,
            '1',
          ]),
        ),
      ).rejects.toThrow();

      expect(mockContractRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('processContractAddedEvent', () => {
    it('still decodes ContractAdded(user, contractAddress, maxBid)', async () => {
      const contract = {
        address: CONTRACT_ADDRESS,
        isAutomated: false,
        maxBid: '0',
      } as Contract;
      mockContractRepository.findOne.mockResolvedValue(contract);

      await service.processContractAddedEvent(
        blockchain,
        makeEvent('ContractAdded', [USER, CONTRACT_ADDRESS, '123']),
      );

      const saved = mockContractRepository.save.mock.calls[0][0];
      expect(saved.isAutomated).toBe(true);
      expect(saved.maxBid).toBe('123');
    });
  });
  it('clears biddingEnabled when a registered contract is removed', async () => {
    const contract = {
      address: CONTRACT_ADDRESS,
      isAutomated: true,
      biddingEnabled: true,
    } as Contract;
    mockContractRepository.findOne.mockResolvedValue(contract);
    await service.processContractRemovedEvent(
      blockchain,
      makeEvent('ContractRemoved', [USER, CONTRACT_ADDRESS]),
    );
    expect(mockContractRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ isAutomated: false, biddingEnabled: false }),
    );
  });
});
