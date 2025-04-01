import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Contract } from '../../contracts/entities/contract.entity';
import { User } from '../../users/entities/user.entity';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';

@Entity()
export class UserContract {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  address: string;

  @Column()
  name: string;

  // @Column({ nullable: true })
  // maxBid: number;

  @ManyToOne(() => Contract, { nullable: true })
  contract: Contract;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Blockchain)
  blockchain: Blockchain;
}
