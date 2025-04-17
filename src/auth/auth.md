# Authentication Module

## Overview

The Authentication module handles user authentication through Ethereum wallet signatures. It implements a secure workflow for validating wallet ownership through signature verification using a nonce-based challenge-response mechanism. The module integrates with JWT for session management and provides route protection through a global guard.

## Functionality

- **Wallet-based Authentication**: Authenticate users through Ethereum wallet signatures
- **Nonce Management**: Generate and validate single-use nonce challenges
- **Session Management**: Issue and validate JWT tokens
- **Route Protection**: Guard protected routes with authentication requirements
- **Public Route Exemptions**: Allow configurable public endpoints

## Architecture

### Components

- **AuthController**: Exposes endpoints for nonce generation and signature verification
- **AuthService**: Implements authentication logic, including nonce generation and signature verification
- **AuthGuard**: Global guard that protects routes and validates JWT tokens
- **DTOs**: Structured data transfer objects for authentication requests

### Dependencies

- **UsersModule**: For user lookup and creation
- **JwtModule**: For token generation and validation
- **CacheModule**: For temporary nonce storage
- **ethers**: For cryptographic operations including signature verification

## Authentication Flow

1. Client requests a nonce by providing an Ethereum address
2. Server generates a unique nonce message and stores it temporarily
3. Client signs the nonce message with their private key
4. Client sends the address and signature to the server
5. Server verifies the signature matches the stored nonce and address
6. On success, server issues a JWT token for subsequent requests

## API Endpoints

- `GET /auth/generate-nonce/:address`: Generate a nonce for the given Ethereum address
- `POST /auth/login`: Verify a signature and issue a JWT token
- `POST /auth/sign-message`: (Testing only) Sign a message with a private key

## Data Models

### DTOs

- **GenerateNonceDto**: Contains the Ethereum address for nonce generation
- **VerifySignatureDto**: Contains the address and signature for verification

## Security

- Nonces are single-use and time-limited
- JWT tokens have a configurable expiration time (default: 1 day)
- Signature verification uses industry-standard cryptographic methods
- The JWT secret should be securely stored outside source control (currently using a placeholder)

## Configuration

Authentication settings are configured through environment variables and constants:

- JWT secret (should be moved to environment variables)
- Token expiration time (should be moved to environment variables)
- Nonce expiration time (currently 10000ms)

## Usage Example

### Protecting a Route

```typescript
// Public route (no authentication required)
@Public()
@Get('public-endpoint')
publicEndpoint() {
  return { message: 'This endpoint is public' };
}

// Protected route (requires authentication)
@Get('protected-endpoint')
protectedEndpoint() {
  return { message: 'This endpoint is protected' };
}
```

### Client Authentication Flow

```typescript
// 1. Request a nonce
const nonceResponse = await axios.get(`/auth/generate-nonce/${walletAddress}`);
const nonce = nonceResponse.data.nonce;

// 2. Sign the nonce with wallet
const signature = await wallet.signMessage(nonce);

// 3. Submit signature for verification
const authResponse = await axios.post('/auth/login', {
  address: walletAddress,
  signature: signature,
});

// 4. Store the JWT token
const token = authResponse.data.accessToken;

// 5. Use token for subsequent requests
const config = {
  headers: { Authorization: `Bearer ${token}` },
};
const protectedResponse = await axios.get('/protected-endpoint', config);
```

## Implementation Notes

- The auth guard is registered globally in the module and applies to all routes by default
- Routes can be marked as public using the `@Public()` decorator
- User accounts are automatically created if they don't exist during authentication
- The service includes methods for testing purposes (e.g., `signMessage`)

## TODO Items

- Move JWT secret to environment variables
- Move token expiration time to environment variables
- Add checksum address validation
- Set configurable nonce expiration time
