# Notifications Module

## Overview

The Notifications module is responsible for delivering alert notifications to users through multiple communication channels. It provides a robust system for queuing, processing, and sending notifications triggered by various events within the application. The module implements an extensible architecture that supports email, Slack, Telegram, and webhook notifications, with built-in error handling, retry logic, and rate limiting.

## Functionality

- **Multi-Channel Delivery**: Send notifications through email, Slack, Telegram, and webhooks
- **Asynchronous Processing**: Queue-based architecture for reliable delivery
- **Retry Mechanisms**: Automatic retries with exponential backoff for failed notifications
- **Rate Limiting**: Configurable backoff delay to prevent notification flooding
- **User Preferences**: Respect user-defined notification settings and preferences
- **Template System**: Dynamic content generation based on alert type and context
- **Mock Notifications**: Test notification delivery without triggering real alerts

## Architecture

### Components

- **NotificationsService**: Core service that coordinates notification dispatch
- **Channel-Specific Services**:

  - **EmailNotificationService**: Sends notifications via SendGrid email
  - **SlackNotificationService**: Delivers messages to Slack channels
  - **TelegramNotificationService**: Sends alerts through Telegram bots
  - **WebhookNotificationService**: Posts notification data to external webhooks

- **Queue Processors**:
  - **AlertsConsumer**: Processes trigger events and dispatches to appropriate channels
  - **EmailNotificationProcessor**: Handles email-specific notification processing
  - **SlackNotificationProcessor**: Processes Slack notification jobs
  - **TelegramNotificationProcessor**: Manages Telegram message delivery
  - **WebhookNotificationProcessor**: Executes webhook notification requests

### Dependencies

- **BullMQ**: For queue management and job processing
- **TypeORM**: For database interactions
- **HttpModule**: For external API communications
- **Alerts Module**: For alert entity and notification triggers
- **Users Module**: For user preferences and contact information
- **User-Contracts Module**: For contract data needed in notifications

## Notification Flow

### Alert Triggering

1. When an alert condition is detected:
   - The alert is stored in the database
   - A job is added to the alerts queue with the alert ID
   - The AlertsConsumer processes the job
   - The AlertsConsumer loads the alert, user, and contract details
   - The relevant notification channels are determined based on alert and user settings

### Notification Processing

1. For each enabled notification channel:
   - A job is queued in the channel-specific queue (email, Slack, Telegram, webhook)
   - The channel processor fetches necessary data for the notification
   - The notification is formatted according to templates for the channel
   - The formatted notification is sent to the appropriate destination
   - Successful deliveries are logged and tracked
   - Failed deliveries are automatically retried according to queue settings

## Notification Channels

### Email Notifications

Email notifications are sent using the SendGrid API and feature:

- HTML and plaintext content formats
- Responsive email templates with alert-specific styling
- Custom subject lines based on alert type
- Contract address and information included in the email

### Slack Notifications

Slack notifications utilize webhook integrations:

- Rich text formatting with alert severity highlighting
- Structured message blocks for better readability
- Deep links to affected contracts
- Alert-specific action buttons

### Telegram Notifications

Telegram notifications work through the Telegram Bot API:

- Concise message format optimized for mobile viewing
- Markdown formatting for better readability
- Inline keyboards for quick actions (when applicable)
- Bot authentication and secure message delivery

### Webhook Notifications

Webhook notifications provide integration with external systems:

- JSON payload with comprehensive alert data
- HTTP POST requests to configured endpoints
- Authentication options for secure delivery
- Configurable retry logic for failed deliveries

## Rate Limiting

The module implements a backoff delay mechanism to prevent notification flooding:

- Configurable minimum time between notifications for the same alert
- Global backoff settings through environment variables
- Per-alert tracking of last notification time
- Skip notification if backoff delay has not been exceeded

## Queuing and Retry Logic

Each notification channel has its own queue with specific settings:

- **Email**: 3 retry attempts with exponential backoff
- **Slack**: 3 retry attempts with exponential backoff
- **Telegram**: 5 retry attempts with exponential backoff
- **Webhook**: 3 retry attempts with exponential backoff

Failed jobs are preserved for debugging and manual intervention if needed.

## Usage Example

The NotificationsService can be used directly in other modules:

```typescript
// Example of manually sending a notification for an alert
@Injectable()
class SomeService {
  constructor(
    private notificationsService: NotificationsService,
    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async sendAlertNotification(alertId: string) {
    // Load the alert with related user
    const alert = await this.alertsRepository.findOne({
      where: { id: alertId },
      relations: ['user'],
    });

    if (!alert) {
      throw new Error('Alert not found');
    }

    // Load the user with all alert settings
    const user = await this.userRepository.findOne({
      where: { id: alert.user.id },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Send notifications through all enabled channels
    await this.notificationsService.sendNotifications(
      alert,
      user.alertsSettings,
    );
  }
}
```

## Testing Notifications

The module includes a mock notification system for testing:

```typescript
// Example of sending a test notification
await notificationsService.sendMockNotification(user, 'email');
```

This allows testing notification delivery without triggering actual alerts.

## Configuration

The module is configured through environment variables:

- **SENDGRID_SENDER_EMAIL**: Email address used as the sender
- **SENDGRID_SENDER_NAME**: Display name for the email sender
- **SEND_GRID_TOKEN**: SendGrid API key for email delivery
- **BACKOFF_DELAY**: Time in milliseconds between notifications for the same alert
- **TELEGRAM_BOT_TOKEN**: Authentication token for the Telegram bot

## Implementation Notes

- Each notification processor is implemented as a BullMQ worker
- Error handling includes detailed logging for troubleshooting
- The module follows a consistent pattern across all notification channels
- Templates are optimized for readability on various devices
- The system is designed to be resilient against external service outages
