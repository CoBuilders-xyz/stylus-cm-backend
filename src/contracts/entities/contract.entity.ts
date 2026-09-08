import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { Bytecode } from './bytecode.entity';
// import { Alert } from './alert.entity';

@Entity()
@Index(['blockchain'])
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Blockchain, {
    onDelete: 'CASCADE',
  })
  blockchain: Blockchain;

  @ManyToOne(() => Bytecode, {
    onDelete: 'CASCADE',
  })
  bytecode: Bytecode;

  @Column()
  address: string;

  @Column('varchar', { length: 78 })
  lastBid: string;

  @Column('varchar', { length: 78, default: '0' })
  bidPlusDecay: string;

  @Column('varchar', { length: 78, default: '0' })
  totalBidInvestment: string;

  @Column({ type: 'bigint', nullable: true })
  bidBlockNumber: number;

  @Column({ type: 'timestamp', nullable: true })
  bidBlockTimestamp: Date;

  @Column({ default: false })
  isAutomated: boolean;

  @Column('varchar', { length: 78, default: '0' })
  maxBid: string;

  // CMA v2.0: mirrors ContractConfig.biddingEnabled (automated bidding only).
  // Kept in sync by the ContractBiddingEnabledUpdated event.
  @Column({ default: false })
  biddingEnabled: boolean;

  @Column({ default: false })
  autoActivate: boolean;

  @Column('varchar', { length: 78, nullable: true })
  maxActivationCost: string;

  @Column({ type: 'bigint', nullable: true })
  lastActivationBlockNumber: number;

  @Column({ type: 'timestamp', nullable: true })
  lastActivationTimestamp: Date;

  @Column({ type: 'varchar', nullable: true, default: 'unknown' })
  activationStatus: string;

  @Column({ type: 'int', default: 0 })
  activationRetryCount: number;
}
