import { createYoga } from 'graphql-yoga';
import { createSchema } from 'graphql-yoga';
import { typeDefs } from './schema/typeDefs.js';
import { resolvers } from './resolvers/index.js';
import { createContext } from './context.js';
function buildSchema() {
    return createSchema({
        typeDefs,
        resolvers,
    });
}
export function createGraphQLServer(options) {
    const { prisma, isDevelopment = process.env.NODE_ENV !== 'production', endpoint = '/graphql', } = options;
    const schema = buildSchema();
    const contextFactory = createContext(prisma);
    const yoga = createYoga({
        schema,
        context: contextFactory,
        graphqlEndpoint: endpoint,
        logging: isDevelopment
            ? 'debug'
            : {
                debug: () => { },
                info: () => { },
                warn: console.warn,
                error: console.error,
            },
        landingPage: isDevelopment,
        healthCheckEndpoint: '/graphql/health',
        cors: false,
        graphiql: isDevelopment
            ? {
                title: 'AgroBridge GraphQL',
                defaultQuery: `# Welcome to AgroBridge GraphQL API
#
# Try these example queries:

# Get current user
query Me {
  me {
    id
    email
    firstName
    lastName
    role
  }
}

# List batches with pagination
query Batches {
  batches(pagination: { page: 1, limit: 10 }) {
    nodes {
      id
      origin
      variety
      status
      weightKg
      producer {
        businessName
      }
    }
    pageInfo {
      totalCount
      hasNextPage
    }
  }
}

# Get dashboard stats (Admin/Certifier only)
query Dashboard {
  dashboard {
    totalBatches
    activeBatches
    totalProducers
    batchesByStatus {
      status
      count
      percentage
    }
  }
}
`,
            }
            : false,
        maskedErrors: !isDevelopment,
    });
    return yoga;
}
export function createGraphQLMiddleware(options) {
    const yoga = createGraphQLServer(options);
    return async (req, res) => {
        const response = await yoga.fetch(new globalThis.Request(`http://localhost${req.url}`, {
            method: req.method,
            headers: req.headers,
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
        }), { req, res });
        response.headers.forEach((value, key) => {
            res.setHeader(key, value);
        });
        res.status(response.status);
        const body = await response.text();
        res.send(body);
    };
}
export function getGraphQLInfo(endpoint = '/graphql') {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    return {
        endpoint,
        healthEndpoint: `${endpoint}/health`,
        playgroundEnabled: isDevelopment,
        introspectionEnabled: isDevelopment,
        features: [
            'Batches CRUD',
            'Producers management',
            'Events tracking',
            'User queries',
            'Analytics (Admin/Certifier)',
            'Certifications',
            'Field-level authorization',
            'DataLoader batching',
            'Cursor and offset pagination',
        ],
        documentation: {
            queries: [
                'me - Get current authenticated user',
                'user(id) - Get user by ID',
                'users - List all users (Admin/Certifier)',
                'batch(id) - Get batch by ID',
                'batches - List batches with filtering/sorting',
                'producer(id) - Get producer by ID',
                'producers - List producers',
                'event(id) - Get event by ID',
                'events - List events',
                'dashboard - Get dashboard statistics',
                'search - Search across entities',
            ],
            mutations: [
                'createBatch - Create new batch',
                'updateBatchStatus - Update batch status',
                'deleteBatch - Delete batch (Admin)',
                'createEvent - Add event to batch',
                'createProducer - Create producer (Admin)',
                'updateProducer - Update producer',
                'whitelistProducer - Whitelist producer (Admin/Certifier)',
                'addCertification - Add certification to producer',
            ],
        },
    };
}
