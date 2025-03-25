import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  Index,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { ContractBytecode } from './contract-bytecode.entity';
import { ContractMetric } from './contract-metric.entity';
// import { Alert } from './alert.entity';

@Entity()
@Index(['blockchain', 'user'], { unique: true })
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Blockchain, (blockchain) => blockchain.contracts, {
    onDelete: 'CASCADE',
  })
  blockchain: Blockchain;

  @ManyToOne(
    () => ContractBytecode,
    (contractBytecode) => contractBytecode.contracts,
    {
      onDelete: 'CASCADE',
    },
  )
  contractBytecode: ContractBytecode;

  @ManyToOne(() => User, (user) => user.contracts, { onDelete: 'CASCADE' })
  user: User;

  // Many to one relationship with contract metric
  @OneToMany(() => ContractMetric, (contractMetric) => contractMetric.contract)
  contractMetric: ContractMetric[];

  @Column()
  address: string;

  @Column({ default: false })
  isCached: boolean;

  @Column({ default: false })
  name: string;
}
