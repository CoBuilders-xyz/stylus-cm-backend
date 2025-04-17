# Event Fetcher Module

## Overview

The Event Fetcher module is responsible for retrieving, monitoring, and storing blockchain events emitted by smart contracts. It provides both historical synchronization capabilities and real-time event listening, ensuring that the system maintains a complete and up-to-date record of all relevant blockchain activity. This data serves as the foundation for contract tracking, analytics, and alert mechanisms throughout the application.

## Functionality

- **Real-Time Event Listening**: Monitor blockchain contracts for new events as they occur
- **Historical Event Synchronization**: Retrieve and process past events to fill gaps in data
- **Selective Event Filtering**: Focus on specific event types based on configuration
- **Robust Event Storage**: Store events with proper transaction handling and duplicate detection
- **Resynchronization**: Support for manually triggered re-syncs of specified block ranges
- **Multi-Blockchain Support**: Handle events from multiple blockchain networks simultaneously

## Architecture

### Components

- **EventFetcherService**: Core service that coordinates event fetching operations
- **EventListenerService**: Sets up and manages real-time blockchain event listeners
- **EventSyncService**: Handles historical event retrieval and synchronization
- **EventStorageService**: Manages the persistence of blockchain events
- **EventSchedulerService**: Coordinates periodic and on-demand event synchronization
- **EventConfigService**: Provides configuration for event fetching operations

### Dependencies

- **Blockchains Module**: For blockchain entities and configuration
- **TypeORM**: For database interactions
- **ethers.js**: For blockchain communication and event parsing
- **Event Emitter**: For notifying the system about new events
- **ProviderManager**: For managing blockchain provider connections

## Event Processing Flow

### Initialization Process

1. When the module initializes, it performs these sequential steps:
   - Retrieves all configured blockchains from the database
   - Performs an initial historical synchronization to catch up on missed events
   - Sets up real-time event listeners for each blockchain network
   - Begins monitoring for new events

### Historical Synchronization

1. For each blockchain:
   - Determines the last synchronized block number
   - Fetches the latest block number from the network
   - Retrieves events for all configured event types in the block range
   - Processes and stores the events in batch operations
   - Updates the last synchronized block number

### Real-Time Monitoring

1. For each blockchain:
   - Establishes connections to the relevant smart contracts
   - Sets up event listeners for all configured event types
   - When an event occurs:
     - Extracts event data and metadata
     - Processes and stores the event
     - Emits a notification for other modules to react

## Event Types

The module is configured to track specific event types, which typically include:

- **InsertBid**: When a new bid is placed for a contract
- **DeleteBid**: When a contract is removed from the cache
- **SetCacheSize**: When the cache size configuration changes
- **SetDecayRate**: When the decay rate configuration changes
- **Pause/Unpause**: When the cache system is paused or unpaused

## Storage and Deduplication

The module employs a sophisticated storage strategy:

- **Transaction Handling**: Each event is stored in its own database transaction
- **Duplicate Detection**: Prevents storing the same event multiple times
- **Real-Time Flagging**: Updates historical events with real-time status when detected again
- **Batch Processing**: Processes events in controlled batches for better error isolation

## Utilities and Helpers

### Event Parsing

- **Transaction Hash Extraction**: Retrieves transaction hash from event data
- **Log Index Management**: Handles event ordering within transactions
- **Argument Serialization**: Converts complex event arguments into storable formats

### Contract Operations

- **Safe Contract Calls**: Provides retry mechanisms for network operations
- **Provider Management**: Handles provider connections and contract instance creation

## Configuration

The module's behavior can be customized through configuration:

- **Event Types**: Specify which event types to monitor
- **Batch Sizes**: Control how many events are processed at once
- **Retry Settings**: Configure retry behavior for network operations
- **Blockchain Settings**: Specify contract addresses and RPC endpoints

## Usage Example

The module primarily works behind the scenes, with most operations happening automatically:

```typescript
// The event fetcher automatically handles event processing
// Example of manually triggering a resync operation:
@Injectable()
class SomeService {
  constructor(private eventFetcherService: EventFetcherService) {}

  async manuallyResyncAllEvents() {
    // Trigger a full resync for all blockchains
    const result = await this.eventFetcherService.triggerResync();
    return `Resync operation started: ${result}`;
  }

  async resyncSpecificBlockchain(blockchainId: string) {
    // Trigger a resync for a specific blockchain
    const result = await this.eventFetcherService.triggerResync(blockchainId);
    return `Resync operation started for blockchain ${blockchainId}: ${result}`;
  }
}
```

## Implementation Notes

- **Graceful Shutdown**: The module properly cleans up resources during application shutdown
- **Connection Management**: Providers and listeners are managed to prevent resource leaks
- **Error Handling**: Comprehensive error handling with detailed logging for troubleshooting
- **Concurrency Control**: Processing sets track in-progress events to prevent duplicate processing
- **Idempotent Operations**: Operations are designed to be safely repeatable

## Advanced Features

- **Selective Block Range Processing**: Support for processing specific block ranges
- **Event Filtering**: Focus on specific events to reduce processing overhead
- **Contract Detection**: Automatic identification of contract types based on addresses
- **Real-Time Flagging**: Distinguish between historical and real-time events
- **Progress Tracking**: Maintain processing state for recovery after interruptions
