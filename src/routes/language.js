import express from 'express';
import axios from 'axios';
import { mapCountryToLanguage } from '../utils/languageMapper.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.get('/detect', async (req, res) => {
    // Priorizar x-forwarded-for, común en entornos con proxy (Heroku, AWS ELB, etc.)
    const userIP = (req.headers['x-forwarded-for'] || req.ip || '')
        .split(',')[0]
        .trim();

    // No hacer la llamada para IPs locales o indefinidas
    if (!userIP || userIP === '::1' || userIP === '127.0.0.1') {
        return res.json({
            language: 'en',
            country: 'local',
            source: 'fallback',
        });
    }

    try {
        const response = await axios.get(`https://ipapi.co/${userIP}/json/`, {
            timeout: 2000,
        });
        const countryCode = response.data.country_code;
        const languageCode = mapCountryToLanguage(countryCode);

        logger.info(`Idioma detectado para IP ${userIP}`, {
            country: countryCode,
            language: languageCode,
        });
        res.json({
            language: languageCode,
            country: countryCode,
            source: 'ip-detection',
        });
    } catch (error) {
        logger.error(`Error en API de geolocalización para IP ${userIP}:`, {
            message: error.message,
        });
        // Fallback a inglés si la API falla
        res.status(500).json({
            language: 'en',
            country: 'unknown',
            source: 'error-fallback',
        });
    }
});

export default router;
