import { IUseCase } from '@/shared/interfaces/IUseCase';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { User } from '@prisma/client';
import { NotFoundError } from '@/shared/errors/NotFoundError';

interface IGetCurrentUserDTO {
  userId: string;
}

// Return type excludes password hash for security
type CurrentUser = Omit<User, 'passwordHash'>;

export class GetCurrentUserUseCase implements IUseCase<IGetCurrentUserDTO, CurrentUser> {
  constructor(private readonly userRepository: IUserRepository) {}

  public async execute({ userId }: IGetCurrentUserDTO): Promise<CurrentUser> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('User not found.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
