import { Logger } from '@nestjs/common';
import { ethers } from 'ethers';

const logger = new Logger('ContractCallUtil');

/**
 * Options for safe contract calls
 */
export interface SafeContractCallOptions {
  retries?: number;
  retryDelay?: number;
  fallbackValue?: any;
  logErrors?: boolean;
}

/**
 * Default options for safe contract calls
 */
const DEFAULT_OPTIONS: SafeContractCallOptions = {
  retries: 3,
  retryDelay: 1000,
  logErrors: true,
};

/**
 * Gets a safe string representation of the contract address
 */
function getContractAddressString(contract: ethers.Contract): string {
  try {
    return contract.target
      ? typeof contract.target === 'string'
        ? contract.target
        : JSON.stringify(contract.target)
      : 'unknown contract';
  } catch {
    return 'unknown contract';
  }
}

/**
 * Safely calls a contract method with retries and proper error handling
 * @param contract The ethers contract instance
 * @param methodName The name of the method to call
 * @param args Arguments to pass to the method
 * @param options Call options including retries and fallbacks
 * @returns The result of the contract call or the fallback value
 */
export async function safeContractCall<T = any>(
  contract: ethers.Contract,
  methodName: string,
  args: any[] = [],
  options: SafeContractCallOptions = {},
): Promise<T | undefined> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;
  const contractAddress = getContractAddressString(contract);

  for (let attempt = 0; attempt <= opts.retries!; attempt++) {
    try {
      // Make the contract call
      return (await contract[methodName](...args)) as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Log the error if configured to do so
      if (opts.logErrors) {
        logger.error(
          `Error calling ${methodName} on contract ${contractAddress} (attempt ${attempt + 1}/${opts.retries! + 1}): ${lastError.message}`,
        );
      }

      // If we've exhausted retries, break out of the loop
      if (attempt >= opts.retries!) {
        break;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, opts.retryDelay));
    }
  }

  // Return fallback value if provided
  if ('fallbackValue' in opts) {
    if (opts.logErrors) {
      logger.warn(
        `Using fallback value for ${methodName} on contract ${contractAddress} after ${opts.retries! + 1} failed attempts`,
      );
    }
    return opts.fallbackValue as T;
  }

  // Re-throw the last error if no fallback provided
  if (!lastError) {
    // This should never happen, but just in case
    throw new Error(
      `Unknown error calling ${methodName} on contract ${contractAddress}`,
    );
  }
  throw lastError;
}
