import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Blockchain } from './blockchain.entity';

@Entity()
@Index(['blockchain', 'eventName']) // Optimized for event type searches
@Index(['blockchain', 'blockTimestamp']) // Optimized for recent events
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

  @Column('jsonb')
  eventData: Record<string, any>; // Flexible JSONB storage for different event types
}
