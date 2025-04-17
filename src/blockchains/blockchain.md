# Blockchains Module

## Overview

The Blockchains module is the core component responsible for managing blockchain data, tracking on-chain events, and providing analytics related to blockchain activity. It serves as the foundation for monitoring smart contract metrics, bid trends, and cache statistics in the Stylus ecosystem.

## Functionality

- **Blockchain Configuration**: Manage multiple blockchain connections and configurations
- **State Tracking**: Capture and store blockchain state snapshots over time
- **Event Monitoring**: Record and process blockchain events (e.g., InsertBid, DeleteBid)
- **Analytics**: Generate statistical data about blockchain activity
- **Cache Monitoring**: Track cache size, usage, and queue metrics
- **Trend Analysis**: Analyze historical data for bid placements and contract usage

## Architecture

### Components

- **BlockchainsController**: Exposes REST APIs for blockchain data access
- **BlockchainsService**: Contains business logic for blockchain data management and analytics
- **Entities**: Database models for blockchain configuration, state, events, and metrics

### Dependencies

- **TypeORM**: For database interactions
- **ConfigService**: For loading blockchain configurations
- **ethers.js**: For blockchain communication

## Data Models

### Blockchain Entity

Core configuration for a blockchain network:

- **id**: Unique identifier
- **name**: Human-readable blockchain name
- **rpcUrl**: URL for the RPC endpoint
- **cacheManagerAddress**: Address of the cache manager contract
- **cacheManagerAutomationAddress**: Address for automation
- **arbWasmCacheAddress**: Address of the WASM cache contract
- **chainId**: Unique identifier for the blockchain network
- **otherInfo**: Flexible JSON field for additional metadata
- **lastSyncedBlock**: Last block synchronized from the blockchain
- **lastProcessedBlockNumber**: Last block that has been fully processed

### BlockchainState Entity

Captures point-in-time state of the blockchain:

- **id**: Unique identifier
- **blockchain**: Reference to the blockchain entity
- **minBid**: Minimum bid amount required
- **decayRate**: Rate at which bids decay
- **cacheSize**: Total size of the cache
- **queueSize**: Current size of the queue
- **isPaused**: Whether the cache manager is paused
- **totalContractsCached**: Number of contracts in the cache
- **blockNumber**: Block number when this state was captured
- **blockTimestamp**: Timestamp of the block
- **timestamp**: When this state was recorded

### BlockchainEvent Entity

Records events emitted by blockchain contracts:

- **id**: Unique identifier
- **blockchain**: Reference to the blockchain entity
- **contractName**: Name of the contract that emitted the event
- **contractAddress**: Address of the contract
- **eventName**: Name of the event (e.g., InsertBid, DeleteBid)
- **blockTimestamp**: When the event occurred
- **blockNumber**: Block containing the event
- **transactionHash**: Hash of the transaction
- **logIndex**: Index of the log in the transaction
- **isRealTime**: Whether the event was captured in real-time
- **eventData**: JSON data containing event parameters

## API Endpoints

- `GET /blockchains`: List all configured blockchains
- `GET /blockchains/:blockchainId`: Get comprehensive data for a blockchain
- `GET /blockchains/:blockchainId/total-bytecodes`: Get bytecode statistics
- `GET /blockchains/:blockchainId/cache-stats`: Get cache statistics
- `GET /blockchains/:blockchainId/bid-trends`: Get bid placement trends over time
- `GET /blockchains/:blockchainId/bid-average`: Get average bid statistics

## Analytics Features

### Bid Placement Trends

The module tracks and analyzes bid placements with different time granularities:

- **Daily (D)**: Bid trends over days
- **Weekly (W)**: Bid trends over weeks
- **Monthly (M)**: Bid trends over months
- **Yearly (Y)**: Bid trends over years

### Bytecode Analysis

Track the number and trends of bytecodes in the cache:

- **Total Count**: Current number of bytecodes in the cache
- **Growth Rate**: Change in bytecode count over time
- **Size Distribution**: Analysis of bytecode sizes

### Bid Statistics

Analyze bid amounts based on contract size:

- **Average Bid**: Overall average bid amount
- **Size-Based Averages**:
  - Small contracts (0-800KB)
  - Medium contracts (800-1600KB)
  - Large contracts (>1600KB)

## Cache Statistics

Monitor the cache utilization and capacity:

- **Queue Size**: Current size of the cache queue
- **Cache Size**: Total capacity of the cache
- **Cache Fill Percentage**: Percentage of cache currently utilized

## Usage Example

Fetching blockchain statistics:

```typescript
// Get comprehensive data for a blockchain
GET /blockchains/blockchain-uuid

// Response
{
  "bytecodeCount": 1245,
  "bytecodeCountDiffWithLastPeriod": 23,
  "queueSize": "12500000",
  "cacheSize": "20000000",
  "bidPlacementTrends": [
    { "period": "2023-08", "count": "12" },
    { "period": "2023-09", "count": "18" }
  ],
  "averageBids": {
    "all": 0.025,
    "small": 0.018,
    "medium": 0.026,
    "large": 0.035
  }
}
```

## Implementation Notes

- The module initializes blockchain configurations from the ConfigService
- Multiple blockchains can be managed simultaneously
- Events are tracked with unique constraints to prevent duplicates
- Analytics queries use SQL date functions for time-based grouping
- Cache statistics provide both raw and formatted data
