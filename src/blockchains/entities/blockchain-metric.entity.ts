import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { Blockchain } from './blockchain.entity';

@Entity()
@Index(['blockchain', 'timestamp']) // Optimized for time-series queries
export class BlockchainMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Blockchain, (blockchain) => blockchain.metrics, {
    onDelete: 'CASCADE',
  })
  blockchain: Blockchain;

  @CreateDateColumn()
  timestamp: Date;

  @Column()
  cacheUsage: number;

  @Column()
  availableCacheSpace: number;

  @Column()
  totalBids: number;

  @Column()
  totalContractsCached: number;
}
