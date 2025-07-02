import {
  calculateActualBid,
  calculateBidPlusDecay,
  updateTotalBidInvestment,
} from './bid-utils';
import { DataProcessingErrorHelpers } from '../data-processing.errors';

// Mock the error helpers
jest.mock('../data-processing.errors', () => ({
  DataProcessingErrorHelpers: {
    throwBidCalculationFailed: jest.fn(),
  },
}));

describe('BidUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateActualBid', () => {
    it('should calculate actual bid correctly with decay', () => {
      // Arrange
      const valuePlaced = 1000000000000000000n; // 1 ETH in wei (original value placed)
      const decayRate = 1000000000000000n; // 0.001 ETH per second
      const blockTimestamp = new Date(Date.now() - 60 * 1000); // 1 minute ago

      // Bid includes decay punishment: bid = valuePlaced + decayRate * timestamp
      const bidValue =
        valuePlaced +
        decayRate * BigInt(Math.floor(blockTimestamp.getTime() / 1000));

      // Act
      const result = calculateActualBid(
        bidValue.toString(),
        decayRate.toString(),
        blockTimestamp,
      );

      // Assert - Should return the original value placed (1 ETH)
      expect(result).toBe(valuePlaced.toString());
    });

    it('should return zero when decay exceeds bid', () => {
      // Arrange
      const bidValue = '1000000000000000000'; // 1 ETH in wei
      const decayRate = '1000000000000000000'; // 1 ETH per second
      const blockTimestamp = new Date('2024-01-01T12:00:00Z');

      // Act
      const result = calculateActualBid(bidValue, decayRate, blockTimestamp);

      // Assert
      expect(result).toBe('0');
    });

    it('should throw error for invalid bid value', () => {
      // Arrange
      const invalidBidValue = 'invalid';
      const decayRate = '1000000000000000';
      const blockTimestamp = new Date();

      // Act & Assert
      expect(() => {
        calculateActualBid(invalidBidValue, decayRate, blockTimestamp);
      }).toThrow();

      expect(
        DataProcessingErrorHelpers.throwBidCalculationFailed,
      ).toHaveBeenCalledWith(invalidBidValue, decayRate);
    });

    it('should throw error for invalid decay rate', () => {
      // Arrange
      const bidValue = '1000000000000000000';
      const invalidDecayRate = 'invalid';
      const blockTimestamp = new Date();

      // Act & Assert
      expect(() => {
        calculateActualBid(bidValue, invalidDecayRate, blockTimestamp);
      }).toThrow();

      expect(
        DataProcessingErrorHelpers.throwBidCalculationFailed,
      ).toHaveBeenCalledWith(bidValue, invalidDecayRate);
    });
  });

  describe('calculateBidPlusDecay', () => {
    it('should format bid value correctly', () => {
      // Arrange
      const bidValue = '1000000000000000000'; // 1 ETH in wei

      // Act
      const result = calculateBidPlusDecay(bidValue);

      // Assert
      expect(result).toBe(1.0);
    });

    it('should format large bid value correctly', () => {
      // Arrange
      const bidValue = '5000000000000000000'; // 5 ETH in wei

      // Act
      const result = calculateBidPlusDecay(bidValue);

      // Assert
      expect(result).toBe(5.0);
    });

    it('should throw error for invalid bid value', () => {
      // Arrange
      const invalidBidValue = 'invalid';

      // Act & Assert
      expect(() => {
        calculateBidPlusDecay(invalidBidValue);
      }).toThrow();

      expect(
        DataProcessingErrorHelpers.throwBidCalculationFailed,
      ).toHaveBeenCalledWith(invalidBidValue, 'formatting');
    });
  });

  describe('updateTotalBidInvestment', () => {
    it('should add bid to current total correctly', () => {
      // Arrange
      const currentTotal = '1000000000000000000'; // 1 ETH in wei
      const bid = '500000000000000000'; // 0.5 ETH in wei

      // Act
      const result = updateTotalBidInvestment(currentTotal, bid);

      // Assert
      expect(result).toBe('1500000000000000000'); // 1.5 ETH in wei
    });

    it('should handle zero current total', () => {
      // Arrange
      const currentTotal = '0';
      const bid = '1000000000000000000'; // 1 ETH in wei

      // Act
      const result = updateTotalBidInvestment(currentTotal, bid);

      // Assert
      expect(result).toBe('1000000000000000000');
    });

    it('should handle zero bid', () => {
      // Arrange
      const currentTotal = '1000000000000000000'; // 1 ETH in wei
      const bid = '0';

      // Act
      const result = updateTotalBidInvestment(currentTotal, bid);

      // Assert
      expect(result).toBe('1000000000000000000');
    });

    it('should throw error for invalid current total', () => {
      // Arrange
      const invalidCurrentTotal = 'invalid';
      const bid = '1000000000000000000';

      // Act & Assert
      expect(() => {
        updateTotalBidInvestment(invalidCurrentTotal, bid);
      }).toThrow();

      expect(
        DataProcessingErrorHelpers.throwBidCalculationFailed,
      ).toHaveBeenCalledWith(bid, 'investment update');
    });

    it('should throw error for invalid bid', () => {
      // Arrange
      const currentTotal = '1000000000000000000';
      const invalidBid = 'invalid';

      // Act & Assert
      expect(() => {
        updateTotalBidInvestment(currentTotal, invalidBid);
      }).toThrow();

      expect(
        DataProcessingErrorHelpers.throwBidCalculationFailed,
      ).toHaveBeenCalledWith(invalidBid, 'investment update');
    });
  });
});
