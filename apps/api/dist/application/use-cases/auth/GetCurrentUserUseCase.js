import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
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
        // FIXED: L-002 - Use underscore prefix pattern instead of eslint-disable
        const { passwordHash: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }
}
