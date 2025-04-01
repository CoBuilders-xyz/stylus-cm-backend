import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Blockchain } from './blockchain.entity';

@Entity()
export class BlockchainState {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Blockchain, {
    onDelete: 'CASCADE',
  })
  blockchain: Blockchain;

  @Column('varchar', { length: 78, default: '0', nullable: true })
  minBid: string;

  @Column('varchar', { length: 78, default: '0', nullable: true })
  decayRate: string;

  @Column('varchar', { length: 78, default: '0', nullable: true })
  cacheSize: string;

  @Column('varchar', { length: 78, default: '0', nullable: true })
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
