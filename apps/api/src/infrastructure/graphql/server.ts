/**
 * @file GraphQL Server
 * @description GraphQL Yoga server setup for AgroBridge API
 *
 * @author AgroBridge Engineering Team
 */

import { createYoga } from "graphql-yoga";
import { createSchema } from "graphql-yoga";
import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { typeDefs } from "./schema/typeDefs.js";
import { resolvers } from "./resolvers/index.js";
import { createContext, GraphQLContext } from "./context.js";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface GraphQLServerOptions {
  prisma: PrismaClient;
  isDevelopment?: boolean;
  enableIntrospection?: boolean;
  endpoint?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create the GraphQL schema
 */
function buildSchema() {
  return createSchema({
    typeDefs,
    resolvers,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create GraphQL Yoga server
 */
export function createGraphQLServer(options: GraphQLServerOptions) {
  const {
    prisma,
    isDevelopment = process.env.NODE_ENV !== "production",
    endpoint = "/graphql",
  } = options;

  const schema = buildSchema();
  const contextFactory = createContext(prisma);

  const yoga = createYoga<{ req: Request; res: Response }, GraphQLContext>({
    schema,
    context: contextFactory,
    graphqlEndpoint: endpoint,

    // Logging configuration
    logging: isDevelopment
      ? "debug"
      : {
          debug: () => {},
          info: () => {},
          warn: console.warn,
          error: console.error,
        },

    // Landing page configuration
    landingPage: isDevelopment,

    // Health check endpoint
    healthCheckEndpoint: "/graphql/health",

    // CORS is handled by Express
    cors: false,

    // Response caching headers
    graphiql: isDevelopment
      ? {
          title: "AgroBridge GraphQL",
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

    // Error masking in production
    maskedErrors: !isDevelopment,
  });

  return yoga;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPRESS MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create Express middleware for GraphQL
 */
export function createGraphQLMiddleware(options: GraphQLServerOptions) {
  const yoga = createGraphQLServer(options);

  return async (req: Request, res: Response) => {
    // Use yoga.fetch which returns a proper Response
    const response = await yoga.fetch(
      new globalThis.Request(`http://localhost${req.url}`, {
        method: req.method,
        headers: req.headers as HeadersInit,
        body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
      }),
      { req, res },
    );

    // Set response headers
    response.headers.forEach((value: string, key: string) => {
      res.setHeader(key, value);
    });

    res.status(response.status);

    // Send response body
    const body = await response.text();
    res.send(body);
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get GraphQL endpoint info
 */
export function getGraphQLInfo(endpoint = "/graphql") {
  const isDevelopment = process.env.NODE_ENV !== "production";

  return {
    endpoint,
    healthEndpoint: `${endpoint}/health`,
    playgroundEnabled: isDevelopment,
    introspectionEnabled: isDevelopment,
    features: [
      "Batches CRUD",
      "Producers management",
      "Events tracking",
      "User queries",
      "Analytics (Admin/Certifier)",
      "Certifications",
      "Field-level authorization",
      "DataLoader batching",
      "Cursor and offset pagination",
    ],
    documentation: {
      queries: [
        "me - Get current authenticated user",
        "user(id) - Get user by ID",
        "users - List all users (Admin/Certifier)",
        "batch(id) - Get batch by ID",
        "batches - List batches with filtering/sorting",
        "producer(id) - Get producer by ID",
        "producers - List producers",
        "event(id) - Get event by ID",
        "events - List events",
        "dashboard - Get dashboard statistics",
        "search - Search across entities",
      ],
      mutations: [
        "createBatch - Create new batch",
        "updateBatchStatus - Update batch status",
        "deleteBatch - Delete batch (Admin)",
        "createEvent - Add event to batch",
        "createProducer - Create producer (Admin)",
        "updateProducer - Update producer",
        "whitelistProducer - Whitelist producer (Admin/Certifier)",
        "addCertification - Add certification to producer",
      ],
    },
  };
}
