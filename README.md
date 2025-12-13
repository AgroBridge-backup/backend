![Backend QA CI](https://github.com/AgroBridge/backend/actions/workflows/ci-backend.yml/badge.svg)

# CI/CD Test - 2025-12-13 18:41:00 UTC
# Security Group Fixed - Retry Deploy - 2025-12-13 18:42:00 UTC
# Git Repository Fixed - Full Pipeline Test - 2025-12-13 18:50:00 UTC
# Infrastructure Complete - Node.js + PM2 + PostgreSQL - 2025-12-13 18:36:00 UTC

# 🌉 AGROBRIDGE INTERNATIONAL: PROTOCOLO DE TRAZABILIDAD CRIPTOGRÁFICA (V14.2)

---
**Propiedad Intelectual y Derechos Reservados**

Este código fuente, documentación, especificaciones técnicas y todos los artefactos relacionados con la plataforma AgroBridge™ son propiedad intelectual exclusiva de Alejandro Navarro Ayala y/o de AGROBRIDGE S.A. de C.V. (“la Empresa”). Queda estrictamente prohibida la reproducción, distribución, modificación, sublicencia o divulgación no autorizada de cualquier parte de este proyecto sin el consentimiento expreso y por escrito de la Empresa o Alejandro Navarro Ayala.

© 2025 Alejandro Navarro Ayala / AGROBRIDGE S.A. de C.V.
Todos los derechos reservados.
---
---
**Intellectual Property & All Rights Reserved**

This source code, documentation, technical specifications, and all artifacts related to the AgroBridge™ platform are the exclusive intellectual property of Alejandro Navarro Ayala and/or AGROBRIDGE S.A. de C.V. (“the Company”). Any reproduction, distribution, modification, sublicensing, or unauthorized disclosure of any portion of this project is strictly forbidden without the express written consent of the Company or Alejandro Navarro Ayala.

© 2025 Alejandro Navarro Ayala / AGROBRIDGE S.A. de C.V.
All rights reserved.
---

## 🎯 PROPÓSITO DEL PROYECTO

**AgroBridge International** es el sistema Enterprise de trazabilidad que garantiza
la inmutabilidad y certificación de calidad de productos agrícolas michoacanos
desde la Cosecha Cero hasta clientes B2B globales.

**🌐 Dominio Principal:** https://agrobridgeint.com  
**⚡ API Backend:** https://api.agrobridgeint.com  
**📊 Health Check:** https://api.agrobridgeint.com/api/v2/health

---

## 🏗️ ARQUITECTURA DEL REPOSITORIO

```
agrobridge/
├── index.js                    # Backend API Server (Express)
├── package.json
├── .env                        # Variables de entorno (NO COMMITEAR)
│
├── public_html/                # 🌐 FRONTEND PÚBLICO
│   ├── index.html             # Página principal
│   ├── scripts/
│   │   ├── api.service.js     # Cliente API
│   │   └── main.js            # Lógica UI
│   ├── styles/
│   │   └── main.css           # Estilos (inline en HTML)
│   └── assets/
│       └── images/
│
├── src/                        # 🔐 BACKEND CORE
│   ├── blockchain/
│   │   ├── BlockChain.js
│   │   ├── Block.js
│   │   └── Transaction.js
│   └── core/
│       ├── api.js
│       └── utils/
│           └── logger.js
│
└── tools/                      # 🛠️ DEVOPS
    ├── deploy/
    ├── tests/
    └── monitor/
```

---

## 💻 INSTALACIÓN

### 1. Clonar y Setup

```bash
git clone https://github.com/tu-org/agrobridge.git
cd agrobridge
npm install
```

### 2. Configurar Variables de Entorno

```bash
cp .env.example .env
nano .env
```

```bash
NODE_ENV=development
PORT=3000
ALLOWED_ORIGINS=http://localhost:8080,https://agrobridgeint.com
DOMAIN=agrobridgeint.com
API_DOMAIN=api.agrobridgeint.com
```

### 3. Iniciar Desarrollo

```bash
# Backend + Frontend
npm run dev

# Solo Backend
node index.js

# Frontend separado (opcional)
cd public_html
python -m http.server 8080
```

---

## 🔗 API ENDPOINTS

Base URL Production: `https://api.agrobridgeint.com`  
Base URL Development: `http://localhost:3000`

### Health Check

```bash
GET /api/v2/health
```

### Validar Trazabilidad

```bash
POST /api/v2/trace/validate
Content-Type: application/json

{
  "hash": "a1b2c3d4...64chars"
}
```

### Contacto Enterprise

```bash
POST /api/v2/contact
Content-Type: application/json

{
  "company_name": "Empresa XYZ",
  "company_email": "contact@empresa.com",
  "company_interest": "Interés en volumen..."
}
```

---

## 🚀 DEPLOYMENT

### Backend (Railway)

```bash
railway login
railway init
railway up
railway domain  # Obtener URL
```

### Frontend (Cloudflare Pages)

```bash
wrangler pages publish public_html --project-name=agrobridge
```

### DNS Configuration

```
Type    Name    Content
A       @       <server-ip>
A       www     <server-ip>
CNAME   api     <railway-url>
```

---

## 🧪 TESTING

```bash
# Backend health
curl https://api.agrobridgeint.com/api/v2/health

# Validación de trace
curl -X POST https://
```
