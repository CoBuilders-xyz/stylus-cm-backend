import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
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

  @Column({})
  arbWasmCacheAddress: string;

  @Column({ unique: true })
  chainId: number;

  @Column('jsonb', { nullable: true }) // Flexible field for extra metadata
  otherInfo: Record<string, any>;

  @Column({ default: 0 })
  lastSyncedBlock: number;

  @Column({ default: 0 })
  lastProcessedBlockNumber: number;
}
