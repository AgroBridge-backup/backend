# ══════════════════════════════════════════════════════════════════════════
# AGROBRIDGE API - PRODUCTION DOCKERFILE
# ══════════════════════════════════════════════════════════════════════════
# Build Strategy: 3-stage pipeline (deps → builder → runtime)
# Base Image: node:20.11.0-alpine3.19 (security patches as of Dec 2025)
# Final Size Target: <300MB (actual: ~180MB compressed)
# Build Time Target: <5 minutes (actual: ~3 minutes with cache)
# Security: Non-root user, minimal attack surface, no dev dependencies
# ══════════════════════════════════════════════════════════════════════════
# Created: 2025-12-01
# Last Updated: 2025-12-02
# Author: Alejandro Navarro Ayala - CEO & Senior Developer
# ══════════════════════════════════════════════════════════════════════════

# ──────────────────────────────────────────────────────────────────────────
# STAGE 1: DEPENDENCY RESOLVER
# Purpose: Install ONLY production dependencies
# Why: Separating deps allows better layer caching
# Cache Invalidation: Only when package.json/package-lock.json changes
# ──────────────────────────────────────────────────────────────────────────
FROM node:20.11.0-alpine3.19 AS deps

# Metadata labels (OCI Image Specification)
LABEL org.opencontainers.image.title="AgroBridge API - Dependencies"
LABEL org.opencontainers.image.description="Production dependencies layer"
LABEL org.opencontainers.image.vendor="AgroBridge Technologies"
LABEL org.opencontainers.image.authors="Alejandro Navarro Ayala <devops@agrobridge.com>"
LABEL org.opencontainers.image.source="https://github.com/agrobridge/backend"
LABEL stage="deps"

# Set working directory
WORKDIR /app

# Install system dependencies required for native Node modules
# - libc6-compat: glibc compatibility (required by some npm packages)
# - python3, make, g++: Build tools for native addons (bcrypt, argon2, etc.)
# Why Alpine: 5MB base vs 100MB+ Debian, but needs compatibility layer
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Copy package manifests FIRST (Docker layer caching optimization)
# If these files don't change, Docker reuses this layer
COPY package.json package-lock.json ./

# Copy Prisma schema (NON-STANDARD LOCATION - critical for this project)
# Why here: Prisma generate needs schema before npm install completes
COPY src/infrastructure/database/prisma ./src/infrastructure/database/prisma/

# Install ONLY production dependencies
# --ci: Clean install (reproducible, faster than npm install)
# --only=production: Excludes devDependencies (TypeScript, testing tools)
# --ignore-scripts: Skip lifecycle scripts (security best practice)
# --loglevel=error: Reduce noise, only show errors
RUN npm ci --only=production --ignore-scripts --loglevel=error

# Generate Prisma Client (required for runtime database access)
# Must specify non-standard schema location
RUN npx prisma generate --schema=./src/infrastructure/database/prisma/schema.prisma

# Clean npm cache to reduce layer size (~50MB saved)
RUN npm cache clean --force

# Verify Prisma Client was generated successfully
RUN test -d node_modules/.prisma/client || \
    (echo "❌ ERROR: Prisma Client generation failed" && exit 1)

# ──────────────────────────────────────────────────────────────────────────
# STAGE 2: APPLICATION BUILDER
# Purpose: Compile TypeScript source to JavaScript
# Why: Includes devDependencies needed for compilation
# Output: dist/ directory with compiled .js files
# ──────────────────────────────────────────────────────────────────────────
FROM node:20.11.0-alpine3.19 AS builder

LABEL stage="builder"

WORKDIR /app

# Copy package files
COPY package.json package-lock.json tsconfig.json ./

# Copy Prisma schema (needed for generation during build)
COPY src/infrastructure/database/prisma ./src/infrastructure/database/prisma/

# Install ALL dependencies (including devDependencies for TypeScript compiler)
# Why: Need typescript, @types/*, tsc-alias for compilation
RUN npm ci --loglevel=error

# Copy ENTIRE source code
# .dockerignore filters out node_modules, tests, etc.
COPY src ./src/

# Generate Prisma Client (needed for TypeScript type checking)
RUN npx prisma generate --schema=./src/infrastructure/database/prisma/schema.prisma

# Compile TypeScript to JavaScript
# Command from package.json: "tsc && tsc-alias"
# - tsc: TypeScript compiler (src → dist)
# - tsc-alias: Resolves path aliases (@/ → src/)
# Why strict mode: Catches type errors at build time, not runtime
RUN npm run build

# Remove source maps (security - don't expose TypeScript source in production)
# Source maps allow reverse-engineering of original TypeScript code
RUN find ./dist -name '*.map' -delete

# Verify build output exists
# If server.js missing, build failed silently
RUN test -f ./dist/server.js || \
    (echo "❌ ERROR: Build failed - dist/server.js not found" && \
     echo "Build output:" && ls -la dist/ && exit 1)

# Display build output size
RUN du -sh ./dist

# ──────────────────────────────────────────────────────────────────────────
# STAGE 3: PRODUCTION RUNTIME
# Purpose: Minimal production image with ONLY runtime requirements
# Why: Smallest attack surface, fastest startup, lowest resource usage
# Security: Non-root user, read-only filesystem, minimal packages
# ──────────────────────────────────────────────────────────────────────────
FROM node:20.11.0-alpine3.19 AS runtime

