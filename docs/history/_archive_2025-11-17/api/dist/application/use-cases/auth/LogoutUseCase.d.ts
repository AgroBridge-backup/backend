import { IUseCase } from '@/shared/interfaces/IUseCase';
import { RedisClient } from '@/infrastructure/cache/RedisClient';
interface ILogoutDTO {
    jti: string;
    exp: number;
}
export declare class LogoutUseCase implements IUseCase<ILogoutDTO, void> {
    private readonly redisClient;
    constructor(redisClient: RedisClient);
    execute({ jti, exp }: ILogoutDTO): Promise<void>;
}
export {};
//# sourceMappingURL=LogoutUseCase.d.ts.map