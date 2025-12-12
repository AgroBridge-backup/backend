import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import db from '../core/db.js'; // <-- NUESTRO NUEVO MÓDULO DE BD

const router = express.Router();

/**
 * @route   POST /api/v2/auth/register
 * @desc    Registrar un nuevo usuario en la base de datos
 * @access  Public
 */
router.post('/register', async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({
            success: false,
            message: 'Por favor, proporcione usuario, contraseña y rol.',
        });
    }

    try {
        // Hashear la contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Crear usuario en la base de datos
        const queryText =
            'INSERT INTO users(username, password, role) VALUES($1, $2, $3) RETURNING id, username, role';
        const values = [username, hashedPassword, role];

        const { rows } = await db.query(queryText, values);
        const newUser = rows[0];

        logger.info(`Nuevo usuario registrado: ${newUser.username}`, {
            id: newUser.id,
            role: newUser.role,
        });

        res.status(201).json({
            success: true,
            message: 'Usuario registrado exitosamente.',
            user: {
                id: newUser.id,
                username: newUser.username,
                role: newUser.role,
            },
        });
    } catch (error) {
        logger.error('Error en el registro de usuario', {
            error: error.message,
        });
        if (error.code === '23505') {
            // Error de constraint unique
            return res.status(400).json({
                success: false,
                message: 'El nombre de usuario ya existe.',
            });
        }
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor.',
        });
    }
});

/**
 * @route   POST /api/v2/auth/login
 * @desc    Autenticar un usuario y obtener un token JWT
 * @access  Public
 */
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'Por favor, proporcione usuario y contraseña.',
        });
    }

    try {
        // Buscar usuario en la base de datos
        const queryText = 'SELECT * FROM users WHERE username = $1';
        const { rows } = await db.query(queryText, [username]);
        const user = rows[0];

        if (!user) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas.' });
        }

        // Comparar contraseñas
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas.' });
        }

        // Crear el payload del token
        const payload = {
            id: user.id,
            username: user.username,
            role: user.role,
        };

        // Firmar el token
        const token = jwt.sign(payload, config.JWT_SECRET, {
            expiresIn: config.JWT_EXPIRES_IN,
        });

        logger.info(`Usuario autenticado: ${user.username}`, { id: user.id });

        res.status(200).json({
            success: true,
            message: 'Login exitoso.',
            token: `Bearer ${token}`,
        });
    } catch (error) {
        logger.error('Error en el login de usuario', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor.',
        });
    }
});

export default router;
