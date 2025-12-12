import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { IRefreshTokenRepository } from '@/domain/repositories/IRefreshTokenRepository';
import { LoginRequestDto, LoginResponseDto } from '@/application/dtos/auth.dtos';
export declare class LoginUseCase {
    private readonly userRepository;
    private readonly refreshTokenRepository;
    constructor(userRepository: IUserRepository, refreshTokenRepository: IRefreshTokenRepository);
    execute(dto: LoginRequestDto): Promise<LoginResponseDto>;
    private generateAccessToken;
    private generateRefreshToken;
}
//# sourceMappingURL=LoginUseCase.d.ts.map