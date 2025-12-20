import { IUseCase } from '../../../shared/interfaces/IUseCase.js';
import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
import { User } from '../../../domain/entities/User.js';

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

    // FIXED: L-002 - Use underscore prefix pattern instead of eslint-disable
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
