# User Contracts Module

## Overview

The User Contracts module provides functionality for users to track and monitor smart contracts of interest across different blockchains. It serves as the bridge between users and contracts, allowing them to save contracts they want to keep track of, attach custom names for easier identification, and set up alerts for important events or conditions on those contracts.

## Functionality

- **Contract Tracking**: Save and manage contracts of interest to specific users
- **Custom Naming**: Assign user-defined names to contracts for easy identification
- **Multi-Blockchain Support**: Track contracts across different blockchain networks
- **Contract Details**: Access detailed information including eviction risk and bid analytics
- **Filtered Contract Views**: List user contracts with pagination, sorting, and search capabilities
- **Contract Verification**: Validate contract addresses before tracking them

## Architecture

### Components

- **UserContractsController**: Exposes REST APIs for managing user contracts
- **UserContractsService**: Contains business logic for contract tracking and retrieval
- **UserContract Entity**: Database model representing the user-contract relationship
- **DTOs**: Data Transfer Objects for validating request data and structuring responses

### Dependencies

- **Users Module**: For user entity and authentication information
- **Contracts Module**: For contract data and analytics
- **Blockchains Module**: For blockchain configuration and validation
- **ContractsUtilsService**: For processing contract data and risk calculations
- **TypeORM**: For database interactions
- **ethers.js**: For blockchain contract validation

## API Endpoints

The module exposes the following endpoints:

- `GET /user-contracts`: List all contracts tracked by the authenticated user with filtering options
- `GET /user-contracts/:id`: Get detailed information about a specific user contract
- `POST /user-contracts`: Track a new contract for the authenticated user

## Data Models

### UserContract Entity

The core entity representing a user's tracked contract:

- **id**: Unique identifier for the user contract tracking relationship
- **address**: The blockchain address of the tracked contract
- **name**: User-assigned name for the contract (defaults to the address if not provided)
- **contract**: Optional relationship to a Contract entity (when the contract exists in the system)
- **user**: Relationship to the User who is tracking this contract
- **blockchain**: Relationship to the Blockchain where the contract is deployed

### DTOs

- **CreateUserContractDto**: Validates input for creating new user contracts with address, blockchain ID, and optional name
- **GetUserContractDto**: Validates parameters for retrieving specific user contracts

## Contract Creation Flow

1. User submits a contract address and blockchain ID (with optional name)
2. The system validates that the user isn't already tracking this contract
3. It verifies the blockchain exists in the system
4. It connects to the blockchain and validates that the address is a valid smart contract
5. If a Contract entity for this address already exists, it links to it
6. The system creates a new UserContract entity and associates it with the user
7. The normalized address and provided/default name are stored

## Contract Retrieval Features

When retrieving user contracts, the system:

1. Supports pagination with configurable page size and number
2. Provides sorting options for contract properties
3. Enables text search on contract address and name
4. For contracts with associated Contract entities:
   - Processes them with the ContractsUtilsService
   - Adds eviction risk data and other analytics
   - Includes related contract and bytecode information

## Usage Example

Tracking a new contract:

```typescript
// Create a user contract
POST /user-contracts
{
  "address": "0xabc123def456...",
  "blockchainId": "blockchain-uuid",
  "name": "My DeFi Contract"
}

// Response
{
  "id": "generated-uuid",
  "address": "0xabc123def456...",
  "name": "My DeFi Contract",
  "blockchain": {
    "id": "blockchain-uuid",
    "name": "Stylus"
    // other blockchain details
  }
}
```

Retrieving user contracts:

```typescript
// Get all user contracts
GET /user-contracts?blockchainId=blockchain-uuid&page=1&limit=10&search=defi

// Response
{
  "data": [
    {
      "id": "user-contract-uuid",
      "address": "0xabc123def456...",
      "name": "My DeFi Contract",
      "contract": {
        "id": "contract-uuid",
        "address": "0xabc123def456...",
        "lastBid": "1000000000",
        "effectiveBid": "950000000",
        "evictionRisk": {
          "riskLevel": "low",
          "remainingEffectiveBid": "950000000",
          "suggestedBids": {
            // bid suggestions
          }
        }
        // other contract details
      },
      "blockchain": {
        // blockchain details
      }
    }
    // more user contracts
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "totalItems": 25,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

## Implementation Notes

- The module requires authentication for all endpoints, ensuring users can only access their own contracts
- Contract addresses are normalized using ethers.js to ensure consistent storage
- The system prevents duplicate contract tracking by validating existing relationships
- When a contract doesn't exist in the system, the UserContract is created without a linked Contract
- If the Contract entity is later created by the system, it can be linked to existing UserContract entities
- For contracts with linked Contract entities, additional analytics are provided including eviction risk

## Security Considerations

- All endpoints require user authentication
- Users can only access their own contract tracking data
- Contract addresses are validated on the blockchain before being accepted
- Input data is validated using DTO classes with proper decorators

## Related Modules

This module works closely with:

- **Alerts Module**: For setting up notifications related to tracked contracts
- **Contracts Module**: For detailed contract data and analytics
- **Blockchains Module**: For blockchain configuration and validation
