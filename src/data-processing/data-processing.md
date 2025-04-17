# Data Processing Module

## Overview

The Data Processing module is responsible for transforming raw blockchain events into structured data models, maintaining the state of contracts and bytecodes, and providing real-time analytics. It serves as the core data transformation layer between blockchain events and the application's business logic, ensuring that contract and bidding data is accurately processed and up-to-date.

## Functionality

- **Event Processing**: Process blockchain events (InsertBid, DeleteBid, SetDecayRate, etc.)
- **State Management**: Maintain the current state of contracts and bytecodes
- **Bid Calculation**: Calculate actual bids, considering decay rates and time factors
- **Data Transformation**: Convert raw blockchain data into structured application models
- **Real-Time Updates**: Process new events as they occur for immediate data availability
- **Historical Processing**: Process historical events to rebuild system state on startup

## Architecture

### Components

- **DataProcessingService**: Core service that coordinates event processing operations
- **EventProcessorService**: Specialized service for processing blockchain events
- **InsertBidService**: Handles InsertBid events that place new bids for contracts
- **DeleteBidService**: Handles DeleteBid events that remove contracts from the cache
- **DecayRateService**: Processes decay rate changes that affect bid calculations
- **ContractBytecodeService**: Manages the relationship between contracts and bytecodes

### Dependencies

- **Blockchains Module**: For blockchain entities and events
- **Contracts Module**: For contract and bytecode entities
- **TypeORM**: For database interactions
- **Event Emitter**: For handling event-driven processing
- **ethers.js**: For blockchain data conversions and calculations

## Processing Flow

### Initial Processing

1. When the module initializes, it performs a complete processing of all historical events:
   - Loads all blockchain configurations from the database
   - For each blockchain, retrieves all unprocessed events
   - Processes events in chronological order (by block number and log index)
   - Updates the last processed block number for each blockchain

### Real-Time Processing

1. When a new blockchain event is stored:
   - An event notification is emitted (`blockchain.event.stored`)
   - The `handleNewBlockchainEvent` method receives the notification
   - The specific event is loaded and processed based on its type
   - The blockchain's last processed block number is updated

## Event Types and Processing

### InsertBid Events

Emitted when a new bid is placed for a contract:

1. The system extracts bid amount, contract address, and bytecode information
2. Calculates the effective bid considering decay rates
3. Updates or creates contract and bytecode records
4. Updates total bid investment statistics

### DeleteBid Events

Emitted when a contract is removed from the cache:

1. The system identifies the contract or bytecode being deleted
2. Updates its cached status to false
3. Records the eviction bid amount for future reference
4. Updates related contracts if a bytecode is evicted

### Decay Rate Events

Emitted when the system's decay rate configuration changes:

1. The system records the new decay rate
2. Updates calculations for all affected contracts
3. Adjusts the effective bid amounts based on the new rate

## Utility Functions

### Bid Calculations

- **calculateActualBid**: Computes the effective bid after decay
- **calculateBidPlusDecay**: Determines the total bid including decay amount
- **updateTotalBidInvestment**: Tracks cumulative bid investments for contracts

### Event Processing

- **findApplicableDecayRate**: Determines which decay rate applies for a given event
- **processEvents**: Maps event types to their respective processing methods

## Data Models

### Contract Bytecode State

Tracks the current state of a contract's bytecode:

- **isCached**: Whether the bytecode is currently in the cache
- **bid**: Current bid amount
- **bidPlusDecay**: Bid including decay amount
- **lastEvictionBid**: Bid amount when last evicted
- **size**: Size of the bytecode
- **totalBidInvestment**: Cumulative amount bid on this bytecode

### Blockchain State Record

Captures the state of the blockchain at a point in time:

- **blockNumber**: The block at which this state was recorded
- **minBid**: Minimum bid amount required
- **decayRate**: Current decay rate per second
- **cacheSize**: Total cache capacity
- **queueSize**: Current queue size
- **isPaused**: Whether the cache system is paused

## Usage Example

The module primarily works behind the scenes, processing events automatically:

```typescript
// The module automatically processes events when they are stored
// Example of manual processing (typically not needed):
@Injectable()
class SomeService {
  constructor(private dataProcessingService: DataProcessingService) {}

  async forceReprocessEvents() {
    // Trigger full reprocessing of all events
    await this.dataProcessingService.processAllEvents();
  }

  async processNewEventManually(blockchainId: string, eventId: string) {
    // Process a specific new event
    await this.dataProcessingService.processNewEvent(blockchainId, eventId);
  }
}
```

## Implementation Notes

- The module uses a façade pattern with the DataProcessingService coordinating specialized services
- Event processing is idempotent, allowing safe reprocessing of events if needed
- Events are processed in strict chronological order to ensure data consistency
- The module maintains the "last processed block number" to enable incremental processing
- Error handling includes detailed logging for debugging processing issues

## Advanced Features

- **Transaction Support**: Critical operations use database transactions for data integrity
- **Strategic Batching**: Events are processed in batches for efficiency
- **Dependency Injection**: Services use dependency injection for flexible configuration
- **Event-Driven Architecture**: Processing is triggered by system events for real-time updates
