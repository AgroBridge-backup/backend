import { NotFoundError } from '@/shared/errors/NotFoundError';
export class GetCurrentUserUseCase {
    userRepository;
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async execute({ userId }) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found.');
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { passwordHash, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }
}
//# sourceMappingURL=GetCurrentUserUseCase.js.map