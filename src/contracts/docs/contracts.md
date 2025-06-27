# Contracts Module

## Overview

The Contracts module is the core component for managing and analyzing smart contracts within the system. It provides comprehensive functionality for tracking contract deployments, monitoring bids, analyzing eviction risks, and suggesting optimal bidding strategies for contracts in the Stylus ecosystem's competitive cache environment.

## Functionality

- **Contract Tracking**: Monitor deployed smart contracts and their associated bytecode
- **Bid Analysis**: Track and analyze contract bids and their decay over time
- **Eviction Risk Assessment**: Calculate the risk of contracts being evicted from the cache
- **Bid Recommendations**: Generate suggested bid amounts based on risk tolerance levels
- **Contract Metrics**: Collect and analyze performance metrics for contracts
- **Search and Filtering**: Provide advanced search capabilities for finding contracts

## Architecture

### Components

- **ContractsController**: Exposes REST APIs for contract data access
- **ContractsService**: Core service for contract data management
- **ContractsUtilsService**: Utility service for complex calculations and bid analysis
- **Entities**: Database models for contracts, bytecode, and metrics

### Dependencies

- **Blockchains Module**: For blockchain-specific data and events
- **TypeORM**: For database interactions
- **ethers.js**: For blockchain interactions and bid calculations

## Data Models

### Contract Entity

Represents a deployed contract instance:

- **id**: Unique identifier
- **blockchain**: Reference to the blockchain entity
- **bytecode**: Reference to the bytecode entity
- **address**: The contract's address on the blockchain
- **lastBid**: The last bid amount placed for this contract
- **bidPlusDecay**: The last bid plus accumulated decay
- **totalBidInvestment**: Total amount bid on this contract over time
- **bidBlockNumber**: Block number when the last bid was placed
- **bidBlockTimestamp**: Timestamp when the last bid was placed

### Bytecode Entity

Represents the bytecode shared by potentially multiple contracts:

- **id**: Unique identifier
- **blockchain**: Reference to the blockchain entity
- **bytecodeHash**: Hash of the contract bytecode
- **size**: Size of the bytecode in bytes
- **lastBid**: The last bid amount placed for this bytecode
- **bidPlusDecay**: The last bid plus accumulated decay
- **lastEvictionBid**: The bid amount when the contract was last evicted
- **isCached**: Whether the bytecode is currently cached
- **totalBidInvestment**: Total amount bid on this bytecode over time
- **bidBlockNumber**: Block number when the last bid was placed
- **bidBlockTimestamp**: Timestamp when the last bid was placed

### Metric Entities

- **ContractMetric**: Performance metrics for specific contract instances
- **BytecodeMetric**: Performance metrics for bytecode across instances

## API Endpoints

- `GET /contracts`: List contracts with pagination, sorting, and filtering
- `GET /contracts/:id`: Get detailed information about a specific contract

## Eviction Risk Assessment

The module provides sophisticated eviction risk assessment functionality:

### Risk Levels

- **High Risk**: Contract likely to be evicted soon
- **Medium Risk**: Reasonable chance of staying cached but potential eviction under pressure
- **Low Risk**: Likely to remain cached even under competitive conditions

### Risk Calculation Process

1. **Effective Bid Calculation**:
   - `effectiveBid = lastBid - (timeElapsed * decayRate)`
2. **Risk Level Determination**:
   - Compares effective bid to threshold levels
   - Assigns risk category based on comparison

## Suggested Bids

The module calculates recommended bid amounts for different risk tolerance levels:

### Bid Calculation Factors

- **Base Calculation**: Minimum acceptable bid for the contract's size
- **Risk Multipliers**:
  - High Risk: 1.0x (minimum viable bid)
  - Mid Risk: ~1.5x (adjusted for conditions)
  - Low Risk: ~2.5x (adjusted for conditions)
- **Dynamic Adjustments**: Modified based on cache utilization, eviction rate, and competitiveness

## Cache Statistics

The module tracks and analyzes cache performance metrics:

- **Utilization**: Percentage of total cache space in use
- **Eviction Rate**: Rate of contract evictions
- **Median Bid Per Byte**: Typical bid amount per byte of bytecode
- **Competitiveness**: Overall cache competition level
- **Cache Size**: Total available cache capacity
- **Used Cache Size**: Current cache space utilization

## Usage Example

Retrieving contract data with eviction risk assessment:

```typescript
// Get contract details with eviction risk
GET /contracts/contract-uuid

// Response
{
  "id": "contract-uuid",
  "address": "0xabc123...",
  "lastBid": "1000000000",
  "bidPlusDecay": "950000000",
  "totalBidInvestment": "2500000000",
  "bidBlockNumber": 12345678,
  "bidBlockTimestamp": "2023-08-15T12:34:56Z",
  "effectiveBid": "920000000",
  "evictionRisk": {
    "riskLevel": "medium",
    "remainingEffectiveBid": "920000000",
    "suggestedBids": {
      "highRisk": "800000000",
      "midRisk": "1200000000",
      "lowRisk": "2000000000"
    },
    "comparisonPercentages": {
      "vsHighRisk": 115,
      "vsMidRisk": 76.7,
      "vsLowRisk": 46
    },
    "cacheStats": {
      "utilization": 0.85,
      "evictionRate": 0.12,
      "medianBidPerByte": "1200",
      "competitiveness": 0.75,
      "cacheSizeBytes": "20000000",
      "usedCacheSizeBytes": "17000000"
    }
  },
  "bytecode": {
    "id": "bytecode-uuid",
    "bytecodeHash": "0xhash123...",
    "size": "150000",
    "isCached": true
  }
}
```

## Implementation Notes

- The module uses a sophisticated algorithm to calculate eviction risk based on contract size, current bid, and cache conditions
- Suggested bids are dynamically adjusted based on current cache competitiveness
- Contracts are processed to add calculated fields like effective bid and eviction risk
- The system distinguishes between cached and non-cached contracts when providing recommendations
- Detailed documentation of eviction risk calculation is available in the `eviction-risk.md` file

## References

For more detailed information on eviction risk calculation and bidding strategies, see the [Eviction Risk Documentation](./eviction-risk.md) in this module.
