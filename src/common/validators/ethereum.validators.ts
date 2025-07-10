import { registerDecorator, ValidationOptions } from 'class-validator';
import { ethers } from 'ethers';

/**
 * Custom validator for Ethereum signature format validation
 * Validates that the signature follows the standard Ethereum signature format:
 * - Starts with 0x
 * - Followed by exactly 130 hexadecimal characters
 * - Total length: 132 characters (0x + 64 chars r + 64 chars s + 2 chars v)
 */
export function IsEthereumSignature(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isEthereumSignature',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;

          // Ethereum signatures are 132 characters long (0x + 130 hex chars)
          // Format: 0x + 64 chars (r) + 64 chars (s) + 2 chars (v)
          const signatureRegex = /^0x[a-fA-F0-9]{130}$/;

          if (!signatureRegex.test(value)) return false;

          // Additional validation: ensure the signature components are valid
          try {
            // Extract r, s, v components for basic validation
            const r = value.slice(2, 66);
            const s = value.slice(66, 130);
            const v = value.slice(130, 132);

            // Basic range checks
            const rBigInt = BigInt('0x' + r);
            const sBigInt = BigInt('0x' + s);
            const vInt = parseInt(v, 16);

            // r and s should not be zero
            if (rBigInt === 0n || sBigInt === 0n) return false;

            // v should be 27, 28, 0, or 1 (standard Ethereum values)
            if (![0, 1, 27, 28].includes(vInt)) return false;

            return true;
          } catch {
            return false;
          }
        },
        defaultMessage() {
          return 'Signature must be a valid Ethereum signature (0x followed by 130 hex characters with valid r, s, v components)';
        },
      },
    });
  };
}

/**
 * Custom validator for Ethereum address checksum validation
 * Validates that the address follows EIP-55 checksum format for enhanced security
 * This prevents common address typos and ensures proper case formatting
 */
export function IsChecksumAddress(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isChecksumAddress',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;

          try {
            // ethers.getAddress() validates and returns proper checksum format
            // If the address is invalid, it throws an error
            const checksumAddress = ethers.getAddress(value);

            // Verify the input matches the checksum format exactly
            // This ensures the client is sending properly formatted addresses
            return checksumAddress === value;
          } catch {
            return false;
          }
        },
        defaultMessage() {
          return 'Address must be a valid Ethereum address with proper EIP-55 checksum format';
        },
      },
    });
  };
}

/**
 * Custom validator for basic Ethereum address format
 * More lenient than checksum validation - accepts any valid hex address
 * Use this when checksum validation is too strict for your use case
 */
export function IsEthereumAddress(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isEthereumAddress',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;

          try {
            // This will validate the address format and convert to checksum
            // but we don't require the input to be in checksum format
            ethers.getAddress(value);
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage() {
          return 'Address must be a valid Ethereum address';
        },
      },
    });
  };
}
