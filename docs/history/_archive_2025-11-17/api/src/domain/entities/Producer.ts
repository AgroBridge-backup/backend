import { User } from './User';

export interface Producer {
  id: string;
  userId: string;
  user: User;
  businessName: string;
  rfc: string;
  state: string;
  municipality: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  totalHectares?: number | null;
  cropTypes: string[];
  isWhitelisted: boolean;
  whitelistedAt?: Date | null;
  whitelistedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
