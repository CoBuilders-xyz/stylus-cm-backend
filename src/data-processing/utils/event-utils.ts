import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { DecayRateEvent } from '../interfaces/decay-rate-event.interface';

/**
 * Determines if an event is more recent than the last processed event.
 *
 * @param event The current event to check
 * @param lastEventBlock The block number of the last processed event
 * @returns boolean indicating if the event is more recent
 */
export function isMoreRecentEvent(
  event: BlockchainEvent,
  lastEventBlock?: number,
): boolean {
  // If we have no record of the last event, this one is more recent
  if (lastEventBlock === undefined) {
    return true;
  }

  // If the event is in a later block, it's more recent
  if (event.blockNumber > lastEventBlock) {
    return true;
  }

  // If the event is in the same block, but has a higher log index, it's more recent
  if (event.blockNumber === lastEventBlock && event.logIndex !== undefined) {
    // We don't have a logIndex for the last event, so we assume this one is more recent
    // This would be unusual but possible
    return true;
  }

  // Otherwise, this event is not more recent
  return false;
}

/**
 * Finds the applicable decay rate for a given event based on the decay rate history.
 *
 * @param event The blockchain event to find the decay rate for
 * @param decayRateEvents The history of decay rate events
 * @param currentDecayRate The current decay rate to use as a fallback
 * @returns The applicable decay rate for the event
 */
export function findApplicableDecayRate(
  event: BlockchainEvent,
  decayRateEvents: DecayRateEvent[],
  currentDecayRate: string,
): string {
  // Start with the current decay rate
  let applicableDecayRate = currentDecayRate;

  // Find the most recent decay rate event that happened before or at the same time as the given event
  for (const decayEvent of decayRateEvents) {
    // Skip decay events that happened after our target event
    if (
      decayEvent.blockNumber > event.blockNumber ||
      (decayEvent.blockNumber === event.blockNumber &&
        decayEvent.logIndex > event.logIndex)
    ) {
      continue;
    }

    // Update the applicable decay rate
    applicableDecayRate = decayEvent.decayRate;
  }

  return applicableDecayRate;
}

/**
 * Sorts decay rate events by block number and log index.
 *
 * @param events The array of decay rate events to sort
 * @returns The sorted array
 */
export function sortDecayRateEvents(
  events: DecayRateEvent[],
): DecayRateEvent[] {
  return [...events].sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) {
      return a.blockNumber - b.blockNumber;
    }
    return a.logIndex - b.logIndex;
  });
}
