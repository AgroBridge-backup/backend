import DataLoader from 'dataloader';
export function createUserLoader(prisma) {
    return new DataLoader(async (ids) => {
        const users = await prisma.user.findMany({
            where: {
                id: {
                    in: ids,
                },
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                walletAddress: true,
                lastLoginAt: true,
                twoFactorEnabled: true,
                twoFactorEnabledAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        const userMap = new Map();
        users.forEach((user) => {
            userMap.set(user.id, user);
        });
        return ids.map((id) => userMap.get(id) || null);
    }, { cache: true, maxBatchSize: 100 });
}
export function createUserByEmailLoader(prisma) {
    return new DataLoader(async (emails) => {
        const users = await prisma.user.findMany({
            where: {
                email: {
                    in: emails,
                },
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                walletAddress: true,
                lastLoginAt: true,
                twoFactorEnabled: true,
                twoFactorEnabledAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        const userMap = new Map();
        users.forEach((user) => {
            userMap.set(user.email, user);
        });
        return emails.map((email) => userMap.get(email) || null);
    }, { cache: true, maxBatchSize: 100 });
}
