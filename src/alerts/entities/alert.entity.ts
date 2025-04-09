import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { UserContract } from 'src/user-contracts/entities/user-contract.entity';

export enum AlertType {
  EVICTION = 'eviction',
  NO_GAS = 'noGas',
  LOW_GAS = 'lowGas',
  BID_SAFETY = 'bidSafety',
}

@Entity()
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: AlertType })
  type: AlertType;

  @Column({ nullable: true })
  value: string;

  @Column()
  isActive: boolean;

  @Column({ nullable: true })
  lastTriggered: Date;

  @Column({ default: 0 })
  triggeredCount: number;

  @ManyToOne(() => UserContract, { nullable: true })
  userContract: UserContract;

  @ManyToOne(() => User)
  user: User;

  @Column({ default: false })
  emailChannelEnabled: boolean;

  @Column({ default: false })
  slackChannelEnabled: boolean;

  @Column({ default: false })
  telegramChannelEnabled: boolean;

  @Column({ default: false })
  webhookChannelEnabled: boolean;
}
