# Users Module

## Overview

The Users module is the central component for managing user accounts and preferences within the application. It provides functionality for creating and updating user profiles, managing notification preferences, and serving as the identity foundation for authentication and authorization. The module is designed to support Ethereum wallet-based authentication and multi-channel alert configuration.

## Functionality

- **User Management**: Create and retrieve user accounts based on blockchain addresses
- **Alert Preferences**: Configure and manage user-specific alert notification settings
- **Multi-Channel Notifications**: Support for email, Telegram, Slack, and webhook notification channels
- **Preference Persistence**: Store and retrieve user preferences across sessions
- **User Identity**: Serve as the central identity provider for the application

## Architecture

### Components

- **UsersController**: Exposes REST APIs for managing user profiles and alert preferences
- **UsersService**: Contains business logic for user operations
- **User Entity**: Database model representing user accounts and preferences
- **DTOs**: Data Transfer Objects for validating request data

### Dependencies

- **TypeORM**: For database interactions
- **Authentication Module**: For user authentication and authorization
- **Alerts Module**: For triggering alerts based on user preferences
- **Notifications Module**: For delivering alerts through configured channels

## API Endpoints

The module exposes the following endpoints:

- `GET /users/alerts-settings`: Retrieve a user's notification preferences
- `PATCH /users/alerts-settings`: Update all notification preferences at once
- `PATCH /users/alerts-settings/email`: Update email notification settings
- `PATCH /users/alerts-settings/telegram`: Update Telegram notification settings
- `PATCH /users/alerts-settings/slack`: Update Slack notification settings
- `PATCH /users/alerts-settings/webhook`: Update webhook notification settings

## Data Models

### User Entity

The core entity representing a user account:

- **id**: Unique identifier (UUID)
- **address**: Ethereum wallet address (unique)
- **name**: Optional user display name
- **isActive**: Flag indicating if the account is active
- **alertsSettings**: JSON structure containing notification preferences

### AlertsSettings Interface

Configurable notification preferences:

- **emailSettings**: Email notification configuration
- **telegramSettings**: Telegram notification configuration
- **slackSettings**: Slack notification configuration
- **webhookSettings**: Webhook notification configuration

Each notification channel has a common structure:

- **enabled**: Boolean indicating if the channel is active
- **destination**: Channel-specific destination (email address, chat ID, webhook URL, etc.)

### DTOs

- **AlertsSettingsDto**: Validates complete alerts settings updates
- **EmailSettingsDto**: Validates email notification settings
- **TelegramSettingsDto**: Validates Telegram notification settings
- **SlackSettingsDto**: Validates Slack notification settings
- **WebhookSettingsDto**: Validates webhook notification settings

## User Creation Flow

1. When a user authenticates for the first time (via the Auth module):

   - The system checks if a user with the given address exists
   - If not, a new user account is created automatically
   - Default alerts settings (empty object) are assigned

2. Manual user creation is also possible through the service's create method:
   - Requires a valid Ethereum address
   - Creates a new user with default settings

## Alerts Settings Management

The module provides several ways to update notification preferences:

1. **Complete Settings Update**: Replace all notification settings at once
2. **Channel-Specific Updates**: Update settings for individual channels
3. **Intelligent Preservation**: When disabling a channel, the destination is preserved for future re-enabling

Each update method:

- Validates input data using DTOs
- Preserves destination information when appropriate
- Ensures data consistency before saving

## Usage Example

Configuring email notifications:

```typescript
// Enable email notifications
PATCH /users/alerts-settings/email
{
  "enabled": true,
  "destination": "user@example.com"
}

// Response
{
  "emailSettings": {
    "enabled": true,
    "destination": "user@example.com"
  },
  "telegramSettings": {
    "enabled": false,
    "destination": "12345678"
  },
  "slackSettings": {
    "enabled": false
  },
  "webhookSettings": {
    "enabled": false
  }
}
```

Retrieving current notification settings:

```typescript
// Get all notification settings
GET /users/alerts-settings

// Response
{
  "emailSettings": {
    "enabled": true,
    "destination": "user@example.com"
  },
  "telegramSettings": {
    "enabled": false,
    "destination": "12345678"
  },
  "slackSettings": {
    "enabled": false
  },
  "webhookSettings": {
    "enabled": false
  }
}
```

## Implementation Notes

- The module automatically handles user creation when authentication is successful
- When disabling a notification channel, the destination is preserved to simplify re-enabling
- All endpoints require authentication and users can only access their own data
- Each notification channel has validation appropriate to its type (email validation, URL validation, etc.)
- The module uses a flexible JSON structure for alert settings to allow for future expansion

## Security Considerations

- User identification is based on cryptographically verified Ethereum addresses
- All user operations require authentication
- Input validation ensures data integrity and prevents injection attacks
- API endpoints are protected and only allow users to access their own data

## Related Modules

This module works closely with:

- **Auth Module**: For authenticating users and creating accounts
- **Alerts Module**: For generating alerts based on user preferences
- **Notifications Module**: For delivering alerts through configured channels
- **User Contracts Module**: For linking users to their tracked contracts
