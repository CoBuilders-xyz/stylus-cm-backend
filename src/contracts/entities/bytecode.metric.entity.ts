import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';

import { Bytecode } from './bytecode.entity';

@Entity()
export class ContractBytecodeMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Many to one relationship with contract
  @ManyToOne(() => Bytecode, {
    onDelete: 'CASCADE',
  })
  bytecode: Bytecode;

  @Column()
  type: string;

  @Column('jsonb')
  metricData: Record<string, any>; // Flexible JSONB storage for different event types
}
