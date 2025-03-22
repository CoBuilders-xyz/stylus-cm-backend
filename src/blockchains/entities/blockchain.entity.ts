import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { BlockchainEvent } from './blockchain-event.entity';
import { BlockchainMetric } from './blockchain-metric.entity';
import { Contract } from '../../contracts/entities/contract.entity';
@Entity()
export class Blockchain {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  rpcUrl: string;

  @Column({})
  cacheManagerAddress: string;

  @Column({ unique: true })
  chainId: number;

  @Column('jsonb', { nullable: true }) // Flexible field for extra metadata
  otherInfo: Record<string, any>;

  @OneToMany(() => Contract, (contract) => contract.blockchain)
  contracts: Contract[];

  @OneToMany(() => BlockchainEvent, (event) => event.blockchain)
  events: BlockchainEvent[];

  @OneToMany(() => BlockchainMetric, (metric) => metric.blockchain)
  metrics: BlockchainMetric[];
}
