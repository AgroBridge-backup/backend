/**
 * @file Documentation Routes
 * @description Serve Swagger UI and OpenAPI specification
 */

import { Router, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../../infrastructure/docs/swagger/config.js';

const router = Router();

// Swagger UI options
const swaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 50px 0 }
    .swagger-ui .scheme-container { margin: 20px 0 }
    .swagger-ui .info .title { font-size: 36px }
    .swagger-ui .info .description { margin-top: 20px }
    .swagger-ui .opblock-tag { font-size: 18px }
  `,
  customSiteTitle: 'AgroBridge API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    syntaxHighlight: {
      theme: 'monokai',
    },
    docExpansion: 'list',
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
  },
};

// Serve Swagger UI
router.use('/api-docs', swaggerUi.serve);
router.get('/api-docs', swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Serve OpenAPI spec as JSON
router.get('/openapi.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(swaggerSpec);
});

// Serve OpenAPI spec as YAML
router.get('/openapi.yaml', async (req: Request, res: Response) => {
  try {
    const yaml = await import('js-yaml');
    const yamlSpec = yaml.dump(swaggerSpec);
    res.setHeader('Content-Type', 'text/yaml');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(yamlSpec);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'YAML_GENERATION_ERROR',
        message: 'Failed to generate YAML spec'
      }
    });
  }
});

// Redirect /docs to /api-docs
router.get('/docs', (req: Request, res: Response) => {
  res.redirect('/api-docs');
});

// API documentation landing page
router.get('/docs/api', (req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgroBridge API Documentation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: linear-gradient(135deg, #f5f7fa 0%, #e4e9f0 100%);
      min-height: 100vh;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    header {
      text-align: center;
      margin-bottom: 60px;
      padding: 40px 0;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    .logo {
      font-size: 64px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 48px;
      color: #1a1a2e;
      margin-bottom: 16px;
      font-weight: 700;
    }
    .subtitle {
      font-size: 20px;
      color: #666;
      max-width: 600px;
      margin: 0 auto;
    }
    .version-badge {
      display: inline-block;
      background: #4CAF50;
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      margin-top: 16px;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 24px;
      margin-top: 40px;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      transition: all 0.3s ease;
      border: 1px solid rgba(0,0,0,0.05);
    }
    .card:hover {
      transform: translateY(-8px);
      box-shadow: 0 12px 40px rgba(0,0,0,0.12);
    }
    .card-icon {
      font-size: 40px;
      margin-bottom: 16px;
    }
    .card h3 {
      color: #1a1a2e;
      margin-bottom: 12px;
      font-size: 22px;
      font-weight: 600;
    }
    .card p {
      color: #666;
      margin-bottom: 24px;
      line-height: 1.6;
    }
    .card a {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      transition: all 0.3s ease;
    }
    .card a:hover {
      background: linear-gradient(135deg, #45a049 0%, #3d8b40 100%);
      transform: translateX(4px);
    }
    .card a.secondary {
      background: #f5f5f5;
      color: #333;
      margin-left: 8px;
    }
    .card a.secondary:hover {
      background: #e0e0e0;
    }
    .footer {
      text-align: center;
      margin-top: 60px;
      padding: 40px 0;
      color: #666;
    }
    .footer a {
      color: #4CAF50;
      text-decoration: none;
      margin: 0 16px;
    }
    .footer a:hover {
      text-decoration: underline;
    }
    .stats {
      display: flex;
      justify-content: center;
      gap: 48px;
      margin-top: 32px;
      flex-wrap: wrap;
    }
    .stat {
      text-align: center;
    }
    .stat-value {
      font-size: 32px;
      font-weight: 700;
      color: #4CAF50;
    }
    .stat-label {
      font-size: 14px;
      color: #666;
      margin-top: 4px;
    }
    @media (max-width: 768px) {
      h1 { font-size: 32px; }
      .cards { grid-template-columns: 1fr; }
      .stats { gap: 24px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">&#127806;</div>
      <h1>AgroBridge API</h1>
      <p class="subtitle">Complete API Documentation and Resources for Agricultural Traceability</p>
      <span class="version-badge">v2.0.0</span>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">50+</div>
          <div class="stat-label">API Endpoints</div>
        </div>
        <div class="stat">
          <div class="stat-value">9</div>
          <div class="stat-label">Resource Types</div>
        </div>
        <div class="stat">
          <div class="stat-value">24/7</div>
          <div class="stat-label">Availability</div>
        </div>
      </div>
    </header>

    <div class="cards">
      <div class="card">
        <div class="card-icon">&#128214;</div>
        <h3>REST API (Swagger)</h3>
        <p>Interactive REST API documentation with try-it-out functionality. Explore all endpoints, test requests, and see live responses.</p>
        <a href="/api-docs">Open Swagger UI &#8594;</a>
      </div>

      <div class="card">
        <div class="card-icon">&#128268;</div>
        <h3>GraphQL Playground</h3>
        <p>Explore the GraphQL schema and run queries in the interactive playground. Perfect for flexible data fetching.</p>
        <a href="/graphql">Open Playground &#8594;</a>
      </div>

      <div class="card">
        <div class="card-icon">&#128229;</div>
        <h3>OpenAPI Specification</h3>
        <p>Download the complete OpenAPI 3.0 specification in JSON or YAML format for code generation and tooling.</p>
        <a href="/openapi.json" download>JSON</a>
        <a href="/openapi.yaml" download class="secondary">YAML</a>
      </div>

      <div class="card">
        <div class="card-icon">&#128236;</div>
        <h3>Postman Collection</h3>
        <p>Import our ready-to-use Postman collection for quick API testing. Includes all endpoints with example requests.</p>
        <a href="/docs/postman/collection.json" download>Download Collection &#8594;</a>
      </div>

      <div class="card">
        <div class="card-icon">&#128640;</div>
        <h3>Getting Started Guide</h3>
        <p>Quick start guide for developers to integrate with AgroBridge API. Be productive in under 30 minutes.</p>
        <a href="https://github.com/agrobridge/agrobridge-backend/blob/main/docs/guides/GETTING_STARTED.md">Read Guide &#8594;</a>
      </div>

      <div class="card">
        <div class="card-icon">&#127959;</div>
        <h3>Architecture Overview</h3>
        <p>System architecture, design patterns, and technical decisions. Understand how AgroBridge is built.</p>
        <a href="https://github.com/agrobridge/agrobridge-backend/blob/main/docs/guides/ARCHITECTURE.md">View Architecture &#8594;</a>
      </div>
    </div>

    <div class="footer">
      <p>
        <a href="https://github.com/agrobridge/agrobridge-backend">GitHub</a>
        <a href="https://status.agrobridge.io">Status Page</a>
        <a href="mailto:support@agrobridge.io">Support</a>
        <a href="https://agrobridge.io">Website</a>
      </p>
      <p style="margin-top: 16px; font-size: 14px;">
        &copy; ${new Date().getFullYear()} AgroBridge. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `);
});

// Health check for docs
router.get('/docs/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      documentation: 'available',
      swagger: '/api-docs',
      graphql: '/graphql',
      openapi: {
        json: '/openapi.json',
        yaml: '/openapi.yaml',
      },
    },
  });
});

export { router as docsRouter };
export default router;
