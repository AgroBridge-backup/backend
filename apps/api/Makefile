# ══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE BACKEND - MAKEFILE
# ══════════════════════════════════════════════════════════════════════════════
# Convenient commands for Docker, development, testing, and deployment
# Usage: make <target>
# Help:  make help
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: help build up down restart logs shell test clean deploy

# Default target
.DEFAULT_GOAL := help

# ──────────────────────────────────────────────────────────────────────────────
# VARIABLES
# ──────────────────────────────────────────────────────────────────────────────

DOCKER_COMPOSE := docker compose
DOCKER_COMPOSE_DEV := $(DOCKER_COMPOSE) -f docker-compose.yml
DOCKER_COMPOSE_PROD := $(DOCKER_COMPOSE) -f docker-compose.prod.yml
IMAGE_NAME := agrobridge-api
VERSION := $(shell git describe --tags --always 2>/dev/null || echo "dev")
GIT_COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE := $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
BLUE := \033[0;34m
NC := \033[0m # No Color

# ══════════════════════════════════════════════════════════════════════════════
# HELP
# ══════════════════════════════════════════════════════════════════════════════

help: ## Show this help message
	@echo ""
	@echo "$(BLUE)═══════════════════════════════════════════════════════════════$(NC)"
	@echo "$(BLUE)  AgroBridge Backend - Make Commands$(NC)"
	@echo "$(BLUE)═══════════════════════════════════════════════════════════════$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

# ══════════════════════════════════════════════════════════════════════════════
# DEVELOPMENT ENVIRONMENT
# ══════════════════════════════════════════════════════════════════════════════

dev: ## Start development environment (hot reload)
	@echo "$(YELLOW)Starting development environment...$(NC)"
	npm run dev

install: ## Install dependencies
	@echo "$(YELLOW)Installing dependencies...$(NC)"
	npm ci

# ══════════════════════════════════════════════════════════════════════════════
# DOCKER - DEVELOPMENT
# ══════════════════════════════════════════════════════════════════════════════

build: ## Build Docker images for development
	@echo "$(YELLOW)Building Docker images...$(NC)"
	$(DOCKER_COMPOSE_DEV) build --build-arg VERSION=$(VERSION) --build-arg BUILD_DATE=$(BUILD_DATE) --build-arg GIT_COMMIT=$(GIT_COMMIT)

up: ## Start development containers
	@echo "$(YELLOW)Starting development environment...$(NC)"
	$(DOCKER_COMPOSE_DEV) up -d
	@echo ""
	@echo "$(GREEN)✅ Development environment started!$(NC)"
	@echo ""
	@echo "$(BLUE)Services:$(NC)"
	@echo "  API:             http://localhost:3000"
	@echo "  API Health:      http://localhost:3000/health"
	@echo "  Prisma Studio:   http://localhost:5555"
	@echo "  PGAdmin:         http://localhost:5050"
	@echo "  Redis Commander: http://localhost:8081"
	@echo "  Prometheus:      http://localhost:9090"
	@echo "  Grafana:         http://localhost:3001 (admin/admin)"
	@echo ""

down: ## Stop development containers
	@echo "$(YELLOW)Stopping development environment...$(NC)"
	$(DOCKER_COMPOSE_DEV) down
	@echo "$(GREEN)✅ Development environment stopped$(NC)"

restart: down up ## Restart development environment

logs: ## View logs (all services)
	$(DOCKER_COMPOSE_DEV) logs -f

logs-api: ## View API logs only
	$(DOCKER_COMPOSE_DEV) logs -f api

logs-db: ## View PostgreSQL logs
	$(DOCKER_COMPOSE_DEV) logs -f postgres

logs-redis: ## View Redis logs
	$(DOCKER_COMPOSE_DEV) logs -f redis

shell: ## Open shell in API container
	$(DOCKER_COMPOSE_DEV) exec api sh

shell-db: ## Open PostgreSQL shell
	$(DOCKER_COMPOSE_DEV) exec postgres psql -U agrobridge -d agrobridge_dev

shell-redis: ## Open Redis CLI
	$(DOCKER_COMPOSE_DEV) exec redis redis-cli

# ══════════════════════════════════════════════════════════════════════════════
# DOCKER - PRODUCTION
# ══════════════════════════════════════════════════════════════════════════════

prod-build: ## Build production Docker image
	@echo "$(YELLOW)Building production image...$(NC)"
	docker build \
		--target runtime \
		--build-arg VERSION=$(VERSION) \
		--build-arg BUILD_DATE=$(BUILD_DATE) \
		--build-arg GIT_COMMIT=$(GIT_COMMIT) \
		-t $(IMAGE_NAME):$(VERSION) \
		-t $(IMAGE_NAME):latest \
		.
	@echo "$(GREEN)✅ Production image built: $(IMAGE_NAME):$(VERSION)$(NC)"

prod-up: ## Start production-like environment
	@echo "$(YELLOW)Starting production environment...$(NC)"
	$(DOCKER_COMPOSE_PROD) up -d
	@echo "$(GREEN)✅ Production environment started$(NC)"

prod-down: ## Stop production environment
	$(DOCKER_COMPOSE_PROD) down

prod-logs: ## View production logs
	$(DOCKER_COMPOSE_PROD) logs -f

prod-restart: prod-down prod-up ## Restart production environment

# ══════════════════════════════════════════════════════════════════════════════
# DATABASE
# ══════════════════════════════════════════════════════════════════════════════

db-migrate: ## Run database migrations
	@echo "$(YELLOW)Running database migrations...$(NC)"
	npx prisma migrate dev

db-migrate-prod: ## Run production migrations
	@echo "$(YELLOW)Running production migrations...$(NC)"
	npx prisma migrate deploy

db-studio: ## Open Prisma Studio
	npx prisma studio

db-seed: ## Seed database with test data
	@echo "$(YELLOW)Seeding database...$(NC)"
	npm run prisma:seed

db-reset: ## Reset database (WARNING: Deletes all data!)
	@echo "$(RED)WARNING: This will delete all data!$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ]
	npx prisma migrate reset --force

db-generate: ## Generate Prisma client
	npx prisma generate

db-backup: ## Backup database
	@mkdir -p backups
	@echo "$(YELLOW)Creating database backup...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec -T postgres pg_dump -U agrobridge agrobridge_dev > backups/backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✅ Database backed up to backups/$(NC)"

db-restore: ## Restore database from latest backup
	@echo "$(YELLOW)Restoring database from latest backup...$(NC)"
	@LATEST=$$(ls -t backups/*.sql 2>/dev/null | head -1); \
	if [ -n "$$LATEST" ]; then \
		$(DOCKER_COMPOSE_DEV) exec -T postgres psql -U agrobridge agrobridge_dev < $$LATEST; \
		echo "$(GREEN)✅ Database restored from $$LATEST$(NC)"; \
	else \
		echo "$(RED)No backup files found$(NC)"; \
	fi

# ══════════════════════════════════════════════════════════════════════════════
# TESTING
# ══════════════════════════════════════════════════════════════════════════════

test: ## Run all tests
	@echo "$(YELLOW)Running all tests...$(NC)"
	npm test

test-unit: ## Run unit tests
	npm run test:unit

test-integration: ## Run integration tests
	npm run test:integration

test-e2e: ## Run end-to-end tests
	npm run test:e2e

test-coverage: ## Run tests with coverage
	npm run test:coverage

test-watch: ## Run tests in watch mode
	npx vitest

test-load: ## Run k6 load tests (smoke)
	@echo "$(YELLOW)Running smoke tests...$(NC)"
	./tests/load/k6/run-all.sh --smoke-only

test-load-full: ## Run full load tests
	@echo "$(YELLOW)Running full load tests...$(NC)"
	./tests/load/k6/run-all.sh

test-load-stress: ## Run stress tests
	@echo "$(YELLOW)Running stress tests...$(NC)"
	./tests/load/k6/run-all.sh --stress

# ══════════════════════════════════════════════════════════════════════════════
# CODE QUALITY
# ══════════════════════════════════════════════════════════════════════════════

lint: ## Run ESLint
	npm run lint

lint-fix: ## Fix ESLint issues
	npm run lint:fix

format: ## Format code with Prettier
	npm run format

format-check: ## Check code formatting
	npm run format:check

type-check: ## Run TypeScript type checking
	npm run type-check

check: lint format-check type-check ## Run all code quality checks

# ══════════════════════════════════════════════════════════════════════════════
# SECURITY
# ══════════════════════════════════════════════════════════════════════════════

security-audit: ## Run npm security audit
	@echo "$(YELLOW)Running security audit...$(NC)"
	npm audit --audit-level moderate

security-scan: ## Scan Docker image with Trivy
	@echo "$(YELLOW)Scanning Docker image for vulnerabilities...$(NC)"
	docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
		aquasec/trivy image $(IMAGE_NAME):latest

# ══════════════════════════════════════════════════════════════════════════════
# DEPLOYMENT
# ══════════════════════════════════════════════════════════════════════════════

deploy-staging: ## Deploy to staging environment
	@echo "$(YELLOW)Deploying to staging...$(NC)"
	./scripts/deploy-k8s.sh staging $(VERSION)

deploy-production: ## Deploy to production environment
	@echo "$(RED)Deploying to PRODUCTION...$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ]
	./scripts/deploy-k8s.sh production $(VERSION)

rollback: ## Rollback to previous version
	@echo "$(YELLOW)Rolling back...$(NC)"
	./scripts/rollback.sh

# ══════════════════════════════════════════════════════════════════════════════
# KUBERNETES
# ══════════════════════════════════════════════════════════════════════════════

k8s-apply: ## Apply Kubernetes manifests
	@echo "$(YELLOW)Applying Kubernetes manifests...$(NC)"
	kubectl apply -f k8s/base/

k8s-delete: ## Delete Kubernetes resources
	@echo "$(RED)Deleting Kubernetes resources...$(NC)"
	kubectl delete -f k8s/base/

k8s-status: ## Check Kubernetes deployment status
	@echo "$(BLUE)Kubernetes Deployment Status:$(NC)"
	kubectl get pods -n agrobridge
	@echo ""
	kubectl get services -n agrobridge
	@echo ""
	kubectl get hpa -n agrobridge

k8s-logs: ## View Kubernetes pod logs
	kubectl logs -f -l app=agrobridge-api -n agrobridge

k8s-describe: ## Describe pods
	kubectl describe pods -l app=agrobridge-api -n agrobridge

k8s-port-forward: ## Port forward API service
	kubectl port-forward svc/agrobridge-api 3000:80 -n agrobridge

# ══════════════════════════════════════════════════════════════════════════════
# MONITORING
# ══════════════════════════════════════════════════════════════════════════════

stats: ## Show Docker container stats
	docker stats --no-stream

health: ## Check health of all services
	@echo "$(BLUE)Service Health Check:$(NC)"
	@echo ""
	@curl -s http://localhost:3000/health | jq . 2>/dev/null || echo "API: $(RED)Not responding$(NC)"
	@echo ""

metrics: ## View application metrics
	@curl -s http://localhost:3000/metrics 2>/dev/null || echo "Metrics endpoint not available"

# ══════════════════════════════════════════════════════════════════════════════
# CLEANUP
# ══════════════════════════════════════════════════════════════════════════════

clean: ## Remove containers and volumes
	@echo "$(YELLOW)Cleaning up...$(NC)"
	$(DOCKER_COMPOSE_DEV) down -v --remove-orphans
	@echo "$(GREEN)✅ Cleanup complete$(NC)"

clean-all: ## Remove everything including images
	@echo "$(RED)WARNING: This will remove all containers, volumes, and images!$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ]
	$(DOCKER_COMPOSE_DEV) down -v --rmi all --remove-orphans
	docker system prune -af
	@echo "$(GREEN)✅ Full cleanup complete$(NC)"

clean-node: ## Remove node_modules
	rm -rf node_modules
	rm -rf dist

# ══════════════════════════════════════════════════════════════════════════════
# UTILITY
# ══════════════════════════════════════════════════════════════════════════════

ps: ## List running containers
	$(DOCKER_COMPOSE_DEV) ps

images: ## List Docker images
	docker images | grep agrobridge

version: ## Show version information
	@echo "$(BLUE)Version Information:$(NC)"
	@echo "  Version:    $(VERSION)"
	@echo "  Commit:     $(GIT_COMMIT)"
	@echo "  Build Date: $(BUILD_DATE)"

env-check: ## Check required environment variables
	@echo "$(BLUE)Checking environment variables...$(NC)"
	@test -f .env && echo "  .env file: $(GREEN)Found$(NC)" || echo "  .env file: $(RED)Missing$(NC)"
	@test -f .env.production && echo "  .env.production: $(GREEN)Found$(NC)" || echo "  .env.production: $(RED)Missing$(NC)"
	@test -n "$$DATABASE_URL" && echo "  DATABASE_URL: $(GREEN)Set$(NC)" || echo "  DATABASE_URL: $(YELLOW)Not set$(NC)"
	@test -n "$$JWT_SECRET" && echo "  JWT_SECRET: $(GREEN)Set$(NC)" || echo "  JWT_SECRET: $(YELLOW)Not set$(NC)"

# ══════════════════════════════════════════════════════════════════════════════
# CI/CD HELPERS
# ══════════════════════════════════════════════════════════════════════════════

ci-build: ## Build for CI (no cache)
	docker build --no-cache --target runtime -t $(IMAGE_NAME):ci .

ci-test: ## Run CI tests
	npm run test:ci

ci-lint: lint format-check type-check ## Run all CI checks
