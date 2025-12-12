/** @type {import('next').NextConfig} */

// ═══════════════════════════════════════════════════════════════════════════════
// NEXT.JS CONFIGURATION - AGROBRIDGE FRONTEND
// Fecha de última modificación: 2025-11-27
// Propósito: Configuración optimizada para desarrollo y producción
// ═══════════════════════════════════════════════════════════════════════════════

const nextConfig = {
  // ─────────────────────────────────────────────────────────────────────────────
  // IMAGE OPTIMIZATION - Configuración de next/image
  // ─────────────────────────────────────────────────────────────────────────────
  images: {
    // Lista de hostnames permitidos para imágenes externas
    // Docs: https://nextjs.org/docs/app/api-reference/components/image#remotepatterns
    remotePatterns: [
      // Placeholder service para desarrollo
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      // Amazon S3 (para imágenes de producción)
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      // Amazon S3 alternativo (s3.amazonaws.com directo)
      {
        protocol: 'https',
        hostname: 's3.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      // Cloudinary (CDN de imágenes si se usa en el futuro)
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
      // Imgix (otro CDN popular)
      {
        protocol: 'https',
        hostname: '*.imgix.net',
        port: '',
        pathname: '/**',
      },
    ],

    // Formatos de imagen optimizados (WebP y AVIF para mejor compresión)
    formats: ['image/webp', 'image/avif'],

    // Tamaños de dispositivo para responsive images
    // Estos se usan para generar srcset automáticamente
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],

    // Tamaños de íconos y thumbnails
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // Tiempo de cache para imágenes optimizadas (en segundos)
    // 60 días en producción
    minimumCacheTTL: 5184000,

    // Deshabilitar static import de imágenes si causara problemas
    // disableStaticImages: false,

    // Permitir SVG optimizados (necesario para placehold.co)
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // TURBOPACK CONFIGURATION (Next.js 16 default bundler)
  // ─────────────────────────────────────────────────────────────────────────────
  turbopack: {
    // Configuración vacía para silenciar warnings de webpack config
    // Turbopack es más rápido que Webpack y es el default en Next.js 16
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // REACT CONFIGURATION
  // ─────────────────────────────────────────────────────────────────────────────
  reactStrictMode: true, // Habilita checks adicionales en desarrollo

  // ─────────────────────────────────────────────────────────────────────────────
  // ENVIRONMENT VARIABLES (Públicas para el cliente)
  // ─────────────────────────────────────────────────────────────────────────────
  env: {
    // Variables disponibles en el cliente (prefijo NEXT_PUBLIC_ en .env.local)
    // Ejemplo: NEXT_PUBLIC_API_URL se expone automáticamente
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // HEADERS (CORS y Security para API routes si existen)
  // ─────────────────────────────────────────────────────────────────────────────
  async headers() {
    return [
      {
        // Aplicar headers solo a rutas de API si existen
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: process.env.NEXT_PUBLIC_API_URL || '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
        ],
      },
    ];
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // REDIRECTS (Si se necesitan en el futuro)
  // ─────────────────────────────────────────────────────────────────────────────
  // async redirects() {
  //   return [
  //     {
  //       source: '/old-path',
  //       destination: '/new-path',
  //       permanent: true,
  //     },
  //   ];
  // },

  // ─────────────────────────────────────────────────────────────────────────────
  // COMPILER OPTIONS (Optimizaciones adicionales)
  // ─────────────────────────────────────────────────────────────────────────────
  compiler: {
    // Remover console.log en producción
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // EXPERIMENTAL FEATURES (Si se necesitan)
  // ─────────────────────────────────────────────────────────────────────────────
  // experimental: {
  //   serverActions: true,
  // },
};

module.exports = nextConfig;

// ═══════════════════════════════════════════════════════════════════════════════
// FIN DE CONFIGURACIÓN
// Para más opciones ver: https://nextjs.org/docs/app/api-reference/next-config-js
// ═══════════════════════════════════════════════════════════════════════════════
