import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  // OneToMany,
  Index,
} from 'typeorm';
// import { User } from '../../users/entities/user.entity';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
// import { Alert } from './alert.entity';

@Entity()
@Index(['blockchain', 'bytecodeHash'], { unique: true })
export class ContractBytecode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // @ManyToOne(() => User, (user) => user.contracts, { onDelete: 'CASCADE' })
  // user: User;

  @ManyToOne(() => Blockchain, (blockchain) => blockchain.contracts, {
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
