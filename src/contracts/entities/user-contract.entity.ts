import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Contract } from './contract.entity';
import { User } from '../../users/entities/user.entity';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';

@Entity()
export class UserContract {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  address: string;

  @Column({ nullable: true })
  name: string;

  @ManyToOne(() => Contract, { nullable: true })
  contract: Contract;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Blockchain, { onDelete: 'CASCADE' })
  blockchain: Blockchain;
}
