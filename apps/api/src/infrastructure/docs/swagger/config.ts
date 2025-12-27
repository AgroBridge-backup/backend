/**
 * @file Swagger Configuration
 * @description OpenAPI 3.0 specification for AgroBridge API
 */

import swaggerJsdoc from "swagger-jsdoc";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "AgroBridge API",
    version: "2.0.0",
    description: `
# AgroBridge API Documentation

AgroBridge is a comprehensive agricultural traceability platform that enables producers,
auditors, and stakeholders to track agricultural products from farm to consumer.

## Features

* **Batch Traceability** - Track products through the entire supply chain
* **Producer Management** - Manage producer profiles and certifications
* **Event Tracking** - Record harvest, transportation, quality checks, and more
* **Authentication** - JWT-based auth with 2FA and OAuth2 support
* **Payments** - Stripe integration for subscription billing
* **Reports** - Generate PDF, CSV, and Excel reports
* **Notifications** - Multi-channel notifications (Push, SMS, Email)
* **Analytics** - Dashboard statistics and insights
* **Real-time** - WebSocket support for live updates

## Base URLs

| Environment | URL |
|-------------|-----|
| Production | \`https://api.agrobridge.io\` |
| Staging | \`https://api-staging.agrobridge.io\` |
| Development | \`http://localhost:3000\` |

## Authentication

Most endpoints require authentication via JWT token:

\`\`\`
Authorization: Bearer YOUR_ACCESS_TOKEN
\`\`\`

Get your access token from the \`/api/v1/auth/login\` endpoint.

## Rate Limiting

API requests are rate limited:

| Endpoint Type | Limit |
|---------------|-------|
| Authentication | 5 requests per 15 minutes |
| General API | 100 requests per 15 minutes |
| Webhooks | Unlimited |

## Support

* **Email:** support@agrobridge.io
* **Documentation:** https://docs.agrobridge.io
* **Status Page:** https://status.agrobridge.io
    `,
    contact: {
      name: "AgroBridge Support",
      email: "support@agrobridge.io",
      url: "https://agrobridge.io/support",
    },
    license: {
      name: "Proprietary",
      url: "https://agrobridge.io/terms",
    },
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Development server",
    },
    {
      url: "https://api-staging.agrobridge.io",
      description: "Staging server",
    },
    {
      url: "https://api.agrobridge.io",
      description: "Production server",
    },
  ],
  tags: [
    {
      name: "Authentication",
      description: "User authentication and authorization endpoints",
    },
    {
      name: "Batches",
      description: "Batch management and traceability",
    },
    {
      name: "Producers",
      description: "Producer profile management",
    },
    {
      name: "Events",
      description: "Traceability event tracking",
    },
    {
      name: "Verification Stages",
      description: "Traceability 2.0 - Multi-stage verification workflow",
    },
    {
      name: "Certificates",
      description: "Traceability 2.0 - Blockchain quality certificates",
    },
    {
      name: "Transit",
      description: "Traceability 2.0 - Real-time GPS transit tracking",
    },
    {
      name: "Temperature",
      description: "Traceability 2.0 - Cold chain temperature monitoring",
    },
    {
      name: "NFC Seals",
      description: "Traceability 2.0 - Tamper-evident NFC seal verification",
    },
    {
      name: "Export Companies",
      description: "B2B organic certification export company management",
    },
    {
      name: "Organic Fields",
      description: "Organic field registration and compliance tracking",
    },
    {
      name: "Organic Certificates",
      description: "Revenue-critical organic certificate issuance ($5-20/cert)",
    },
    {
      name: "Satellite Analysis",
      description: "AI-powered NDVI satellite compliance verification",
    },
    {
      name: "Cold Chain",
      description: "Smart-Cold Chain Protocol for IoT sensor monitoring",
    },
    {
      name: "Quality Metrics",
      description: "Brix/pH quality verification for produce",
    },
    {
      name: "Invoicing",
      description: "Blockchain-anchored invoice management",
    },
    {
      name: "Referrals",
      description: "Referral program with leaderboard",
    },
    {
      name: "API Keys",
      description: "Enterprise API key management for integrations",
    },
    {
      name: "Payments",
      description: "Stripe payment and subscription management",
    },
    {
      name: "Reports",
      description: "Generate and download reports",
    },
    {
      name: "Notifications",
      description: "Notification preferences and device management",
    },
    {
      name: "Analytics",
      description: "Statistics and insights",
    },
    {
      name: "Public",
      description: "Public traceability endpoints (no auth required)",
    },
    {
      name: "Health",
      description: "System health and monitoring",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT access token from /api/v1/auth/login",
      },
    },
    schemas: {
      // Common schemas
      Error: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: false,
          },
          error: {
            type: "object",
            properties: {
              code: {
                type: "string",
                example: "VALIDATION_ERROR",
              },
              message: {
                type: "string",
                example: "Validation failed",
              },
              details: {
                type: "array",
                items: {
                  type: "object",
                },
              },
            },
          },
        },
      },
      PaginationMeta: {
        type: "object",
        properties: {
          page: {
            type: "integer",
            example: 1,
          },
          limit: {
            type: "integer",
            example: 20,
          },
          total: {
            type: "integer",
            example: 150,
          },
          totalPages: {
            type: "integer",
            example: 8,
          },
        },
      },
      // User schemas
      User: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            example: "clq1234567890abcdef",
          },
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
          },
          name: {
            type: "string",
            example: "John Doe",
          },
          role: {
            type: "string",
            enum: ["USER", "PRODUCER", "AUDITOR", "ADMIN"],
            example: "PRODUCER",
          },
          twoFactorEnabled: {
            type: "boolean",
            example: false,
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      // Batch schemas
      Batch: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "Unique batch identifier",
            example: "clq1234567890abcdef",
          },
          batchNumber: {
            type: "string",
            description: "Human-readable batch number",
            example: "BATCH-2024-001",
          },
          origin: {
            type: "string",
            description: "Product origin/name",
            example: "Organic Tomatoes",
          },
          variety: {
            type: "string",
            description: "Product variety",
            example: "Roma",
            nullable: true,
          },
          weightKg: {
            type: "number",
            format: "float",
            description: "Weight in kilograms",
            example: 500.5,
          },
          status: {
            type: "string",
            enum: [
              "REGISTERED",
              "IN_TRANSIT",
              "IN_STORAGE",
              "DELIVERED",
              "REJECTED",
            ],
            description: "Current batch status",
            example: "REGISTERED",
          },
          harvestDate: {
            type: "string",
            format: "date-time",
            description: "Harvest date",
            example: "2024-03-15T08:00:00Z",
          },
          certifications: {
            type: "array",
            items: {
              type: "string",
            },
            description: "Certifications (Organic, Fair Trade, etc)",
            example: ["ORGANIC", "FAIR_TRADE"],
          },
          producerId: {
            type: "string",
            format: "uuid",
            description: "Producer ID",
            example: "clq9876543210fedcba",
          },
          qrCodeUrl: {
            type: "string",
            format: "uri",
            description: "QR code URL for public traceability",
            example: "https://cdn.agrobridge.io/qr/clq1234567890abcdef.png",
            nullable: true,
          },
          blockchainTxHash: {
            type: "string",
            description: "Blockchain transaction hash",
            example: "0x1234567890abcdef...",
            nullable: true,
          },
          metadata: {
            type: "object",
            description: "Additional custom metadata",
            additionalProperties: true,
            nullable: true,
          },
          createdAt: {
            type: "string",
            format: "date-time",
            description: "Creation timestamp",
            example: "2024-03-15T10:30:00Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            description: "Last update timestamp",
            example: "2024-03-15T14:45:00Z",
          },
        },
        required: [
          "id",
          "origin",
          "weightKg",
          "status",
          "harvestDate",
          "producerId",
        ],
      },
      CreateBatchRequest: {
        type: "object",
        properties: {
          origin: {
            type: "string",
            minLength: 3,
            maxLength: 200,
            example: "Organic Tomatoes",
          },
          variety: {
            type: "string",
            maxLength: 100,
            example: "Roma",
          },
          weightKg: {
            type: "number",
            format: "float",
            minimum: 0.1,
            example: 500.5,
          },
          harvestDate: {
            type: "string",
            format: "date-time",
            example: "2024-03-15T08:00:00Z",
          },
          certifications: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["ORGANIC"],
          },
          metadata: {
            type: "object",
            additionalProperties: true,
          },
        },
        required: ["origin", "weightKg", "harvestDate"],
      },
      // Producer schemas
      Producer: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            example: "clq9876543210fedcba",
          },
          businessName: {
            type: "string",
            example: "Green Valley Farm",
          },
          email: {
            type: "string",
            format: "email",
            example: "contact@greenvalley.com",
          },
          location: {
            type: "string",
            example: "Oaxaca, Mexico",
          },
          certifications: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["ORGANIC", "FAIR_TRADE"],
          },
          isWhitelisted: {
            type: "boolean",
            example: true,
          },
          walletAddress: {
            type: "string",
            example: "0x1234567890abcdef...",
            nullable: true,
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      // Event schemas
      Event: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            example: "evt123",
          },
          batchId: {
            type: "string",
            format: "uuid",
            example: "clq1234567890abcdef",
          },
          title: {
            type: "string",
            example: "Quality Check Passed",
          },
          eventType: {
            type: "string",
            enum: [
              "HARVEST",
              "QUALITY_CHECK",
              "TRANSPORT",
              "STORAGE",
              "DELIVERY",
              "REJECTION",
              "OTHER",
            ],
            example: "QUALITY_CHECK",
          },
          description: {
            type: "string",
            example: "All quality standards met",
            nullable: true,
          },
          timestamp: {
            type: "string",
            format: "date-time",
            example: "2024-03-15T10:00:00Z",
          },
          location: {
            type: "string",
            example: "Warehouse A",
            nullable: true,
          },
          temperature: {
            type: "number",
            example: 22,
            nullable: true,
          },
          humidity: {
            type: "number",
            example: 65,
            nullable: true,
          },
          gpsCoordinates: {
            type: "object",
            properties: {
              latitude: {
                type: "number",
                example: 17.0542,
              },
              longitude: {
                type: "number",
                example: -96.7061,
              },
            },
            nullable: true,
          },
          ipfsHash: {
            type: "string",
            example: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
            nullable: true,
          },
          blockchainTxHash: {
            type: "string",
            example: "0x1234567890abcdef...",
            nullable: true,
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      CreateEventRequest: {
        type: "object",
        properties: {
          batchId: {
            type: "string",
            format: "uuid",
            example: "clq1234567890abcdef",
          },
          title: {
            type: "string",
            example: "Quality Check Passed",
          },
          eventType: {
            type: "string",
            enum: [
              "HARVEST",
              "QUALITY_CHECK",
              "TRANSPORT",
              "STORAGE",
              "DELIVERY",
              "REJECTION",
              "OTHER",
            ],
            example: "QUALITY_CHECK",
          },
          description: {
            type: "string",
            example: "All quality standards met",
          },
          timestamp: {
            type: "string",
            format: "date-time",
            example: "2024-03-15T10:00:00Z",
          },
          location: {
            type: "string",
            example: "Warehouse A",
          },
          temperature: {
            type: "number",
            example: 22,
          },
          humidity: {
            type: "number",
            example: 65,
          },
          gpsCoordinates: {
            type: "object",
            properties: {
              latitude: {
                type: "number",
                example: 17.0542,
              },
              longitude: {
                type: "number",
                example: -96.7061,
              },
            },
          },
        },
        required: ["batchId", "title", "eventType", "timestamp"],
      },
      // Auth schemas
      LoginRequest: {
        type: "object",
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
          },
          password: {
            type: "string",
            minLength: 8,
            example: "SecurePassword123!",
          },
        },
        required: ["email", "password"],
      },
      LoginResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: true,
          },
          data: {
            type: "object",
            properties: {
              user: {
                $ref: "#/components/schemas/User",
              },
              accessToken: {
                type: "string",
                example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
              },
              refreshToken: {
                type: "string",
                example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
              },
            },
          },
        },
      },
      RegisterRequest: {
        type: "object",
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
          },
          password: {
            type: "string",
            minLength: 8,
            example: "SecurePassword123!",
          },
          name: {
            type: "string",
            example: "John Doe",
          },
          role: {
            type: "string",
            enum: ["USER", "PRODUCER"],
            example: "PRODUCER",
          },
        },
        required: ["email", "password", "name"],
      },
    },
    responses: {
      UnauthorizedError: {
        description: "Authentication required",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              success: false,
              error: {
                code: "UNAUTHORIZED",
                message: "Authentication required",
              },
            },
          },
        },
      },
      ForbiddenError: {
        description: "Access denied",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              success: false,
              error: {
                code: "FORBIDDEN",
                message: "You do not have permission to perform this action",
              },
            },
          },
        },
      },
      NotFoundError: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              success: false,
              error: {
                code: "NOT_FOUND",
                message: "Resource not found",
              },
            },
          },
        },
      },
      ValidationError: {
        description: "Validation error",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              success: false,
              error: {
                code: "VALIDATION_ERROR",
                message: "Validation failed",
                details: [
                  {
                    field: "email",
                    message: "Invalid email format",
                  },
                ],
              },
            },
          },
        },
      },
      RateLimitError: {
        description: "Rate limit exceeded",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              success: false,
              error: {
                code: "RATE_LIMIT_EXCEEDED",
                message: "Too many requests. Please try again later.",
              },
            },
          },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

const options: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: [
    path.join(__dirname, "../../../presentation/routes/**/*.ts"),
    path.join(__dirname, "./schemas/**/*.yaml"),
    path.join(__dirname, "./paths/**/*.yaml"),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
