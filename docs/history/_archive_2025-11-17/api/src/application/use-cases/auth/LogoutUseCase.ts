import { IUseCase } from '@/shared/interfaces/IUseCase';
import { RedisClient } from '@/infrastructure/cache/RedisClient';

interface ILogoutDTO {
  jti: string;
  exp: number;
}

export class LogoutUseCase implements IUseCase<ILogoutDTO, void> {
  private readonly redisClient: RedisClient;

  constructor(redisClient: RedisClient) {
    this.redisClient = redisClient;
  }

  public async execute({ jti, exp }: ILogoutDTO): Promise<void> {
    await this.redisClient.blacklistToken(jti, exp);
  }
}
