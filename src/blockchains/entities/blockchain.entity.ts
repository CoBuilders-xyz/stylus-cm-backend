import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
@Entity()
export class Blockchain {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  rpcUrl: string;

  @Column()
  fastSyncRpcUrl: string;

  @Column()
  rpcWssUrl: string;

  @Column()
  cacheManagerAddress: string;

  @Column({ nullable: true })
  cacheManagerAutomationAddress: string;

  @Column()
  arbWasmCacheAddress: string;

  @Column()
  arbWasmAddress: string;

  @Column({ unique: true })
  chainId: number;

  @Column({ default: 0 })
  originBlock: number;

  @Column({ default: 0 })
  lastSyncedBlock: number;

  @Column({ default: 0 })
  lastProcessedBlockNumber: number;

  @Column({ default: true })
  enabled: boolean;
}
