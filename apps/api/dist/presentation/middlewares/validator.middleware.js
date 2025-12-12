import { z } from 'zod';
export const validateRequest = (schema) => {
    return async (req, res, next) => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            return next();
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    error: 'VALIDATION_ERROR',
                    details: error.errors,
                });
            }
            return next(error);
        }
    };
};
