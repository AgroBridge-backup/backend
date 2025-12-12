# DevOps Implementation Plan: CI/CD & Observability

> **Audience:** DevOps Team, SRE, Engineering Leads
> **Objective:** To establish a robust, automated CI/CD pipeline and a comprehensive monitoring stack to ensure the reliability, quality, and security of the backend service.
>
> ---
> **Last Reviewed:** 2025-11-20
> **Document Owner:** Head of DevOps

---
## English

### 1. Priority & Goal

**The #2 priority is to automate our quality and deployment processes.** Manual deployments are slow and risky. A professional CI/CD pipeline and observability stack are essential for moving fast safely.

*   **Goal:** A fully automated CI/CD pipeline deploying to a staging environment, and a production-ready observability stack by **Mid-Q2 2026**.

### 2. CI/CD Pipeline Implementation

*   **Platform:** **GitHub Actions** (chosen for its tight integration with our source code repository).
*   **Workflow File:** `.github/workflows/backend-ci-cd.yml`

#### **Workflow Definition (`backend-ci-cd.yml`)**

```yaml
name: Backend CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  build_and_test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js and pnpm
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install

      - name: Lint Check
        run: pnpm --filter @agrobridge/api lint

      - name: Test & Coverage
        run: pnpm --filter @agrobridge/api test:coverage

      - name: Documentation Link Check
        run: npx markdown-link-check **/*.md --quiet

      - name: Security Vulnerability Scan
        run: pnpm --filter @agrobridge/api snyk test

      - name: Build Docker Image
        if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
        run: |
          docker build -t my-registry/agrobridge-api:${{ github.sha }} .
          # Push to registry (e.g., AWS ECR)

  deploy_staging:
    needs: build_and_test
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Staging Environment (AWS ECS)
        run: |
          # AWS CLI commands to update ECS service with new Docker image
          echo "Deploying to Staging..."

  deploy_production:
    needs: build_and_test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production # Requires manual approval
    steps:
      - name: Deploy to Production Environment (AWS ECS)
        run: |
          # AWS CLI commands to update ECS service
          echo "Deploying to Production..."
```

### 3. Observability Stack Implementation

*   **Stack:** **Prometheus + Grafana** (chosen for being powerful, open-source, and cloud-agnostic).
*   **Plan:**
    1.  **Expose Metrics:** Add the `prom-client` library to the Node.js backend. Create a `/metrics` endpoint that exposes default Node.js metrics and custom application metrics (e.g., API request latency, error counts). This endpoint should be firewalled from public access.
    2.  **Deploy Prometheus:** Deploy a Prometheus instance in our AWS environment, configured to scrape the `/metrics` endpoint of all running API containers.
    3.  **Deploy Grafana:** Deploy a Grafana instance, configured with Prometheus as a data source.
    4.  **Create Dashboards:** Build a "Backend Health" dashboard in Grafana visualizing key KPIs (Uptime, Latency, Error Rate, RPS).
    5.  **Configure Alerting:** Use Alertmanager (with Prometheus) to define alert rules (e.g., "if error rate > 2% for 5 mins"). Configure alerts to push to a dedicated `#backend-alerts` Slack channel via webhook.

---
## Español

### 1. Prioridad y Objetivo

**La prioridad #2 es automatizar nuestros procesos de calidad y despliegue.** Un pipeline de CI/CD profesional y una pila de observabilidad son esenciales para moverse rápido y de forma segura.

*   **Objetivo:** Un pipeline de CI/CD completamente automatizado y una pila de observabilidad para **Mediados del Q2 2026**.

### 2. Implementación del Pipeline de CI/CD

*   **Plataforma:** **GitHub Actions**.
*   **Archivo de Flujo de Trabajo:** `.github/workflows/backend-ci-cd.yml`

#### **Definición del Flujo de Trabajo (`backend-ci-cd.yml`)**

El pipeline incluirá los siguientes "jobs":
1.  **`build_and_test`**: Se ejecuta en cada push y PR.
    *   Instala dependencias.
    *   Ejecuta Linter (`pnpm lint`).
    *   Ejecuta Pruebas (`pnpm test`).
    *   Verifica enlaces en la documentación (`markdown-link-check`).
    *   Escanea vulnerabilidades (`snyk test`).
    *   Construye la imagen de Docker.
2.  **`deploy_staging`**: Se ejecuta al fusionar a `develop`. Despliega la nueva imagen al entorno de Staging en AWS.
3.  **`deploy_production`**: Se ejecuta al fusionar a `main`. Requiere aprobación manual y despliega a Producción.

### 3. Implementación de la Pila de Observabilidad

*   **Stack:** **Prometheus + Grafana**.
*   **Plan:**
    1.  **Exponer Métricas:** Añadir la librería `prom-client` al backend. Crear un endpoint `/metrics` que exponga métricas de Node.js y de la aplicación (latencia, errores).
    2.  **Desplegar Prometheus:** Desplegar una instancia de Prometheus en AWS, configurada para "scrapear" el endpoint `/metrics` de todos los contenedores de la API.
    3.  **Desplegar Grafana:** Desplegar Grafana, configurado con Prometheus como fuente de datos.
    4.  **Crear Dashboards:** Construir un dashboard "Salud del Backend" en Grafana.
    5.  **Configurar Alertas:** Usar Alertmanager para definir reglas de alerta (ej. "si la tasa de error > 2% por 5 mins") y enviarlas a un canal de Slack `#backend-alerts`.
