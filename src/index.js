import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import config from './config/config.js'; // Usar archivo de config central
import logger from './utils/logger.js';
import AgroBridgeAPI from './core/api.js';
import apiRouter from './routes/api.js';
import authRouter from './routes/auth.js';
import languageRouter from './routes/language.js';
import dashboardRouter from './routes/dashboard.js';
import newsRouter from './routes/news.js';
import marketplaceRouter from './routes/marketplace.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// ==================== CONFIGURACIÓN DE SEGURIDAD ====================
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"], // Permitir estilos en línea para GSAP
                imgSrc: ["'self'", 'data:', 'https:'], // Permitir imágenes de data: y https:
                connectSrc: ["'self'", 'https://api.agrobridge.global'], // Permitir conexiones a nuestra API
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'none'"],
                upgradeInsecureRequests: [],
            },
        },
        strictTransportSecurity: {
            maxAge: 31536000, // 1 año en segundos
            includeSubDomains: true,
            preload: true,
        },
    })
);

const whitelist = config.CORS_WHITELIST.split(',');
const corsOptions = {
    origin: function (origin, callback) {
        if (whitelist.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
};
app.use(cors(corsOptions));

app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

app.set('trust proxy', 1);

// ==================== SERVIR ARCHIVOS ESTÁTICOS ====================
if (config.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../dist')));
} else {
    app.use(express.static(path.join(__dirname, '../public_html')));
}

// ==================== INICIALIZACIÓN DE LA API ====================
const agroBridgeAPI = new AgroBridgeAPI();
app.use((req, res, next) => {
    req.agroBridgeAPI = agroBridgeAPI;
    next();
});

// ==================== RUTAS DE LA API ====================
app.use('/api/v2/auth', authRouter);
app.use('/api/v2', apiRouter);
app.use('/api/v2/language', languageRouter);
app.use('/api/v2/dashboard', dashboardRouter);
app.use('/api/v2/news', newsRouter);
app.use('/api/v2/marketplace', marketplaceRouter);

// Middleware de manejo de errores (debe ser el último)
app.use(errorHandler);

// ==================== MANEJO DE ERRORES Y 404 ====================
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Ruta de API no encontrada',
    });
});

app.get('* ', (req, res) => {
    res.sendFile(path.join(__dirname, '../public_html/index.html'));
});

// ==================== INICIO DEL SERVIDOR ====================

const server = app.listen(config.PORT, () => {
    logger.info(
        `Servidor corriendo en modo ${config.NODE_ENV} en el puerto ${config.PORT}`
    );
});

// Lógica para un apagado elegante
const gracefulShutdown = (signal) => {
    logger.warn(
        `Señal ${signal} recibida. Cerrando el servidor elegantemente...`
    );
    server.close(() => {
        logger.info('Peticiones HTTP cerradas.');
        // Aquí se cerrarían otras conexiones, como la de la base de datos
        // db.pool.end(() => { ... });
        process.exit(0);
    });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
