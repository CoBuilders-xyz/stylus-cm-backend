import { Blockchain } from '../../../blockchains/entities/blockchain.entity';

export interface ReconnectionCallbacks {
  setupEventListeners: (
    blockchain: Blockchain,
    eventTypes: string[],
  ) => Promise<void>;
  clearActiveListener: (blockchainId: string) => void;
}
