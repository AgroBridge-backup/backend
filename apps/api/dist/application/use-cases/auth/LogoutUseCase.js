export class LogoutUseCase {
    redisClient;
    constructor(redisClient) {
        this.redisClient = redisClient;
    }
    async execute({ jti, exp }) {
        await this.redisClient.blacklistToken(jti, exp);
    }
}
