import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { ContractBytecode } from './contract-bytecode.entity';
// import { Alert } from './alert.entity';

@Entity()
@Index(['blockchain'], { unique: true })
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Blockchain, {
    onDelete: 'CASCADE',
  })
  blockchain: Blockchain;

  @ManyToOne(() => ContractBytecode, {
    onDelete: 'CASCADE',
  })
  contractBytecode: ContractBytecode;

  @Column()
  address: string;
}
