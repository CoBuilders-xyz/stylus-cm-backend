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
@Index(['blockchain', 'address'], { unique: true })
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // @ManyToOne(() => User, (user) => user.contracts, { onDelete: 'CASCADE' })
  // user: User;

  @ManyToOne(() => Blockchain, (blockchain) => blockchain.contracts, {
    onDelete: 'CASCADE',
  })
  blockchain: Blockchain;

  @Column()
  name: string;

  @Column()
  address: string;

  @Column()
  bytecodeHash: string;

  @Column()
  size: number;

  @Column('decimal', { precision: 18, scale: 6 })
  maxBid: number;

  // @OneToMany(() => Alert, (alert) => alert.contract)
  // alerts: Alert[];
}
