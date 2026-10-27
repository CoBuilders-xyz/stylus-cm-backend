import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { Exclude } from 'class-transformer';

/**
 * Provider URLs embed the provider API key in the path. They must never be
 * sent over HTTP. `@Exclude({ toPlainOnly: true })` makes the global
 * ClassSerializerInterceptor (see app.setup.ts) drop them from every
 * response, including nested `blockchain` relations. JSON.stringify ignores
 * class-transformer metadata, so BullMQ job payloads and TypeORM still carry
 * the full entity.
 */
@Entity()
export class Blockchain {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Exclude({ toPlainOnly: true })
  @Column()
  rpcUrl: string;

  @Exclude({ toPlainOnly: true })
  @Column()
  fastSyncRpcUrl: string;

  @Exclude({ toPlainOnly: true })
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

/** Columns that hold provider credentials. Keep in sync with the @Exclude()s above. */
export type BlockchainSecretColumn = 'rpcUrl' | 'fastSyncRpcUrl' | 'rpcWssUrl';

/** A Blockchain as the HTTP API may expose it. */
export type PublicBlockchain = Omit<Blockchain, BlockchainSecretColumn>;

/**
 * Column allowlist for public queries. Typed as a Record so that adding a
 * column to the entity does not compile until it is listed here or in
 * BlockchainSecretColumn.
 */
export const PUBLIC_BLOCKCHAIN_SELECT: Record<keyof PublicBlockchain, true> = {
  id: true,
  name: true,
  cacheManagerAddress: true,
  cacheManagerAutomationAddress: true,
  arbWasmCacheAddress: true,
  arbWasmAddress: true,
  chainId: true,
  originBlock: true,
  lastSyncedBlock: true,
  lastProcessedBlockNumber: true,
  enabled: true,
};
