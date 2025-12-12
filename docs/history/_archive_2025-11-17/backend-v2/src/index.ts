import Fastify from 'fastify';
import { ApolloServer } from '@apollo/server';
import { fastifyApolloDrainPlugin, fastifyApolloHandler } from '@as-integrations/fastify';
import prisma from './db';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import * as Sentry from '@sentry/node';
import bcrypt from 'bcrypt';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pdfGenerationQueue } from './queues/pdfQueue';

// Sentry Initialization
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  integrations: [
    // Automatically instrument Node.js libraries and frameworks
    ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
  ],
});

// Load schema from file
const typeDefs = readFileSync(resolve(__dirname, './schema.graphql'), 'utf-8');

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    ...(process.env.NODE_ENV !== 'production' && {
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    }),
  },
});

// Register Sentry handlers
app.addHook('onRequest', Sentry.fastifyRequestMiddleware());
app.addHook('onError', (request, reply, error, done) => {
  Sentry.captureException(error);
  done();
});


// Register Security Headers plugin
app.register(fastifyHelmet, {
  contentSecurityPolicy: false, // Disabled for Apollo Sandbox, configure properly for production
});


// Register JWT and Cookie plugins
app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'supersecretjwtkey',
  cookie: {
    cookieName: 'token',
    signed: false,
  },
});

app.register(fastifyCookie);

const server = new ApolloServer({
  typeDefs,
  resolvers: {
    Query: {
      hello: () => 'Hello from AgroBridge V2!',
      me: async (parent, args, context) => {
        if (!context.user) return null;
        return prisma.user.findUnique({ where: { id: context.user.id } });
      }
    },
    Mutation: {
      signUp: async (parent, { email, password, name }) => {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            name,
            role: 'GUEST',
          },
        });
        return user;
      },
      login: async (parent, { email, password }, context) => {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) throw new Error('Invalid credentials');
        
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) throw new Error('Invalid credentials');

        const token = await context.reply.jwtSign({ id: user.id, email: user.email, role: user.role });

        context.reply.setCookie('token', token, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        });

        return { token, user };
      },
      logout: async (parent, args, context) => {
        context.reply.clearCookie('token');
        return true;
      },
      generateProductReport: async (parent, { productId, productName }) => {
        const job = await pdfGenerationQueue.add('generate-report', { productId, productName });
        return `Job ${job.id} added to the queue for product ${productName}.`;
      }
    }
  },
  plugins: [fastifyApolloDrainPlugin(app)],
});

const start = async () => {
  await server.start();

  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      // Unauthenticated
    }
  });

  app.route({
    url: '/graphql',
    method: ['GET', 'POST', 'OPTIONS'],
    handler: fastifyApolloHandler(server, {
      context: async (request, reply) => ({ request, reply, user: request.user, prisma }),
    }),
  });

  try {
    await app.listen({ port: 4000 });
  } catch (err) {
    app.log.error(err);
    Sentry.captureException(err);
    process.exit(1);
  }
};

start();
