import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';

import { Contract } from './contract.entity';

@Entity()
export class ContractMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Many to one relationship with contract
  @ManyToOne(() => Contract, {
    onDelete: 'CASCADE',
  })
  contract: Contract;

  @Column()
  type: string;

  @Column('jsonb')
  metricData: Record<string, any>; // Flexible JSONB storage for different event types
}
