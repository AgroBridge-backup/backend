# Doc 8: Health Monitoring & Success Metrics

> **Executive Summary:** This document defines our two-tiered monitoring strategy, tracking both operational health (uptime, latency) and business success (user activity). It establishes clear KPIs and provides an actionable guide for integrating live monitoring dashboards directly into our internal knowledge base (e.g., Notion/Confluence). This creates a "single pane of glass" for viewing system health and business performance in real time.
>
> ---
> **Last Reviewed:** 2025-11-20
> **Document Owner:** SRE & Product Team

---
## English

### 1. Observability Strategy

We monitor the system through the three pillars of observability:
*   **Logs:** For deep investigation (`Winston`).
*   **Metrics:** For high-level health dashboards (`Datadog`/`Grafana`).
*   **Traces:** For pinpointing performance bottlenecks.

### 2. Key Performance Indicators (KPIs)

#### Operational Metrics (SRE Team)
| Metric Name                        | Alert Threshold (Example)        |
| ---------------------------------- | -------------------------------- |
| **API Availability (Uptime)**      | < 99.9% over a 1-hour period    |
| **API Latency (p95)**              | > 500ms for 5 mins               |
| **Error Rate (5xx)**               | > 2% over a 15-min period        |

#### Business Metrics (Product & Leadership)
| Metric Name                        |
| ---------------------------------- |
| **Daily/Monthly Active Users (DAU/MAU)** |
| **New Batches Created per Day**    |

### 3. Live Metrics Integration

To make our data accessible, we will embed live dashboards directly into our internal wiki (Notion/Confluence).

*   **Goal:** Create a single, trusted page where any stakeholder can view the real-time health of the platform without needing to log into multiple services.
*   **Tool:** Grafana, Datadog, or any dashboarding tool that provides a "share" or "embed" feature.

#### **Example: Embedding a Grafana Dashboard**

1.  **In Grafana:**
    *   Navigate to the dashboard you want to share (e.g., "API Health Overview").
    *   Click the "Share" icon on a specific panel (e.g., "API Availability").
    *   Go to the "Embed" tab.
    *   Adjust the time range (e.g., "Last 1 hour") and copy the generated `<iframe>` code snippet.

2.  **In Notion/Confluence:**
    *   Edit the page where you want to display the graph.
    *   Use the `/embed` or `/html` block.
    *   Paste the `<iframe>` code snippet you copied from Grafana.

*   **Result:** A live, automatically refreshing graph of our API uptime will be visible directly on our internal documentation page, democratizing access to this critical information.

---
## Español

### 1. Estrategia de Observabilidad

Monitoreamos el sistema a través de los tres pilares de la observabilidad:
*   **Logs:** Para investigación profunda (`Winston`).
*   **Métricas:** Para paneles de salud de alto nivel (`Datadog`/`Grafana`).
*   **Trazas (Traces):** Para identificar cuellos de botella de rendimiento.

### 2. Indicadores Clave de Rendimiento (KPIs)

#### Métricas Operacionales (Equipo SRE)
| Nombre de la Métrica             | Umbral de Alerta (Ejemplo)       |
| ---------------------------------- | -------------------------------- |
| **Disponibilidad de la API (Uptime)** | < 99.9% en un período de 1 hora    |
| **Latencia de la API (p95)**       | > 500ms durante 5 mins           |
| **Tasa de Errores (5xx)**          | > 2% en un período de 15 mins    |

#### Métricas de Negocio (Producto y Liderazgo)
| Nombre de la Métrica             |
| ---------------------------------- |
| **Usuarios Activos Diarios/Mensuales** |
| **Nuevos Lotes Creados por Día**   |

### 3. Integración de Métricas en Vivo

Para hacer nuestros datos accesibles, incrustaremos dashboards en vivo directamente en nuestra wiki interna (Notion/Confluence).

*   **Objetivo:** Crear una única página de confianza donde cualquier stakeholder pueda ver la salud en tiempo real de la plataforma sin necesidad de iniciar sesión en múltiples servicios.
*   **Herramienta:** Grafana, Datadog, o cualquier herramienta de dashboards que ofrezca una función de "compartir" o "incrustar".

#### **Ejemplo: Incrustar un Dashboard de Grafana**

1.  **En Grafana:**
    *   Navegue al dashboard que desea compartir (ej. "Resumen de Salud de la API").
    *   Haga clic en el icono "Compartir" en un panel específico (ej. "Disponibilidad de la API").
    *   Vaya a la pestaña "Embed".
    *   Ajuste el rango de tiempo (ej. "Última 1 hora") y copie el fragmento de código `<iframe>` generado.

2.  **En Notion/Confluence:**
    *   Edite la página donde desea mostrar el gráfico.
    *   Use el bloque `/embed` o `/html`.
    *   Pegue el fragmento de código `<iframe>` que copió de Grafana.

*   **Resultado:** Un gráfico en vivo y que se actualiza automáticamente de nuestro uptime de la API será visible directamente en nuestra página de documentación interna, democratizando el acceso a esta información crítica.