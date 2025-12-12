/**
 * Clase de error personalizada para representar tokens de autenticación inválidos o malformados.
 *
 * @remarks
 * Este error debe ser lanzado cuando un token JWT no puede ser verificado, está expirado,
 * ha sido revocado (ej. está en una blacklist), o su firma no es válida.
 *
 * Su propósito es centralizar los fallos de autenticación por token en un tipo de error único,
 * permitiendo que un middleware de manejo de errores global (errorHandler) lo capture
 * y devuelva una respuesta HTTP 401 Unauthorized estandarizada y segura, sin filtrar
 * detalles internos de la implementación.
 */
export class InvalidTokenError extends Error {
    constructor(message) {
        super(message);
        /**
         * El nombre del error, útil para identificar el tipo de error en bloques catch.
         */
        this.name = 'InvalidTokenError';
    }
}
// -----------------------------------------------------------------------------
// Guía de Integración y Mejores Prácticas para el Desarrollador
// -----------------------------------------------------------------------------
/*
 * --- 1. EJEMPLO DE IMPORTACIÓN ---
 *
 * En cualquier archivo que necesite lanzar este error (ej. tu middleware de autenticación),
 * impórtalo de la siguiente manera, usando rutas relativas o alias de TypeScript:
 *
 * import { InvalidTokenError } from '../shared/errors/InvalidTokenError';
 *
 *
 * --- 2. USO EN EL FLUJO DE AUTENTICACIÓN JWT ---
 *
 * Lanza este error dentro de tu middleware de autenticación (ej. `auth.middleware.ts`)
 * cuando la validación del token falle por cualquier motivo.
 *
 * Ejemplo en un middleware:
 *
 * try {
 *   const payload = jwt.verify(token, JWT_PUBLIC_KEY);
 *   // ...
 * } catch (error) {
 *   // Si jwt.verify falla, lanza nuestro error personalizado.
 *   throw new InvalidTokenError('Token verification failed');
 * }
 *
 * const isBlacklisted = await redisClient.isBlacklisted(payload.jti);
 * if (isBlacklisted) {
 *   throw new InvalidTokenError('Token has been revoked');
 * }
 *
 *
 * --- 3. RECOMENDACIONES Y MEJORES PRÁCTICAS ---
 *
 * a) Crea una Clase Base de Errores: Considera crear una clase base `AppError` que extienda `Error`
 *    y que incluya propiedades adicionales como `statusCode`. `InvalidTokenError` y otros errores
 *    personalizados (ej. `NotFoundError`, `ValidationError`) pueden extender `AppError`.
 *
 * b) Middleware Global de Errores: Asegúrate de tener un middleware global al final de tu cadena
 *    de middlewares en `app.ts` que capture todos los errores. Este middleware debe identificar
 *    el tipo de error (ej. `error instanceof InvalidTokenError`) y enviar la respuesta HTTP
 *    adecuada (ej. 401 para InvalidTokenError, 404 para NotFoundError, etc.).
 *
 * c) No Fuga de Detalles: El mensaje del error (`'Token verification failed'`) es para logging interno.
 *    El middleware global de errores debe enviar al cliente un mensaje genérico y seguro como
 *    `{ "error": "Unauthorized", "message": "Authentication token is invalid or has expired." }`.
 *
 */
