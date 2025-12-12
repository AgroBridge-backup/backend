# Doc 13: AI-Ready Documentation & Assistants

> **Audience:** Engineering, DevOps, AI/ML Team
> **Objective:** To structure our documentation and APIs in a way that is easily consumable by AI agents, enabling automated support, onboarding, and analysis.
>
> ---
> **Last Reviewed:** 2025-11-20
> **Document Owner:** Head of Engineering / CTO

---
## English

### 1. Vision: Documentation as a Service (DaaS)

Our goal is to treat our documentation not as a static set of files, but as a queryable, machine-readable service. This allows AI agents to act as expert assistants for our team and partners, providing instant, accurate answers and automating tasks.

### 2. Structuring for AI Consumption

#### 2.1. API Documentation (OpenAPI)
*   **Standard:** The single source of truth for our API structure must be an **OpenAPI 3.x specification**.
*   **Generation:** This file (`openapi.yaml`) should be automatically generated from our source code. The Zod schemas in our route files provide the necessary request/response definitions, and the routes themselves define the paths and operations. Tools like `tsoa` or custom scripts can facilitate this.
*   **Benefit:** An OpenAPI spec allows AI tools (and Postman, etc.) to understand our API's capabilities, generate client code, and even formulate API calls automatically.

#### 2.2. FAQ and Knowledge Base (JSON Format)
To make our written guides machine-readable, we should maintain a parallel JSON version of our FAQs.

*   **Human-Friendly (Markdown):**
    > **How do I authenticate?**
    > You need to send a `POST` request to `/api/v1/auth/login`...

*   **AI-Friendly (JSON):**
    ```json
    {
      "faq": [
        {
          "question": "How do I authenticate to the API?",
          "short_answer": "Send a POST request to /api/v1/auth/login with your email and password to get a JWT.",
          "long_answer": "To authenticate, send an HTTP POST request to the `/api/v1/auth/login` endpoint with a JSON body containing your `email` and `password`. The server will return a JSON object with an `accessToken` and a `refreshToken`.",
          "related_endpoints": ["/api/v1/auth/login", "/api/v1/auth/refresh"]
        }
      ]
    }
    ```

### 3. Integrating AI Assistants

With AI-ready documentation, we can enable powerful new workflows.

*   **Onboarding Assistant:** A new developer could ask a custom GPT or Slackbot: "What are the steps to set up the backend?" The AI would parse `GETTING_STARTED.md` and provide a checklist.
*   **Technical Support Bot:** An engineer could ask, "What are the required fields to create a new batch?" The AI would consult the OpenAPI spec and provide the exact JSON structure.
*   **Proactive Improvement Suggestions:** An AI agent could be tasked to periodically scan our codebase and our documentation, and open GitHub issues for inconsistencies (e.g., "The `GET /producers` endpoint is documented but the use case appears to be a stub. Please verify implementation status.").

---
## Español

### 1. Visión: Documentación como Servicio (DaaS)

Nuestro objetivo es tratar nuestra documentación no como un conjunto de archivos estáticos, sino como un servicio consultable y legible por máquina. Esto permite que los agentes de IA actúen como asistentes expertos para nuestro equipo y socios, proporcionando respuestas instantáneas y precisas, y automatizando tareas.

### 2. Estructuración para el Consumo de IA

#### 2.1. Documentación de la API (OpenAPI)
*   **Estándar:** La única fuente de verdad para la estructura de nuestra API debe ser una **especificación OpenAPI 3.x**.
*   **Generación:** Este archivo (`openapi.yaml`) debe generarse automáticamente a partir de nuestro código fuente. Los esquemas de Zod en nuestros archivos de ruta proporcionan las definiciones de solicitud/respuesta necesarias.
*   **Beneficio:** Una especificación OpenAPI permite a las herramientas de IA entender las capacidades de nuestra API, generar código de cliente e incluso formular llamadas a la API automáticamente.

#### 2.2. FAQ y Base de Conocimiento (Formato JSON)
Para hacer nuestras guías legibles por máquina, debemos mantener una versión JSON paralela de nuestras FAQs.

*   **Para Humanos (Markdown):**
    > **¿Cómo me autentico?**
    > Necesitas enviar una solicitud `POST` a `/api/v1/auth/login`...

*   **Para IA (JSON):**
    ```json
    {
      "faq": [
        {
          "pregunta": "¿Cómo me autentico en la API?",
          "respuesta_corta": "Envía una solicitud POST a /api/v1/auth/login con tu email y contraseña para obtener un JWT.",
          "respuesta_larga": "Para autenticarte, envía una solicitud HTTP POST al endpoint `/api/v1/auth/login` con un cuerpo JSON que contenga tu `email` y `password`. El servidor devolverá un objeto JSON con un `accessToken` y un `refreshToken`.",
          "endpoints_relacionados": ["/api/v1/auth/login", "/api/v1/auth/refresh"]
        }
      ]
    }
    ```

### 3. Integración de Asistentes de IA

*   **Asistente de Onboarding:** Un nuevo desarrollador podría preguntar a un GPT personalizado o a un Slackbot: "¿Cuáles son los pasos para configurar el backend?" La IA analizaría `GETTING_STARTED.md` y proporcionaría una lista de verificación.
*   **Bot de Soporte Técnico:** Un ingeniero podría preguntar: "¿Cuáles son los campos requeridos para crear un nuevo lote?" La IA consultaría la especificación OpenAPI y proporcionaría la estructura JSON exacta.
*   **Sugerencias de Mejora Proactivas:** Se podría encargar a un agente de IA que escanee periódicamente nuestro código y documentación, y abra issues en GitHub por inconsistencias.
