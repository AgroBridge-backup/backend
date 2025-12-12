import { User } from '@/domain/entities/User';
export interface IUserRepository {
    findByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
}
//# sourceMappingURL=IUserRepository.d.ts.map