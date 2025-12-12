const express = require('express');
const { protect, authorize } = require('../middleware/auth.js');
const logger = require('../utils/logger');

const router = express.Router();

// Proteger todas las rutas en este archivo
router.use(protect);

/**
 * @route   GET /api/v2/dashboard/producer
 * @desc    Obtener datos para el dashboard del productor
 * @access  Private (Producer)
 */
router.get('/producer', authorize('producer'), (req, res) => {
    logger.info(
        `Acceso al dashboard del productor por usuario: ${req.user.username}`
    );

    // Datos simulados para el dashboard
    const mockDashboardData = {
        user: {
            username: req.user.username,
            role: req.user.role,
        },
        summary: {
            lotesActivos: 5,
            calidadPromedio: 8.9,
            proximoPago: '2025-11-15',
        },
        lotesRecientes: [
            {
                id: 'LOTE_HASS_101',
                producto: 'Aguacate Hass',
                estatus: 'Entregado',
                calidad: 9.2,
            },
            {
                id: 'LOTE_BERRY_203',
                producto: 'Arándano',
                estatus: 'En Tránsito',
                calidad: 8.8,
            },
            {
                id: 'LOTE_HASS_102',
                producto: 'Aguacate Hass',
                estatus: 'En Empaque',
                calidad: null,
            },
        ],
        tendenciaCalidad: [
            { mes: 'Agosto', calidad: 8.5 },
            { mes: 'Septiembre', calidad: 9.1 },
            { mes: 'Octubre', calidad: 8.9 },
        ],
    };

    res.json({ success: true, data: mockDashboardData });
});

module.exports = router;
