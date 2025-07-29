# Alerts Module

## Overview

The Alerts module provides a comprehensive system for monitoring and notifying users about critical events related to their smart contracts on the blockchain. It supports both event-based alerts triggered by blockchain activities and scheduled real-time data checks for monitoring contract metrics.

## Functionality

- **User-Defined Alerts**: Create and manage customizable alerts for specific contracts
- **Multiple Alert Types**: Support for various alert types (eviction, gas levels, bid safety)
- **Multi-Channel Notifications**: Configurable notification delivery via Slack, Telegram, and webhooks
- **Real-Time Monitoring**: Regular polling for conditions that should trigger alerts
- **Event-Based Triggering**: React to specific blockchain events with appropriate alerts

## Architecture

### Components

- **AlertsController**: Exposes REST APIs for alert management
- **AlertsService**: Handles CRUD operations for alerts
- **AlertMonitoringService**: Core monitoring logic for detecting alert conditions
- **Entity**: Database model for alert configuration and state
- **DTOs**: Request validation and data transfer objects

### Dependencies

- **User-Contracts Module**: For accessing user's monitored contracts
- **Blockchains Module**: For blockchain data and event access
- **Contracts Module**: For contract-specific utilities and metrics
- **Notifications Module**: For delivering alerts through various channels
- **BullMQ**: For processing alerts asynchronously through a queue

## Alert Types

The module supports the following alert types:

- **Eviction (EVICTION)**: Alerts when a contract is at risk of being evicted from the blockchain
- **No Gas (NO_GAS)**: Alerts when a contract has no gas remaining
- **Low Gas (LOW_GAS)**: Alerts when a contract's gas level falls below a threshold
- **Bid Safety (BID_SAFETY)**: Alerts when a contract's bid falls below a safe margin compared to the minimum bid

## Monitoring Mechanisms

### Event-Based Monitoring

The system listens for blockchain events and triggers relevant alerts:

1. Events are captured and stored in the database
2. The `handleBlockchainEventAlerts` method processes events when notified
3. Specific event processors (e.g., `processDeleteBidEvent`) handle different event types
4. Matching alerts are identified and queued for notification

### Real-Time Data Monitoring

Regular polling checks for conditions that should trigger alerts:

1. The `handleRealTimeDataAlerts` method runs on a schedule (every minute)
2. It processes each blockchain for active alerts
3. For each alert, it evaluates current conditions against thresholds
4. Alerts that meet trigger conditions are queued for notification

## API Endpoints

The module exposes the following endpoints:

- `GET /alerts`: Get all alerts for a user, filtered by optional blockchainId
- `POST /alerts`: Create or update an alert for a user

## Data Models

### Alert Entity

- **id**: Unique identifier for the alert
- **type**: Type of alert (eviction, noGas, lowGas, bidSafety)
- **value**: Alert-specific configuration value
- **isActive**: Whether the alert is active
- **userContract**: The contract being monitored
- **user**: The user who owns the alert
- **lastTriggered**: When the alert was last triggered
- **lastNotified**: When a notification was last sent
- **triggeredCount**: How many times the alert has been triggered
- **Notification Channels**: Flags for each supported notification channel

## Alert Workflow

1. User creates an alert via the API
2. The system actively monitors for the alert condition:
   - For event-based alerts: When relevant events occur
   - For data-based alerts: On a regular schedule
3. When an alert condition is detected, it's added to the alerts queue
4. The queue processor handles notification delivery
5. Alert status is updated with trigger and notification timestamps

## Usage Example

Creating a bid safety alert:

```typescript
// Request
POST /alerts
{
  "type": "bidSafety",
  "value": "20", // 20% above minimum bid
  "isActive": true,
  "userContractId": "uuid-of-user-contract",
  "telegramChannelEnabled": true
}

// Response
{
  "id": "generated-uuid",
  "type": "bidSafety",
  "value": "20",
  "isActive": true,
  "telegramChannelEnabled": true,
  "slackChannelEnabled": false,
  "webhookChannelEnabled": false,
  "triggeredCount": 0,
  "userContract": {
    "id": "uuid-of-user-contract",
    "address": "0x..."
    // other contract details
  }
}
```

## Implementation Notes

- The alert monitoring system initializes on module startup
- Event-based monitoring uses NestJS event emitters
- Real-time monitoring uses cron jobs running every minute
- Alert processing is handled asynchronously through BullMQ queues
- The system supports both creation of new alerts and updating existing ones

## Alert Processing Logic

### Bid Safety Alerts

The bid safety monitoring computes:

1. The minimum bid required by the cache manager
2. The contract's current effective bid
3. A safety threshold based on user's configured percentage
4. Triggers an alert if the effective bid falls below the threshold
