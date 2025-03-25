import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';

import { ContractBytecode } from './contract-bytecode.entity';

@Entity()
export class ContractBytecodeMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Many to one relationship with contract
  @ManyToOne(
    () => ContractBytecode,
    (contractBytecode) => contractBytecode.contractBytecodeMetric,
    {
      onDelete: 'CASCADE',
    },
  )
  contractBytecode: ContractBytecode;

  @Column()
  type: string;

  @Column('jsonb')
  metricData: Record<string, any>; // Flexible JSONB storage for different event types
}
