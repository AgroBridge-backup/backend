#!/bin/bash
set -e

echo "🚀 Starting Staging Deployment..."

# Navigate to API directory
cd /opt/agrobridge-api/apps/api

# Load environment variables
if [ -f .env.staging ]; then
    export $(cat .env.staging | grep -v '^#' | xargs)
elif [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --legacy-peer-deps

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate

# Run database migrations
echo "🗄️  Running database migrations..."
npx prisma migrate deploy || echo "⚠️  Migration skipped or failed"

# Build application
echo "🔨 Building application..."
npm run build

# Restart application with PM2
echo "🔄 Restarting application..."
if command -v pm2 &> /dev/null; then
    pm2 delete agrobridge-api-staging || true
    pm2 start dist/server.js --name agrobridge-api-staging --env staging
    pm2 save
else
    echo "⚠️  PM2 not found, starting with node..."
    pkill -f "node.*agrobridge.*staging" || true
    nohup npm run start:prod > /var/log/agrobridge-staging.log 2>&1 &
fi

echo "✅ Staging deployment completed successfully!"
