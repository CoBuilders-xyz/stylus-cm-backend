import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
@Entity()
@Index(['blockchain', 'bytecodeHash'], { unique: true })
export class ContractBytecode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Blockchain, {
    onDelete: 'CASCADE',
  })
  blockchain: Blockchain;

  @Column()
  bytecodeHash: string;

  @Column()
  size: number;

  @Column('decimal', { precision: 18, scale: 6 })
  lastBid: number;

  @Column('decimal', { precision: 18, scale: 6, default: 0 })
  bidPlusDecay: number;

  @Column('decimal', { precision: 18, scale: 6, default: 0, nullable: true })
  lastEvictionBid: number;

  @Column({ default: false })
  isCached: boolean;

  @Column('decimal', { precision: 18, scale: 6, default: 0 })
  totalBidInvestment: number;
}
