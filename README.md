# Stylus Cache Manager Backend

## Overview

This repository contains the backend system for the Stylus Cache Manager GUI, an open-source project designed to simplify and optimize the caching of smart contracts on Arbitrum's Stylus environment. This backend handles the core functionality that powers the user interface, including contract monitoring, bid management, analytics processing, and notification systems.

The Stylus Cache Manager aims to address the complexities of on-chain caching through a streamlined, developer-friendly experience. This backend component is critical for delivering real-time blockchain data, processing automated bidding strategies, and powering the alert system.

## Key Features

- **Real-time Contract Monitoring**: Track smart contract cache status across Arbitrum
- **Bid Management API**: Support one-click and automated bidding based on current cache demand
- **Eviction Risk Assessment**: Calculate and report risk levels for cached contracts
- **Multi-channel Notifications**: Deliver alerts via Telegram, Slack, and webhooks
- **Cache Analytics**: Process and deliver metrics on cache utilization and bid trends
- **Blockchain Event Processing**: Capture and process relevant on-chain events

## Architecture

The backend follows a modular NestJS architecture with the following core components:

- **Blockchains Module**: Manages connections to Arbitrum
- **Contracts Module**: Tracks contract status and analyzes eviction risk
- **User Contracts Module**: Maps user preferences to specific contracts
- **Alerts Module**: Processes events that trigger notifications
- **Notifications Module**: Delivers alerts through configured channels
- **Users Module**: Manages user accounts and preferences
- **Authentication Module**: Handles wallet-based authentication
- **Data Processing Module**: Transforms blockchain data into usable metrics

## Getting Started

### Installation

1. Clone the repository

```bash
git clone https://github.com/CoBuilders-xyz/stylus-cm-backend.git
cd stylus-cm-backend
```

2. Install dependencies

```bash
npm install
```

3. Configure environment variables

```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the application

```bash
# Development
npm run start:dev
```

## API Overview

The backend exposes RESTful APIs for the frontend:

- **Authentication**: `/auth/generate-nonce/:address`, `/auth/login`
- **User Contracts**: `/user-contracts`, `/user-contracts/:id`
- **Blockchains**: `/blockchains`, `/blockchains/:id/cache-stats`, `/blockchains/:id/bid-trends`
- **Alerts**: `/alerts`, `/alerts/:id`
- **Users**: `/users/alerts-settings`

## Key Capabilities

### Automated Bidding System

The backend supports automated bidding strategies:

- Trigger bids when minimum bid falls below a threshold
- Set maximum bid limits for cost control
- Track bid performance and adjust strategies

### Alerts and Notifications

The notification system provides:

- Real-time updates via Telegram bot
- Slack integration for team coordination
- Webhook support for custom integrations
- Email notifications

### Analytics and Reporting

The backend processes and delivers:

- Contract position in the cache
- Historical bid trends
- Cache utilization metrics
- Eviction risk assessments

## Development

### Project Structure

- `src/`: Source code organized into feature modules
- `docs/`: Documentation for each module
- `test/`: Test files

### Key Technologies

- **NestJS**: Backend framework
- **TypeORM**: Database ORM
- **ethers.js**: Ethereum interactions
- **BullMQ**: Queue processing for notifications and data
- **PostgreSQL**: Data storage
- **JWT**: Authentication

## Documentation

Each module contains detailed documentation in a `.md` file explaining its purpose, features, and implementation details. For comprehensive documentation, check the respective module folders.

## About the Project

This backend is part of the CoBuilders Stylus Cache Manager project, which received an [ARB grant](https://arbitrum.questbook.app/dashboard/?proposalId=67489c3d90449961f516e735&ref=blog.arbitrum.io&grantId=671a105a2047c84bb8a73770&chainId=10) to develop an open-source GUI for Arbitrum's Cache Manager with automated bidding, real-time alerts, and usage insights.
