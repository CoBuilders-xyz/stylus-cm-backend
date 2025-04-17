# State Fetcher Module

## Overview

The State Fetcher module is responsible for periodically retrieving and storing the current state of blockchain cache managers. It polls key metrics from smart contracts, such as cache size, queue size, decay rates, and paused status, providing a historical record of blockchain state that supports analysis, monitoring, and alerting functionality throughout the application.

## Functionality

- **Regular State Polling**: Periodic collection of blockchain state metrics
- **Initial State Collection**: Bootstrapping state data on application startup
- **Multi-Blockchain Support**: Concurrent state fetching from multiple blockchains
- **Historical Data Storage**: Persistence of time-series blockchain state information
- **Smart Contract Interaction**: Direct communication with blockchain cache manager contracts
- **Scheduled Execution**: Automated polling at configurable intervals

## Architecture

### Components

- **StateFetcherService**: Core service that handles blockchain state polling and storage
- **Scheduled Tasks**: Cron-based jobs that trigger periodic state collection
- **State Entity Model**: Database schema for storing blockchain state snapshots

### Dependencies

- **TypeORM**: For database interactions
- **NestJS Schedule**: For cron-based scheduling
- **ethers.js**: For blockchain communication
- **Blockchains Module**: For blockchain configuration and entity access
- **Common Module**: For smart contract ABI definitions

## Polling Process

### Initialization

1. When the module initializes:
   - It fetches all configured blockchains from the database
   - For each blockchain with valid configuration (RPC URL and contract address):
     - Establishes a connection to the blockchain
     - Performs an initial state polling operation
     - Stores the initial state data

### Periodic Polling

1. Every 5 minutes (configurable via cron expression):
   - The scheduler triggers the `handleCron` method
   - All configured blockchains are retrieved
   - For each valid blockchain:
     - A provider connection is established
     - Current state metrics are fetched
     - The state data is saved to the database

### Metrics Collection

During each polling operation, the following data is collected:

1. **Contract State**:

   - **Entries**: List of all cached entries (contracts)
   - **Decay Rate**: Current rate at which bids decay
   - **Cache Size**: Total available cache capacity
   - **Queue Size**: Current used cache space
   - **Paused Status**: Whether the cache manager is paused

2. **Blockchain Information**:

   - **Block Number**: Current block number
   - **Block Timestamp**: Timestamp of the current block

3. **Derived Metrics**:
   - **Total Contracts Cached**: Count of contracts currently in the cache

## Data Model

### BlockchainState Entity

The module stores state snapshots in the `BlockchainState` entity:

- **id**: Unique identifier for the state snapshot
- **blockchain**: Reference to the blockchain entity
- **minBid**: Minimum bid amount (currently set to 0)
- **decayRate**: Rate at which bids decay
- **cacheSize**: Total cache capacity
- **queueSize**: Current queue size
- **isPaused**: Whether the cache manager is paused
- **blockNumber**: Block number when the state was captured
- **blockTimestamp**: Timestamp of the block
- **totalContractsCached**: Number of contracts in the cache
- **timestamp**: When the state was recorded (auto-generated)

## Error Handling

The module implements robust error handling:

- **Blockchain-Level Isolation**: Errors in one blockchain do not affect polling for others
- **Detailed Logging**: Comprehensive error logging for troubleshooting
- **Validation Checks**: Pre-validation of blockchain configuration before attempting connection
- **Graceful Degradation**: Skip invalid or inaccessible blockchains and continue with others

## Usage Example

The state data collected by this module is primarily used by other services:

```typescript
// Example of using state data for analysis
@Injectable()
class StateAnalysisService {
  constructor(
    @InjectRepository(BlockchainState)
    private blockchainStateRepository: Repository<BlockchainState>,
  ) {}

  async getUtilizationTrend(
    blockchainId: string,
    timespan: string,
  ): Promise<any> {
    // Get historical state data for analysis
    const states = await this.blockchainStateRepository.find({
      where: {
        blockchain: { id: blockchainId },
        timestamp: MoreThan(/* calculate date based on timespan */),
      },
      order: { timestamp: 'ASC' },
    });

    // Calculate utilization percentage for each state snapshot
    return states.map((state) => ({
      timestamp: state.timestamp,
      utilization: (Number(state.queueSize) / Number(state.cacheSize)) * 100,
      totalContractsCached: state.totalContractsCached,
    }));
  }
}
```

## Configuration

The module's behavior can be adjusted through:

- **Polling Interval**: Controlled by the cron expression in the `@Cron` decorator
- **Blockchain Settings**: RPC URLs and contract addresses from the blockchain entities

## Implementation Notes

- The module uses `OnModuleInit` to ensure state data is collected immediately at startup
- Polling operations are performed concurrently for multiple blockchains
- State information is stored as a time series, creating a new record for each polling operation
- The service handles contract interaction failures gracefully with detailed logging
- Direct contract calls are used rather than event-based tracking for more reliable state data

## Integration Points

- **Alerts Module**: Uses state data to detect conditions that should trigger alerts
- **Blockchains Module**: Provides blockchain configuration and entity access
- **Data Processing Module**: Analyzes state data for insights and trends
- **Contracts Module**: Uses state data for contract bid analysis and eviction risk assessment

## Advanced Features

- **Smart Contract Integration**: Direct interaction with on-chain cache manager contracts
- **Concurrent Processing**: Parallel state fetching for multiple blockchains
- **Historical Trend Analysis**: Time-series data enabling trend visualization
- **Automatic Reconnection**: Resilient handling of temporary connection issues
