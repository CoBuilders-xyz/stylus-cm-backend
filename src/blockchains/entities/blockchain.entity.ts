import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
@Entity()
export class Blockchain {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  rpcUrl: string;

  @Column({ nullable: true })
  fastSyncRpcUrl: string;

  @Column({ nullable: true })
  rpcWssUrl: string;

  @Column({})
  cacheManagerAddress: string;

  @Column({})
  cacheManagerAutomationAddress: string;

  @Column({})
  arbWasmCacheAddress: string;

  @Column({})
  arbWasmAddress: string;

  @Column({ unique: true })
  chainId: number;

  @Column({ default: 0 })
  originBlock: number;

  @Column('jsonb', { nullable: true }) // Flexible field for extra metadata
  otherInfo: Record<string, any>;

  @Column({ default: 0 })
  lastSyncedBlock: number;

  @Column({ default: 0 })
  lastProcessedBlockNumber: number;
}
