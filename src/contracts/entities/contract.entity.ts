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

  @Column('varchar', { length: 78, default: '0', nullable: true })
  lastEvictionBid: string;

  @Column('varchar', { length: 78, default: '0' })
  totalBidInvestment: string;
}
