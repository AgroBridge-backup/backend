import swaggerJsdoc from 'swagger-jsdoc';
const options = {
    definition: {
        openapi: '3.0.3',
        info: {
            title: 'AgroBridge API',
            version: '1.0.0',
            description: `
# Agricultural Traceability Platform

AgroBridge connects Mexican agricultural producers with global buyers through:

🌱 **Producer Management** - Registration, verification, certification
📦 **Batch Tracking** - Harvest to delivery traceability
📍 **Event Timeline** - Complete audit trail with timestamps
🔐 **Blockchain Integration** - Immutable records (256-bit encryption)
✅ **Compliance Ready** - FSMA, EU, Mexican regulations

## Authentication

Protected endpoints require JWT Bearer token:
\`\`\`
Authorization: Bearer <token>
\`\`\`

## Rate Limiting

- Public endpoints: 100 requests/minute
- Authenticated endpoints: 1000 requests/minute
      `,
            contact: { name: 'AgroBridge Support', email: 'api@agrobridge.io' },
            license: { name: 'Proprietary', url: 'https://agrobridge.io/terms' },
        },
        servers: [
            { url: 'http://localhost:3000', description: 'Development' },
            { url: 'https://api.agrobridge.io', description: 'Production' },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                Producer: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
                        userId: { type: 'string', format: 'uuid' },
                        businessName: { type: 'string', example: 'Rancho Los Aguacates' },
                        rfc: { type: 'string', example: 'XAXX010101000' },
                        location: { type: 'string', example: 'Michoacán, México' },
                        state: { type: 'string', example: 'Michoacán' },
                        municipality: { type: 'string', example: 'Uruapan' },
                        isWhitelisted: { type: 'boolean', example: true },
                        isVerified: { type: 'boolean', example: true },
                        certifications: {
                            type: 'array',
                            items: { type: 'string' },
                            example: ['Organic', 'Fair Trade', 'GlobalGAP'],
                        },
                        productsOffered: {
                            type: 'array',
                            items: { type: 'string' },
                            example: ['Aguacate Hass', 'Mango Ataulfo'],
                        },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
                Batch: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        batchNumber: { type: 'string', example: 'BATCH-2025-001234' },
                        producerId: { type: 'string', format: 'uuid' },
                        productType: { type: 'string', example: 'Aguacate Hass' },
                        variety: { type: 'string', example: 'Hass' },
                        quantity: { type: 'number', example: 5000 },
                        unit: { type: 'string', example: 'kg' },
                        harvestDate: { type: 'string', format: 'date' },
                        parcelName: { type: 'string', example: 'Parcela Norte' },
                        status: {
                            type: 'string',
                            enum: ['ACTIVE', 'IN_TRANSIT', 'IN_STORAGE', 'DELIVERED', 'CANCELLED', 'EXPIRED'],
                            example: 'ACTIVE',
                        },
                        qrCode: { type: 'string', example: 'https://api.agrobridge.io/qr/BATCH-2025-001234' },
                        blockchainHash: { type: 'string', example: '0x1234567890abcdef...' },
                        latitude: { type: 'number', example: 19.4326 },
                        longitude: { type: 'number', example: -99.1332 },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
                Event: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        batchId: { type: 'string', format: 'uuid' },
                        eventType: {
                            type: 'string',
                            enum: ['HARVEST', 'PROCESSING', 'QUALITY_CHECK', 'TRANSPORT', 'INSPECTION', 'CERTIFICATION', 'DELIVERY', 'STORAGE'],
                            example: 'HARVEST',
                        },
                        title: { type: 'string', example: 'Cosecha completada' },
                        description: { type: 'string', example: 'Lote cosechado exitosamente' },
                        location: { type: 'string', example: 'Uruapan, Michoacán' },
                        locationName: { type: 'string', example: 'Rancho Los Aguacates' },
                        latitude: { type: 'number', example: 19.4326 },
                        longitude: { type: 'number', example: -99.1332 },
                        temperature: { type: 'number', example: 25.5 },
                        humidity: { type: 'number', example: 65 },
                        notes: { type: 'string', example: 'Condiciones óptimas' },
                        timestamp: { type: 'string', format: 'date-time' },
                        createdById: { type: 'string', format: 'uuid' },
                        blockchainTxHash: { type: 'string' },
                        metadata: { type: 'object', additionalProperties: true },
                    },
                },
                Pagination: {
                    type: 'object',
                    properties: {
                        page: { type: 'integer', example: 1 },
                        limit: { type: 'integer', example: 10 },
                        total: { type: 'integer', example: 100 },
                        totalPages: { type: 'integer', example: 10 },
                        hasMore: { type: 'boolean', example: true },
                    },
                },
                SuccessResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        data: { type: 'object' },
                        message: { type: 'string' },
                    },
                },
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        error: { type: 'string', example: 'Resource not found' },
                        message: { type: 'string', example: 'The requested resource could not be found' },
                    },
                },
            },
            responses: {
                Unauthorized: {
                    description: 'Missing or invalid authentication',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                        },
                    },
                },
                NotFound: {
                    description: 'Resource not found',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                        },
                    },
                },
                Forbidden: {
                    description: 'Insufficient permissions',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                        },
                    },
                },
                ValidationError: {
                    description: 'Invalid input data',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                        },
                    },
                },
            },
        },
        tags: [
            { name: 'Auth', description: 'Authentication endpoints' },
            { name: 'Producers', description: 'Agricultural producer management' },
            { name: 'Batches', description: 'Product batch tracking' },
            { name: 'Events', description: 'Traceability events' },
        ],
    },
    apis: ['./src/presentation/routes/*.ts', './src/infrastructure/docs/paths/*.yaml'],
};
export const swaggerSpec = swaggerJsdoc(options);
