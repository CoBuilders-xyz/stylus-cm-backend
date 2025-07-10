import { Blockchain } from '../../../blockchains/entities/blockchain.entity';

export interface BlockchainConfig {
  blockchain: Blockchain;
  eventTypes: string[];
}
