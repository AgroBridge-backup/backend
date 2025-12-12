# Doc 16: Transparency Dashboard

> **Audience:** All Stakeholders, Customers, Partners
> **Objective:** To build trust and provide transparency by creating a public-facing dashboard that displays key operational metrics and system status.
>
> ---
> **Last Reviewed:** 2025-11-20
> **Document Owner:** Head of SRE & Head of Product

---
## English

### 1. Vision & Purpose

In the spirit of trust and transparency, which is core to our mission, we will maintain a public dashboard. This dashboard provides a real-time, honest view of our platform's operational health. It serves both as a tool for our customers to check our status during an incident and as a public commitment to reliability.

### 2. Recommended Tool: Statuspage

*   **Tool:** **[Statuspage by Atlassian](https://www.atlassian.com/software/statuspage)** is the industry standard for this purpose.
*   **Why:** It is simple to use, recognized by users, and separates our status communication from our potentially-down infrastructure.

### 3. Dashboard Components

The dashboard will be available at `status.agrobridge.io` and will feature:

#### 3.1. Real-time Component Status
A list of our core services and their current status (`Operational`, `Degraded Performance`, `Partial Outage`, `Major Outage`).
*   **API Backend:** Status determined by automated checks against our `GET /health` endpoint.
*   **Frontend Application:** Status determined by an uptime check against the main website.
*   **Database:** Status monitored internally and updated manually during an incident.
*   **Blockchain Integration:** Status of our connection to the external ledger.

#### 3.2. Public Metrics
A small set of non-sensitive, high-level metrics to showcase platform health and activity.
*   **API Uptime (Last 90 Days):** A percentage calculated from our monitoring tools.
*   **Average API Response Time:** A rolling average of API latency.

#### 3.3. Incident History
A log of all past incidents, their resolution, and links to post-mortem reports. This demonstrates our commitment to learning and improvement.

### 4. Data Integration

*   **Automated Updates:** Uptime and latency metrics should be automatically pushed to the Statuspage API from our internal monitoring system (e.g., Datadog, Grafana, or a custom script).
*   **Manual Updates:** During an incident, the **Incident Commander** or **Communications Lead** is responsible for posting clear, regular updates to the Statuspage to keep customers informed.

---
## Español

### 1. Visión y Propósito

En el espíritu de confianza y transparencia, que es fundamental para nuestra misión, mantendremos un dashboard público. Este panel proporciona una visión honesta y en tiempo real de la salud operativa de nuestra plataforma. Sirve tanto como una herramienta para que nuestros clientes verifiquen nuestro estado durante un incidente como un compromiso público con la fiabilidad.

### 2. Herramienta Recomendada: Statuspage

*   **Herramienta:** **[Statuspage de Atlassian](https://www.atlassian.com/software/statuspage)** es el estándar de la industria para este propósito.
*   **Por qué:** Es fácil de usar, reconocido por los usuarios, y separa nuestra comunicación de estado de nuestra infraestructura, que podría estar caída.

### 3. Componentes del Dashboard

El dashboard estará disponible en `status.agrobridge.io` y presentará:

#### 3.1. Estado de Componentes en Tiempo Real
Una lista de nuestros servicios principales y su estado actual (`Operacional`, `Rendimiento Degradado`, `Interrupción Parcial`, `Interrupción Mayor`).
*   **API Backend:** Estado determinado por chequeos automatizados contra nuestro endpoint `GET /health`.
*   **Aplicación Frontend:** Estado determinado por un chequeo de uptime contra el sitio web principal.
*   **Base de Datos:** Estado monitoreado internamente y actualizado manualmente durante un incidente.
*   **Integración Blockchain:** Estado de nuestra conexión con el ledger externo.

#### 3.2. Métricas Públicas
Un pequeño conjunto de métricas no sensibles y de alto nivel para mostrar la salud y actividad de la plataforma.
*   **Uptime de la API (Últimos 90 días):** Un porcentaje calculado a partir de nuestras herramientas de monitoreo.
*   **Tiempo de Respuesta Promedio de la API:** Una media móvil de la latencia de la API.

#### 3.3. Historial de Incidentes
Un registro de todos los incidentes pasados, su resolución y enlaces a los informes post-mortem. Esto demuestra nuestro compromiso con el aprendizaje y la mejora.

### 4. Integración de Datos

*   **Actualizaciones Automatizadas:** Las métricas de uptime y latencia deben ser enviadas automáticamente a la API de Statuspage desde nuestro sistema de monitoreo interno (ej. Datadog, Grafana).
*   **Actualizaciones Manuales:** Durante un incidente, el **Comandante del Incidente** o el **Líder de Comunicaciones** es responsable de publicar actualizaciones claras y regulares en la Statuspage para mantener informados a los clientes.