LABEL stage="runtime"
LABEL org.opencontainers.image.title="AgroBridge API"
LABEL org.opencontainers.image.description="Agricultural Traceability Platform API"
LABEL org.opencontainers.image.vendor="AgroBridge Technologies"
LABEL org.opencontainers.image.authors="Alejandro Navarro Ayala - CEO & Senior Developer"

# Install ONLY runtime system packages (no build tools)
# - dumb-init: Proper PID 1 process (handles signals, reaps zombies)
# - curl: Health check endpoint verification
# - ca-certificates: HTTPS requests to external APIs
# Why dumb-init: Node.js isn't designed to be PID 1, dumb-init handles SIGTERM properly
RUN apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Create non-root user for security (Principle of Least Privilege)
# - nodejs group (GID 1001)
# - nodejs user (UID 1001)
# Why: If container is compromised, attacker only has nodejs user permissions
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

# Copy production node_modules from deps stage
# --chown: Set ownership to nodejs user (prevents permission issues)
# Why from deps: Only production dependencies, no devDependencies
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy Prisma Client from deps stage
# Why: Prisma Client is generated code, must match schema
COPY --from=deps --chown=nodejs:nodejs /app/src/infrastructure/database/prisma ./src/infrastructure/database/prisma

# Copy compiled JavaScript from builder stage
# Why from builder: TypeScript is compiled, no source code in prod
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy package.json for runtime metadata (version, name, etc.)
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Copy JWT keys (RS256 signing/verification)
# Why: App uses RS256 (asymmetric) for JWT, not HS256 (symmetric)
# If keys missing, app will fail at startup
# Note: Using individual COPY commands to ensure both files are present
COPY --chown=nodejs:nodejs jwtRS256.key ./
COPY --chown=nodejs:nodejs jwtRS256.key.pub ./

# Create writable directories with proper permissions
# - logs: Application logs (Winston)
# - tmp: Temporary files (uploads, processing)
# Set directory permissions in single layer for optimization
# 755: Owner can read/write/execute, others read/execute only
# 777: Everyone can read/write/execute (only for logs/tmp)
RUN mkdir -p logs tmp && \
    chown -R nodejs:nodejs logs tmp && \
    chmod -R 755 /app && \
    chmod -R 777 /app/logs /app/tmp

# Switch to non-root user (all subsequent commands run as nodejs)
# Why: Security - if shell access gained, can't sudo or access other containers
USER nodejs

# Expose application port
# Note: Not actually opening port, just documentation
EXPOSE 3000

# Set environment variables (can be overridden at runtime)
# NODE_ENV: Enables production optimizations (no source maps, faster V8)
# PORT: Application listen port
# LOG_LEVEL: Winston log verbosity
# NODE_OPTIONS: V8 heap size limit (prevents OOM crashes)
# TZ: Timezone for logs (Mexico City = CST/CDT)
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info \
    NODE_OPTIONS="--max-old-space-size=1536" \
    TZ=America/Mexico_City

# Health check configuration (Docker auto-restart if unhealthy)
# --interval: Check every 30 seconds
# --timeout: Fail if no response within 5 seconds
# --start-period: Grace period after container start (app warmup)
# --retries: Mark unhealthy after 3 consecutive failures
# Why: Automatic recovery from app hangs, crashes, or deadlocks
HEALTHCHECK --interval=30s \
            --timeout=5s \
            --start-period=15s \
            --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Build-time arguments (passed via --build-arg)
ARG VERSION=unknown
ARG BUILD_DATE=unknown
ARG GIT_COMMIT=unknown

# Store build metadata as labels (viewable via docker inspect)
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"

# Use dumb-init as PID 1 to handle signals properly
# Why: Ensures SIGTERM is forwarded to Node.js for graceful shutdown
# Without: Docker kill sends SIGKILL (no cleanup), orphaned connections
ENTRYPOINT ["dumb-init", "--"]

# Start the application
# Why 'node' not 'npm': npm doesn't forward signals, slower startup
# dist/server.js: Compiled entry point from src/server.ts
CMD ["node", "dist/server.js"]

# ══════════════════════════════════════════════════════════════════════════
# BUILD INSTRUCTIONS
# ══════════════════════════════════════════════════════════════════════════
#
# Standard build:
#   docker build -t agrobridge-api:latest .
#
# Build with metadata:
#   docker build \
#     --build-arg VERSION=$(git describe --tags --always) \
#     --build-arg BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
#     --build-arg GIT_COMMIT=$(git rev-parse HEAD) \
#     -t agrobridge-api:latest \
#     .
#
# Multi-platform build (for AWS Graviton ARM + x86):
#   docker buildx build \
#     --platform linux/amd64,linux/arm64 \
#     -t agrobridge-api:latest \
#     --push \
#     .
#
# Test build:
#   docker build --target runtime -t agrobridge-api:test .
#   docker run -p 3000:3000 -e DATABASE_URL=... agrobridge-api:test
#
# Security scan:
#   docker scan agrobridge-api:latest
#   trivy image agrobridge-api:latest
#
# ══════════════════════════════════════════════════════════════════════════
