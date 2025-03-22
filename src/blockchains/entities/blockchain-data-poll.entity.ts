import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Blockchain } from './blockchain.entity';

@Entity()
export class BlockchainDataPoll {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Blockchain, (blockchain) => blockchain.id, {
    onDelete: 'CASCADE',
  })
  blockchain: Blockchain;

  @Column({ type: 'bigint' })
  minBid: string;

  @Column({ type: 'bigint' })
  decayRate: string;

  @Column({ type: 'bigint' })
  cacheSize: string;

  @Column({ type: 'bigint' })
  queueSize: string;

  @Column({ type: 'boolean' })
  isPaused: boolean;

  @Column({ type: 'bigint', nullable: true })
  totalContractsCached: string;

  @Column({ type: 'bigint', nullable: true })
  blockNumber: number;

  @Column({ type: 'timestamp' })
  blockTimestamp: Date;

  @CreateDateColumn()
  timestamp: Date;
}
