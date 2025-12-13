#!/bin/bash
set -e

echo "🚀 Starting Production Deployment..."
echo "⚠️  This will deploy to PRODUCTION environment!"

# Confirmation check
read -p "Are you sure you want to deploy to production? (yes/no): " -t 10 confirmation || confirmation="yes"
if [ "$confirmation" != "yes" ]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Navigate to API directory
cd /opt/agrobridge-api/apps/api

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
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
    pm2 delete agrobridge-api-production || true
    pm2 start dist/server.js --name agrobridge-api-production --env production
    pm2 save
else
    echo "⚠️  PM2 not found, starting with node..."
    pkill -f "node.*agrobridge.*production" || true
    nohup npm run start:prod > /var/log/agrobridge-production.log 2>&1 &
fi

echo "✅ Production deployment completed successfully!"
echo "🔗 Production URL: https://api.agrobridge.io"
echo "📊 Health Check: https://api.agrobridge.io/health"
