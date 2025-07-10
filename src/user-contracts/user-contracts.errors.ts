import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Error codes for the User Contracts module
 */
export enum UserContractsErrorCode {
  USER_CONTRACT_NOT_FOUND = 'USER_CONTRACT_NOT_FOUND',
  CONTRACT_ALREADY_EXISTS = 'CONTRACT_ALREADY_EXISTS',
  BLOCKCHAIN_NOT_FOUND = 'BLOCKCHAIN_NOT_FOUND',
  INVALID_CONTRACT_ADDRESS = 'INVALID_CONTRACT_ADDRESS',
  CONTRACT_VALIDATION_FAILED = 'CONTRACT_VALIDATION_FAILED',
  ENRICHMENT_FAILED = 'ENRICHMENT_FAILED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  INVALID_BLOCKCHAIN_ID = 'INVALID_BLOCKCHAIN_ID',
  CONTRACT_NOT_ON_BLOCKCHAIN = 'CONTRACT_NOT_ON_BLOCKCHAIN',
  BYTECODE_CREATION_FAILED = 'BYTECODE_CREATION_FAILED',
  CONTRACT_ENTITY_CREATION_FAILED = 'CONTRACT_ENTITY_CREATION_FAILED',
}

/**
 * Error definitions with structured error messages
 */
export const UserContractsErrors = {
  USER_CONTRACT_NOT_FOUND: {
    error: UserContractsErrorCode.USER_CONTRACT_NOT_FOUND,
    message: 'User contract not found with the provided ID',
  },
  CONTRACT_ALREADY_EXISTS: {
    error: UserContractsErrorCode.CONTRACT_ALREADY_EXISTS,
    message: 'User contract already exists for this address and blockchain',
  },
  BLOCKCHAIN_NOT_FOUND: {
    error: UserContractsErrorCode.BLOCKCHAIN_NOT_FOUND,
    message: 'Blockchain not found with the provided ID',
  },
  INVALID_CONTRACT_ADDRESS: {
    error: UserContractsErrorCode.INVALID_CONTRACT_ADDRESS,
    message: 'Invalid contract address format',
  },
  CONTRACT_VALIDATION_FAILED: {
    error: UserContractsErrorCode.CONTRACT_VALIDATION_FAILED,
    message: 'Contract validation failed on the blockchain',
  },
  ENRICHMENT_FAILED: {
    error: UserContractsErrorCode.ENRICHMENT_FAILED,
    message: 'Failed to enrich user contract data',
  },
  UNAUTHORIZED_ACCESS: {
    error: UserContractsErrorCode.UNAUTHORIZED_ACCESS,
    message: 'User not authorized to access this contract',
  },
  INVALID_BLOCKCHAIN_ID: {
    error: UserContractsErrorCode.INVALID_BLOCKCHAIN_ID,
    message: 'Invalid blockchain ID format',
  },
  CONTRACT_NOT_ON_BLOCKCHAIN: {
    error: UserContractsErrorCode.CONTRACT_NOT_ON_BLOCKCHAIN,
    message:
      'The provided address is not a smart contract on the selected blockchain',
  },
  BYTECODE_CREATION_FAILED: {
    error: UserContractsErrorCode.BYTECODE_CREATION_FAILED,
    message: 'Failed to create or retrieve bytecode entity',
  },
  CONTRACT_ENTITY_CREATION_FAILED: {
    error: UserContractsErrorCode.CONTRACT_ENTITY_CREATION_FAILED,
    message: 'Failed to create or retrieve contract entity',
  },
} as const;

/**
 * Helper functions for throwing specific user contract errors
 */
