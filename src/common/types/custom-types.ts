import { Request } from 'express';
import { User } from '../../users/entities/user.entity';

export type AuthenticatedRequest = Request & { user: User };
