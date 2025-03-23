import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  Index,
  Unique,
} from 'typeorm';
import { Blockchain } from './blockchain.entity';

@Entity()
@Index(['blockchain', 'eventName']) // Optimized for event type searches
@Index(['blockchain', 'blockTimestamp']) // Optimized for recent events
@Unique(['transactionHash', 'logIndex', 'blockchain', 'eventName']) // Ensure no duplicate events
export class BlockchainEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Blockchain, (blockchain) => blockchain.events, {
    onDelete: 'CASCADE',
  })
  blockchain: Blockchain;

  @Column({ nullable: true })
  contractName: string;

  @Column({ nullable: true })
  contractAddress: string;

  @Column({ nullable: true })
  eventName: string;

  @Column({ type: 'timestamp' })
  blockTimestamp: Date;

  @Column({ type: 'bigint', nullable: true })
  blockNumber: number;

  // Add transaction hash and log index to uniquely identify events
  @Column({ nullable: false })
  transactionHash: string;

  @Column({ type: 'integer', nullable: false })
  logIndex: number;

  // Add a flag to track if this event was received in real-time or from historical sync
  @Column({ default: false })
  isRealTime: boolean;

  @Column('jsonb')
  eventData: Record<string, any>; // Flexible JSONB storage for different event types
}
