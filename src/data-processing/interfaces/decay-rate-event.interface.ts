/**
 * Represents a decay rate change event on the blockchain.
 * Used to track decay rate changes during event processing.
 */
export interface DecayRateEvent {
  blockNumber: number;
  logIndex: number;
  blockTimestamp: Date;
  decayRate: string; // Decimal string value of the decay rate
}
