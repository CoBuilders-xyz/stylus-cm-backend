import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { AlertsSettings } from '../interfaces/alerts-settings.interface';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  address: string;

  @Column({ nullable: true })
  name: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true, default: () => "'{}'" })
  alertsSettings: AlertsSettings;
}
