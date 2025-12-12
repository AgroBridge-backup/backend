const express = require('express');
const { protect, authorize } = require('../middleware/auth.js');
const logger = require('../utils/logger');
const db = require('../core/db');

const router = express.Router();

/**
 * @route   GET /api/v2/marketplace/lots
 * @desc    Obtener todos los lotes disponibles para la venta
 * @access  Public
 */
router.get('/lots', async (req, res) => {
    try {
        const { rows } = await db.query(
            "SELECT * FROM lots WHERE status = 'available' ORDER BY created_at DESC"
        );
        res.json({ success: true, lots: rows });
    } catch (error) {
        logger.error('Error al obtener los lotes del marketplace:', {
            error: error.message,
        });
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor.',
        });
    }
});

/**
 * @route   POST /api/v2/marketplace/lots
 * @desc    Crear un nuevo lote para la venta
 * @access  Private (Producer)
 */
router.post('/lots', protect, authorize('producer'), async (req, res) => {
    const { product_type, quantity_kg, price_per_kg, origin_country_code } =
        req.body;
    const producer_id = req.user.id;

    if (
        !product_type ||
        !quantity_kg ||
        !price_per_kg ||
        !origin_country_code
    ) {
        return res
            .status(400)
            .json({
                success: false,
                message: 'Todos los campos son requeridos.',
            });
    }

    try {
        const queryText =
            'INSERT INTO lots(producer_id, product_type, quantity_kg, price_per_kg, origin_country_code) VALUES($1, $2, $3, $4, $5) RETURNING *';
        const values = [
            producer_id,
            product_type,
            quantity_kg,
            price_per_kg,
            origin_country_code,
        ];
        const { rows } = await db.query(queryText, values);
        res.status(201).json({ success: true, lot: rows[0] });
    } catch (error) {
        logger.error('Error al crear el lote:', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor.',
        });
    }
});

/**
 * @route   POST /api/v2/marketplace/orders
 * @desc    Crear un pedido para un lote
 * @access  Private (Buyer)
 */
router.post('/orders', protect, authorize('buyer'), async (req, res) => {
    const { lot_id, quantity_kg } = req.body;
    const buyer_id = req.user.id;

    if (!lot_id || !quantity_kg) {
        return res
            .status(400)
            .json({
                success: false,
                message: 'El ID del lote y la cantidad son requeridos.',
            });
    }

    // En una implementación real, esto sería una transacción de base de datos
    // para asegurar la atomicidad (verificar disponibilidad, crear pedido, actualizar lote).
    try {
        // 1. Obtener el precio del lote
        const lotResult = await db.query(
            "SELECT price_per_kg, quantity_kg FROM lots WHERE id = $1 AND status = 'available'",
            [lot_id]
        );
        const lot = lotResult.rows[0];

        if (!lot) {
            return res
                .status(404)
                .json({
                    success: false,
                    message: 'Lote no encontrado o no disponible.',
                });
        }
        if (quantity_kg > lot.quantity_kg) {
            return res
                .status(400)
                .json({
                    success: false,
                    message: 'La cantidad solicitada excede la disponible.',
                });
        }

        // 2. Crear el pedido
        const total_price = quantity_kg * lot.price_per_kg;
        const orderQuery =
            'INSERT INTO orders(lot_id, buyer_id, quantity_kg, total_price) VALUES($1, $2, $3, $4) RETURNING *';
        const orderValues = [lot_id, buyer_id, quantity_kg, total_price];
        const { rows } = await db.query(orderQuery, orderValues);

        // 3. (Simulado) Actualizar la cantidad del lote o marcarlo como vendido

        res.status(201).json({ success: true, order: rows[0] });
    } catch (error) {
        logger.error('Error al crear el pedido:', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor.',
        });
    }
});

module.exports = router;
