import { User } from "./User.js";

export interface Producer {
  id: string;
  userId: string;
  businessName: string;
  rfc: string;
  state: string;
  municipality: string;
  latitude: number;
  longitude: number;
  isWhitelisted: boolean;
  whitelistedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user?: User; // Optional, for eager loading
}
