import { User } from '../entities/User.js';

export interface IUserRepository {
  findByEmail(email: string, include?: { producer?: boolean }): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}