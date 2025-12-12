# Doc 7: Globalization (i18n & a11y) Policy

> **Executive Summary:** This document outlines our strategy for global market readiness. Our backend supports Unicode data storage, but API messages are currently English-only. The roadmap includes implementing server-side i18n for localized error messages. Our API design supports frontend accessibility by providing structured, semantic data and adhering to RESTful principles, enabling the creation of WCAG-compliant user experiences.
>
> ---
> **Last Reviewed:** 2025-11-20
> **Document Owner:** Head of Product

---
## English

### 1. Business Impact Analysis

A global-ready platform can enter new international markets faster, increasing our Total Addressable Market (TAM). A commitment to accessibility broadens our user base and is often a requirement for enterprise and government contracts.

*   **Market Expansion:** |#######---| (7/10)
*   **User Inclusivity:** |########--| (8/10)
*   **Enterprise Readiness:** |######----| (6/10)

### 2. Internationalization (i18n) Strategy

*   **Current Status:** The database supports `UTF-8`. API messages are currently hardcoded in **English**.
*   **Roadmap:**
    1.  **Implement Server-Side i18n:** Integrate a library like `i18next` into the backend.
    2.  **Language Negotiation:** Use the `Accept-Language` header to determine the user's preferred language for response messages.
    3.  **Data Formatting:** The backend will always provide data in standard formats (ISO 8601 for dates, decimals for numbers). The **frontend** is responsible for locale-specific formatting (e.g., displaying `10.50` as `$10.50` or `10,50 €`).

### 3. Accessibility (a11y) Strategy

For a backend API, accessibility means providing a clear and predictable data contract so that frontends can build WCAG-compliant user interfaces.

*   **How We Support a11y:**
    *   **Structured JSON Responses:** Allows screen readers and other assistive technologies to interpret data logically.
    *   **Standard HTTP Status Codes:** Provides programmatic understanding of the outcome of an API call.
    *   **Clear Error Contracts:** Enables the frontend to build clear, non-confusing error states for all users.

---
## Español

### 1. Análisis de Impacto de Negocio

Una plataforma global puede entrar en nuevos mercados internacionales más rápido, aumentando nuestro Mercado Total Direccionable (TAM). El compromiso con la accesibilidad amplía nuestra base de usuarios y es a menudo un requisito para contratos empresariales y gubernamentales.

*   **Expansión de Mercado:** |#######---| (7/10)
*   **Inclusión de Usuarios:** |########--| (8/10)
*   **Preparación Empresarial:** |######----| (6/10)

### 2. Estrategia de Internacionalización (i18n)

*   **Estado Actual:** La base de datos soporta `UTF-8`. Los mensajes de la API están actualmente codificados en **inglés**.
*   **Roadmap:**
    1.  **Implementar i18n en el Servidor:** Integrar una librería como `i18next` en el backend.
    2.  **Negociación de Idioma:** Usar la cabecera `Accept-Language` para determinar el idioma preferido del usuario para los mensajes de respuesta.
    3.  **Formato de Datos:** El backend siempre proporcionará datos en formatos estándar (ISO 8601 para fechas, decimales para números). El **frontend** es responsable del formato específico de la configuración regional.

### 3. Estrategia de Accesibilidad (a11y)

Para una API de backend, la accesibilidad significa proporcionar un contrato de datos claro y predecible para que los frontends puedan construir interfaces de usuario que cumplan con WCAG.

*   **Cómo Apoyamos a11y:**
    *   **Respuestas JSON Estructuradas:** Permite que los lectores de pantalla interpreten los datos de forma lógica.
    *   **Códigos de Estado HTTP Estándar:** Proporciona una comprensión programática del resultado de una llamada a la API.
    *   **Contratos de Error Claros:** Permite al frontend construir estados de error claros para todos los usuarios.