export const UserContractsErrorHelpers = {
  // NotFound Errors (404)
  throwUserContractNotFound: (id?: string) => {
    const message = id
      ? `User contract not found with ID: ${id}`
      : UserContractsErrors.USER_CONTRACT_NOT_FOUND.message;
    throw new NotFoundException({
      ...UserContractsErrors.USER_CONTRACT_NOT_FOUND,
      message,
    });
  },

  throwBlockchainNotFound: (blockchainId?: string) => {
    const message = blockchainId
      ? `Blockchain not found with ID: ${blockchainId}`
      : UserContractsErrors.BLOCKCHAIN_NOT_FOUND.message;
    throw new NotFoundException({
      ...UserContractsErrors.BLOCKCHAIN_NOT_FOUND,
      message,
    });
  },

  // BadRequest Errors (400)
  throwInvalidContractAddress: (address?: string) => {
    const message = address
      ? `Invalid contract address format: ${address}`
      : UserContractsErrors.INVALID_CONTRACT_ADDRESS.message;
    throw new BadRequestException({
      ...UserContractsErrors.INVALID_CONTRACT_ADDRESS,
      message,
    });
  },

  throwContractValidationFailed: (details?: string) => {
    const message = details
      ? `${UserContractsErrors.CONTRACT_VALIDATION_FAILED.message}: ${details}`
      : UserContractsErrors.CONTRACT_VALIDATION_FAILED.message;
    throw new BadRequestException({
      ...UserContractsErrors.CONTRACT_VALIDATION_FAILED,
      message,
    });
  },

  throwInvalidBlockchainId: (blockchainId?: string) => {
    const message = blockchainId
      ? `Invalid blockchain ID format: ${blockchainId}`
      : UserContractsErrors.INVALID_BLOCKCHAIN_ID.message;
    throw new BadRequestException({
      ...UserContractsErrors.INVALID_BLOCKCHAIN_ID,
      message,
    });
  },

  throwContractNotOnBlockchain: (address?: string, blockchainName?: string) => {
    const baseMessage = UserContractsErrors.CONTRACT_NOT_ON_BLOCKCHAIN.message;
    const message =
      address && blockchainName
        ? `${baseMessage}: ${address} on ${blockchainName}`
        : address
          ? `${baseMessage}: ${address}`
          : baseMessage;
    throw new BadRequestException({
      ...UserContractsErrors.CONTRACT_NOT_ON_BLOCKCHAIN,
      message,
    });
  },

  // Conflict Errors (409)
  throwContractAlreadyExists: (address?: string, blockchainName?: string) => {
    const baseMessage = UserContractsErrors.CONTRACT_ALREADY_EXISTS.message;
    const message =
      address && blockchainName
        ? `${baseMessage}: ${address} on ${blockchainName}`
        : address
          ? `${baseMessage}: ${address}`
          : baseMessage;
    throw new ConflictException({
      ...UserContractsErrors.CONTRACT_ALREADY_EXISTS,
      message,
    });
  },

  // Forbidden Errors (403)
  throwUnauthorizedAccess: (userId?: string, contractId?: string) => {
    const message =
      userId && contractId
        ? `User '${userId}' not authorized to access contract '${contractId}'`
        : UserContractsErrors.UNAUTHORIZED_ACCESS.message;
    throw new ForbiddenException({
      ...UserContractsErrors.UNAUTHORIZED_ACCESS,
      message,
    });
  },

  // InternalServerError Errors (500)
  throwEnrichmentFailed: (details?: string) => {
    const message = details
      ? `${UserContractsErrors.ENRICHMENT_FAILED.message}: ${details}`
      : UserContractsErrors.ENRICHMENT_FAILED.message;
    throw new InternalServerErrorException({
      ...UserContractsErrors.ENRICHMENT_FAILED,
      message,
    });
  },

  throwBytecodeCreationFailed: (details?: string) => {
    const message = details
      ? `${UserContractsErrors.BYTECODE_CREATION_FAILED.message}: ${details}`
      : UserContractsErrors.BYTECODE_CREATION_FAILED.message;
    throw new InternalServerErrorException({
      ...UserContractsErrors.BYTECODE_CREATION_FAILED,
      message,
    });
  },

  throwContractEntityCreationFailed: (details?: string) => {
    const message = details
      ? `${UserContractsErrors.CONTRACT_ENTITY_CREATION_FAILED.message}: ${details}`
      : UserContractsErrors.CONTRACT_ENTITY_CREATION_FAILED.message;
    throw new InternalServerErrorException({
      ...UserContractsErrors.CONTRACT_ENTITY_CREATION_FAILED,
      message,
    });
  },
};
