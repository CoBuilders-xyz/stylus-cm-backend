import { AbiCoder, Interface } from 'ethers';
import { abi as cmaAbi } from './CacheManagerAutomation.json';
import { abi as cacheManagerAbi } from '../cacheManager/cacheManager.json';
import { CacheManagerAutomation__factory } from 'src/common/types/contracts/factories/cacheManagerAutomation/CacheManagerAutomation__factory';
import config from 'src/common/config/config';
import { EVENT_TYPES } from 'src/data-processing/constants/event-processing.constants';
import { EventDataGuards } from 'src/data-processing/interfaces/event-data.interface';
import { serializeEventArgs } from 'src/event-fetcher/utils/event-parser.util';

/**
 * Regression tests for the CacheManagerAutomation v2.0 ABI
 * (stylus-cm-contracts commit 82f963ae45441c8c0a558735e876183370d7a7c9).
 *
 * The ContractConfig tuple changed field order:
 *   v1: (address contractAddress, uint256 maxBid, bool enabled, bool autoActivate, uint256 maxActivationCost)
 *   v2: (address contractAddress, bool biddingEnabled, bool autoActivate, uint256 maxBid, uint256 maxActivationCost)
 *
 * The payloads below are hand-encoded with explicit Solidity types (independent
 * of the JSON ABI) and use distinct values for every field, so a wrong field
 * order in the ABI or in the generated TypeChain types cannot pass by accident.
 */

const coder = AbiCoder.defaultAbiCoder();

// Solidity layout of ICacheManagerAutomation.ContractConfig at commit 82f963a.
const CONTRACT_CONFIG_V2 =
  'tuple(address contractAddress, bool biddingEnabled, bool autoActivate, uint256 maxBid, uint256 maxActivationCost)';
const USER_CONTRACTS_DATA_V2 = `tuple(address user, ${CONTRACT_CONFIG_V2}[] contracts)`;

// Legacy (v1) layout, used as a negative control.
const CONTRACT_CONFIG_V1 =
  'tuple(address contractAddress, uint256 maxBid, bool enabled, bool autoActivate, uint256 maxActivationCost)';

const USER = '0x1111111111111111111111111111111111111111';
// Lowercase so ethers does not apply EIP-55 checksum validation on encode.
const CONTRACT_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const CONTRACT_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

// Distinct values: biddingEnabled != autoActivate, maxBid != maxActivationCost.
const CONFIG_A = {
  contractAddress: CONTRACT_A,
  biddingEnabled: true,
  autoActivate: false,
  maxBid: 111n,
  maxActivationCost: 222n,
};
const CONFIG_B = {
  contractAddress: CONTRACT_B,
  biddingEnabled: false,
  autoActivate: true,
  maxBid: 333n,
  maxActivationCost: 444n,
};

const asTuple = (c: typeof CONFIG_A) => [
  c.contractAddress,
  c.biddingEnabled,
  c.autoActivate,
  c.maxBid,
  c.maxActivationCost,
];

// Named-field views over the ethers Result objects returned by decodeFunctionResult.
type DecodedConfig = {
  contractAddress: string;
  biddingEnabled: boolean;
  autoActivate: boolean;
  maxBid: bigint;
  maxActivationCost: bigint;
  enabled?: unknown;
};
type DecodedUserData = { user: string; contracts: DecodedConfig[] };
type DecodedPaginated = { userData: DecodedUserData[]; hasMore: boolean };

const expectConfig = (decoded: DecodedConfig, expected: typeof CONFIG_A) => {
  expect(decoded.contractAddress.toLowerCase()).toBe(
    expected.contractAddress.toLowerCase(),
  );
  expect(decoded.biddingEnabled).toBe(expected.biddingEnabled);
  expect(decoded.autoActivate).toBe(expected.autoActivate);
  expect(decoded.maxBid).toBe(expected.maxBid);
  expect(decoded.maxActivationCost).toBe(expected.maxActivationCost);
  // The legacy field must not exist anymore.
  expect(decoded.enabled).toBeUndefined();
};

