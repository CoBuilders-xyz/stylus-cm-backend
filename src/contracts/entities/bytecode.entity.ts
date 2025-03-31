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
export class Bytecode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Blockchain, {
    onDelete: 'CASCADE',
  })
  blockchain: Blockchain;

  @Column()
  bytecodeHash: string;

  @Column('varchar', { length: 78 })
  size: number;

  @Column('varchar', { length: 78 })
  lastBid: string;

  @Column('varchar', { length: 78, default: '0' })
  bidPlusDecay: string;

  @Column('varchar', { length: 78, default: '0', nullable: true })
  lastEvictionBid: string;

  @Column({ default: false })
  isCached: boolean;

  @Column('varchar', { length: 78, default: '0' })
  totalBidInvestment: string;
}
