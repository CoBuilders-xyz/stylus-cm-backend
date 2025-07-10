import { ethers } from 'ethers';
import { createContextLogger } from '../../common/utils/logger.util';
import { MODULE_NAME } from '../constants/module.constants';
import { EthersEvent } from '../shared';

const logger = createContextLogger('EventParser', MODULE_NAME);

/**
 * Safely extracts transaction hash from an ethers event
 */
export function getTransactionHash(event: EthersEvent): string {
  // First try ethers v6 style properties
  if ('transactionHash' in event && typeof event.transactionHash === 'string') {
    return event.transactionHash;
  }

  // Then try ethers v5 (with safe type handling)
  try {
    const eventAsAny = event as unknown;
    const record = eventAsAny as Record<string, unknown>;
    if (record && 'hash' in record && typeof record.hash === 'string') {
      return record.hash;
    }
  } catch {
    // Silently handle any errors in type conversion
  }

  logger.warn(
    `Could not extract transaction hash from event at block ${event.blockNumber}`,
  );
  return '';
}

/**
 * Safely extracts log index from an ethers event
 */
export function getLogIndex(event: EthersEvent): number {
  // First try ethers v6 style
  if ('logIndex' in event && typeof event.logIndex === 'number') {
    return event.logIndex;
  }

  // Then try ethers v5 (with safe type handling)
  try {
    const eventAsAny = event as unknown;
    const record = eventAsAny as Record<string, unknown>;
    if (record && 'index' in record && typeof record.index === 'number') {
      return record.index;
    }
  } catch {
    // Silently handle any errors in type conversion
  }

  logger.warn(
    `Could not extract log index from event at block ${event.blockNumber}`,
  );
  return 0;
}

/**
 * Checks if an event has fragments (indicating it's an EventLog not a Log)
 */
export function hasFragment(event: EthersEvent): event is ethers.EventLog {
  return 'fragment' in event;
}

/**
 * Checks if an event has arguments
 */
export function hasArgs(event: EthersEvent): event is ethers.EventLog {
  return 'args' in event;
}

/**
 * Safely converts BigInt values in event arguments to strings
 */
export function serializeEventArgs(args: any): Record<string, any> {
  return JSON.parse(
    JSON.stringify(args, (_, v): string | boolean | number | object | null =>
      typeof v === 'bigint' ? v.toString() : v,
    ),
  ) as Record<string, any>;
}
