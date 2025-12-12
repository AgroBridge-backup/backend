const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger.js');

const router = express.Router();

// ==================== MIDDLEWARE DE PROTECCIÓN CSRF ====================
const verifyCsrfToken = (req, res, next) => {
    const csrfTokenHeader = req.headers['x-csrf-token'];
    const csrfTokenCookie = req.cookies['csrf-token'];

    if (
        !csrfTokenHeader ||
        !csrfTokenCookie ||
        csrfTokenHeader !== csrfTokenCookie
    ) {
        logger.warn('Invalid CSRF token', { ip: req.ip, path: req.path });
        return res
            .status(403)
            .json({
                success: false,
                message: 'Acceso prohibido: Token CSRF inválido.',
            });
    }
    next();
};

// ==================== LIMITACIÓN DE TASA (RATE LIMITING) ====================
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 50, // Limita cada IP a 50 peticiones por ventana
    standardHeaders: true,
    legacyHeaders: false,
});

const loteRegistrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 100,
    message:
        'Demasiadas peticiones de registro de lote desde esta IP, por favor intente de nuevo en una hora',
});

// ==================== RUTAS DE LA API ====================

// Health Check
router.get('/health', (req, res) => {
    res.status(200).json({ success: true, status: 'UP' });
});

// Endpoint seguro para obtener token CSRF
router.get('/security/csrf-token', (req, res) => {
    const csrfToken = crypto.randomBytes(32).toString('hex');

    res.cookie('csrf-token', csrfToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3600000, // 1 hora
    });

    res.status(200).json({
        success: true,
        csrfToken: csrfToken,
    });
});

// Validación de Trazabilidad (protegido con rate limiting)
router.post('/trace/validate', strictLimiter, async (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res
            .status(400)
            .json({ success: false, message: 'El ID del lote es requerido.' });
    }

    const result = await req.agroBridgeAPI.findLoteById(id);

    const statusCode = result.success
        ? 200
        : result.status === 'NOT_FOUND'
          ? 404
          : 500;

    res.status(statusCode).json(result);
});

// Ruta de Contacto (protegida con CSRF)
// El bloque try/catch ya no es necesario aquí si se usa express-async-errors
router.post('/contact', strictLimiter, verifyCsrfToken, async (req, res) => {
    const { company_name, company_email, company_interest } = req.body;

    if (!company_name || !company_email || !company_interest) {
        return res
            .status(400)
            .json({
                success: false,
                message: 'Todos los campos son requeridos',
            });
    }

    // Aquí iría la lógica para guardar en base de datos o enviar email
    logger.info('New contact request received', { company: company_name });

    res.status(200).json({
        success: true,
        data: { message: 'Solicitud recibida exitosamente' },
    });
});

const { protect, authorize } = require('../middleware/auth.js');

// ... (código existente)

// Registrar un nuevo lote (protegido)
router.post(
    '/lotes/register',
    protect,
    authorize('producer'),
    loteRegistrationLimiter,
    verifyCsrfToken,
    async (req, res) => {
        // Lógica para registrar un nuevo lote
        logger.info('Solicitud de registro de lote por usuario', {
            userId: req.user.id,
        });
        res.status(201).json({
            success: true,
            message: 'Lote registrado exitosamente.',
        });
    }
);

// Sellar un lote (protegido)
router.post(
    '/lotes/seal',
    protect,
    authorize('producer', 'admin'),
    strictLimiter,
    verifyCsrfToken,
    async (req, res) => {
        // Lógica para sellar un lote en la blockchain
        logger.info('Solicitud de sellado de lote por usuario', {
            userId: req.user.id,
        });
        res.status(200).json({
            success: true,
            message: 'Lote sellado exitosamente.',
        });
    }
);

module.exports = router;
