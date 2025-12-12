import { IUseCase } from '@/shared/interfaces/IUseCase';
import { IRefreshTokenRepository } from '@/domain/repositories/IRefreshTokenRepository';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { RefreshTokenRequestDto, RefreshTokenResponseDto } from '@/application/dtos/auth.dtos';
export declare class RefreshTokenUseCase implements IUseCase<RefreshTokenRequestDto, RefreshTokenResponseDto> {
    private readonly refreshTokenRepository;
    private readonly userRepository;
    constructor(refreshTokenRepository: IRefreshTokenRepository, userRepository: IUserRepository);
    execute(dto: RefreshTokenRequestDto): Promise<RefreshTokenResponseDto>;
    private generateAccessToken;
    private generateRefreshToken;
}
//# sourceMappingURL=RefreshTokenUseCase.d.ts.map