describe('CacheManagerAutomation v2.0 ABI', () => {
  const iface = new Interface(cmaAbi);

  describe('ContractConfig tuple decoding', () => {
    it('decodes getUserContracts() with the v2 field order', () => {
      const data = coder.encode(
        [`${CONTRACT_CONFIG_V2}[]`],
        [[asTuple(CONFIG_A), asTuple(CONFIG_B)]],
      );

      const contracts = iface.decodeFunctionResult(
        'getUserContracts',
        data,
      )[0] as DecodedConfig[];

      expect(contracts).toHaveLength(2);
      expectConfig(contracts[0], CONFIG_A);
      expectConfig(contracts[1], CONFIG_B);
    });

    it('decodes userContracts(address,uint256) with the v2 field order', () => {
      const data = coder.encode(
        ['address', 'bool', 'bool', 'uint256', 'uint256'],
        asTuple(CONFIG_A),
      );

      const decoded = iface.decodeFunctionResult(
        'userContracts',
        data,
      ) as unknown as DecodedConfig;

      expectConfig(decoded, CONFIG_A);
    });

    it('decodes getContracts() with the v2 field order', () => {
      const data = coder.encode(
        [`${USER_CONTRACTS_DATA_V2}[]`],
        [[[USER, [asTuple(CONFIG_A), asTuple(CONFIG_B)]]]],
      );

      const users = iface.decodeFunctionResult(
        'getContracts',
        data,
      )[0] as DecodedUserData[];

      expect(users).toHaveLength(1);
      expect(users[0].user.toLowerCase()).toBe(USER);
      expectConfig(users[0].contracts[0], CONFIG_A);
      expectConfig(users[0].contracts[1], CONFIG_B);
    });

    it('decodes getContractsPaginated() with the v2 field order and hasMore', () => {
      const data = coder.encode(
        [`${USER_CONTRACTS_DATA_V2}[]`, 'bool'],
        [[[USER, [asTuple(CONFIG_A), asTuple(CONFIG_B)]]], true],
      );

      const result = iface.decodeFunctionResult(
        'getContractsPaginated',
        data,
      ) as unknown as DecodedPaginated;

      expect(result.hasMore).toBe(true);
      expect(result.userData).toHaveLength(1);
      expect(result.userData[0].user.toLowerCase()).toBe(USER);
      expectConfig(result.userData[0].contracts[0], CONFIG_A);
      expectConfig(result.userData[0].contracts[1], CONFIG_B);
    });

    it('does not decode a legacy (v1-ordered) payload into the v2 values', () => {
      // Negative control: a v1-ordered payload must produce different field
      // values, proving the assertions above actually depend on field order.
      const legacy = coder.encode(
        [`${CONTRACT_CONFIG_V1}[]`],
        [
          [
            [
              CONFIG_A.contractAddress,
              CONFIG_A.maxBid,
              CONFIG_A.biddingEnabled,
              CONFIG_A.autoActivate,
              CONFIG_A.maxActivationCost,
            ],
          ],
        ],
      );

      const contracts = iface.decodeFunctionResult(
        'getUserContracts',
        legacy,
      )[0] as DecodedConfig[];

      expect(contracts[0].maxBid).not.toBe(CONFIG_A.maxBid);
    });

    it('exposes insertContract/updateContract with the _biddingEnabled parameter', () => {
      for (const name of ['insertContract', 'updateContract']) {
        const fn = iface.getFunction(name);
        expect(fn).not.toBeNull();
        expect(fn!.inputs.map((i) => i.name)).toEqual([
          '_contract',
          '_maxBid',
          '_biddingEnabled',
          '_autoActivate',
          '_maxActivationCost',
        ]);
      }
    });
  });

  describe('TypeChain types', () => {
    it('are generated from the same ABI as the JSON artifact', () => {
      expect(CacheManagerAutomation__factory.abi).toEqual(cmaAbi);
    });

    it('decode ContractConfig with the v2 field order through the factory interface', () => {
      const typed = CacheManagerAutomation__factory.createInterface();
      const data = coder.encode(
        [`${USER_CONTRACTS_DATA_V2}[]`, 'bool'],
        [[[USER, [asTuple(CONFIG_B)]]], false],
      );

      const result = typed.decodeFunctionResult(
        'getContractsPaginated',
        data,
      ) as unknown as DecodedPaginated;

      expect(result.hasMore).toBe(false);
      expectConfig(result.userData[0].contracts[0], CONFIG_B);
    });
  });

  describe('events', () => {
    it('declares ContractBiddingEnabledUpdated(user, contractAddress, biddingEnabled)', () => {
      const event = iface.getEvent('ContractBiddingEnabledUpdated');
      expect(event).not.toBeNull();
      expect(event!.inputs.map((i) => `${i.type} ${i.name}`)).toEqual([
        'address user',
        'address contractAddress',
        'bool biddingEnabled',
      ]);
    });

    it('parses a ContractBiddingEnabledUpdated log into data accepted by the event guard', () => {
      const encoded = iface.encodeEventLog('ContractBiddingEnabledUpdated', [
        USER,
        CONTRACT_A,
        true,
      ]);
      const parsed = iface.parseLog({
        topics: [...encoded.topics],
        data: encoded.data,
      });

      expect(parsed?.name).toBe('ContractBiddingEnabledUpdated');

      const eventData = serializeEventArgs(parsed!.args) as unknown[];
      expect(
        EventDataGuards.isContractBiddingEnabledUpdatedEventData(eventData),
      ).toBe(true);
      expect(eventData[2]).toBe(true);
    });

    it('no longer declares the obsolete v1 events', () => {
      for (const name of [
        'BidAttempted',
        'UpkeepPerformed',
        'UserBalanceOperation',
      ]) {
        expect(iface.getEvent(name)).toBeNull();
      }
    });
  });

  describe('configured event list', () => {
    const cacheManagerIface = new Interface(cacheManagerAbi);
    const configuredEventTypes: string[] = config().eventTypes;

    it('only lists events that exist in the CacheManager or CMA ABI', () => {
      const unknown = configuredEventTypes.filter(
        (name) =>
          cacheManagerIface.getEvent(name) === null &&
          iface.getEvent(name) === null,
      );
      expect(unknown).toEqual([]);
    });

    it('excludes the obsolete v1 events and includes ContractBiddingEnabledUpdated', () => {
      expect(configuredEventTypes).not.toContain('BidAttempted');
      expect(configuredEventTypes).not.toContain('UpkeepPerformed');
      expect(configuredEventTypes).not.toContain('UserBalanceOperation');
      expect(configuredEventTypes).toContain('ContractBiddingEnabledUpdated');
    });

    it('lists every event that has a data-processing handler', () => {
      for (const name of Object.values(EVENT_TYPES)) {
        expect(configuredEventTypes).toContain(name);
      }
    });
  });
});
