import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { marked } from 'marked';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const articlesDir = path.join(__dirname, '../../content/articles');

/**
 * @route   GET /api/v2/news
 * @desc    Obtener una lista de todos los artículos (solo metadatos)
 * @access  Public
 */
router.get('/', async (req, res) => {
    try {
        const files = await fs.readdir(articlesDir);
        const articles = await Promise.all(
            files
                .filter((file) => file.endsWith('.md'))
                .map(async (file) => {
                    const filePath = path.join(articlesDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const { data } = matter(content);
                    return data; // Solo devolvemos los metadatos (frontmatter)
                })
        );

        // Ordenar por fecha, el más reciente primero
        articles.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({ success: true, articles });
    } catch (error) {
        logger.error('Error al leer los artículos:', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor.',
        });
    }
});

/**
 * @route   GET /api/v2/news/:slug
 * @desc    Obtener el contenido completo de un artículo
 * @access  Public
 */
router.get('/:slug', async (req, res) => {
    const slug = req.params.slug;
    const filePath = path.join(articlesDir, `${slug}.md`);

    try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        const { data, content } = matter(fileContent);

        // Convertir el contenido Markdown a HTML
        const htmlContent = marked(content);

        const article = { ...data, content: htmlContent };
        res.json({ success: true, article });
    } catch (error) {
        logger.warn(`Artículo no encontrado: ${slug}`, {
            error: error.message,
        });
        res.status(404).json({
            success: false,
            message: 'Artículo no encontrado.',
        });
    }
});

export default router;
