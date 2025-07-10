import { AlertsSettings } from './alerts-settings.interface';

/**
 * Base user interface
 */
export interface IUser {
  id: string;
  address: string;
  isActive: boolean;
  alertsSettings: AlertsSettings;
  name?: string;
}

/**
 * User creation interface
 */
export interface CreateUserData {
  address: string;
  name?: string;
  alertsSettings?: AlertsSettings;
}

/**
 * User update interface
 */
export interface UpdateUserData {
  name?: string;
  isActive?: boolean;
  alertsSettings?: AlertsSettings;
}

/**
 * User query interface
 */
export interface UserQuery {
  id?: string;
  address?: string;
  isActive?: boolean;
}
