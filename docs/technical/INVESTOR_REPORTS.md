# Investor Relations: Automated Reporting

> **Audience:** Investors, Board of Directors
> **Objective:** To establish an automated, transparent, and efficient process for delivering regular progress reports to our key financial stakeholders.
>
> ---
> **Last Reviewed:** 2025-11-20
> **Document Owner:** CEO / Head of Investor Relations

---
## English

### 1. Vision & Process

To ensure our investors are always informed, we will automate the generation and delivery of a comprehensive "Monthly Progress Report." This process runs independently and requires no manual intervention.

*   **Trigger:** A scheduled CRON job runs on the first business day of every month.
*   **Action:** The job executes a Node.js script that:
    1.  Fetches the latest KPIs from the database (e.g., user growth, platform activity).
    2.  Fetches a summary of recently completed and upcoming milestones from the `ROADMAP.md` file or a database equivalent.
    3.  Fetches a summary of the latest compliance status from `SECURITY_AUDIT_LOG.md`.
    4.  Renders this data into a professional HTML email template.
    5.  Uses a transactional email service (e.g., Nodemailer with AWS SES, SendGrid) to send the report to a curated list of investor email addresses.

### 2. Sample Implementation: Nodemailer Script

This code snippet illustrates how the email delivery could be handled.

```typescript
import nodemailer from 'nodemailer';
import { getKpis, getRoadmapSummary, getComplianceStatus } from './reportData';

async function sendMonthlyReport() {
  // 1. Configure the email transporter (using secure env variables)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // 2. Fetch all data for the report
  const kpis = await getKpis();
  const roadmap = await getRoadmapSummary();
  const compliance = await getComplianceStatus();

  // 3. Render the HTML from a template
  const reportHtml = renderReportHTML({ kpis, roadmap, compliance });

  // 4. Send the email to the investor mailing list
  await transporter.sendMail({
    from: '"AgroBridge CEO" <ceo@agrobridge.io>',
    to: process.env.INVESTOR_MAILING_LIST,
    subject: `AgroBridge Monthly Progress Report - ${new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}`,
    html: reportHtml,
  });

  console.log('Monthly investor reports sent successfully.');
}

// This function would be called by the CRON job
sendMonthlyReport().catch(console.error);
```

### 3. Report Template Structure

The `renderReportHTML` function should populate a template that includes:
*   A personal message from the CEO.
*   A "Highlights" section with 3-4 key KPI achievements.
*   A "Roadmap Progress" section showing recently completed milestones.
*   A "Compliance & Security" update.

---
## Español

### 1. Visión y Proceso

Para asegurar que nuestros inversionistas estén siempre informados, automatizaremos la generación y entrega de un "Informe de Progreso Mensual".

*   **Disparador (Trigger):** Un trabajo CRON programado se ejecuta el primer día hábil de cada mes.
*   **Acción:** El trabajo ejecuta un script de Node.js que:
    1.  Obtiene los últimos KPIs de la base de datos.
    2.  Obtiene un resumen de los hitos del roadmap.
    3.  Obtiene un resumen del estado de cumplimiento normativo.
    4.  Renderiza estos datos en una plantilla de correo electrónico HTML.
    5.  Utiliza un servicio de correo transaccional para enviar el informe a una lista de correos de inversionistas.

### 2. Ejemplo de Implementación: Script con Nodemailer

Este fragmento de código ilustra cómo se podría manejar el envío de correos.

```typescript
import nodemailer from 'nodemailer';
import { getKpis, getRoadmapSummary, getComplianceStatus } from './reportData';

async function sendMonthlyReport() {
  // 1. Configurar el transportador de correo
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  // 2. Obtener todos los datos para el informe
  const data = { /* ... */ };

  // 3. Renderizar el HTML desde una plantilla
  const reportHtml = renderReportHTML(data);

  // 4. Enviar el correo
  await transporter.sendMail({
    from: '"CEO de AgroBridge" <ceo@agrobridge.io>',
    to: process.env.INVESTOR_MAILING_LIST,
    subject: `Informe de Progreso Mensual de AgroBridge - ${new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' })}`,
    html: reportHtml,
  });
}
```

### 3. Estructura de la Plantilla del Informe

La función `renderReportHTML` debe poblar una plantilla que incluya:
*   Un mensaje personal del CEO.
*   Una sección de "Aspectos Destacados" con 3-4 logros clave de KPIs.
*   Una sección de "Progreso del Roadmap".
*   Una actualización de "Cumplimiento y Seguridad".
