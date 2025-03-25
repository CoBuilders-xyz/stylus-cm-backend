import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  // OneToMany,
  Index,
  OneToMany,
} from 'typeorm';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { Contract } from './contract.entity';
import { ContractBytecodeMetric } from './contract-bytecode.metric.entity';
@Entity()
@Index(['blockchain', 'bytecodeHash'], { unique: true })
export class ContractBytecode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Blockchain, (blockchain) => blockchain.contracts, {
    onDelete: 'CASCADE',
  })
  blockchain: Blockchain;

  @OneToMany(() => Contract, (contract) => contract.contractBytecode)
  contracts: Contract[];

  @OneToMany(
    () => ContractBytecodeMetric,
    (contractBytecodeMetric) => contractBytecodeMetric.contractBytecode,
  )
  contractBytecodeMetric: ContractBytecodeMetric[];

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
