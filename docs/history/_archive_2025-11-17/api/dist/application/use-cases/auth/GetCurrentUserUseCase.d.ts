import { IUseCase } from '@/shared/interfaces/IUseCase';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { User } from '@prisma/client';
interface IGetCurrentUserDTO {
    userId: string;
}
type CurrentUser = Omit<User, 'passwordHash'>;
export declare class GetCurrentUserUseCase implements IUseCase<IGetCurrentUserDTO, CurrentUser> {
    private readonly userRepository;
    constructor(userRepository: IUserRepository);
    execute({ userId }: IGetCurrentUserDTO): Promise<CurrentUser>;
}
export {};
//# sourceMappingURL=GetCurrentUserUseCase.d.ts.map