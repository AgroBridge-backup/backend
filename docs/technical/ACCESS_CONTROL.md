# Doc for Access Control

> **Executive Summary:** This document details our Role-Based Access Control (RBAC) framework, a cornerstone of our security model. It defines our core user roles (Admin, Producer, etc.) and explains how permissions are enforced at the API level via a dedicated authentication middleware. This layered approach of Authentication + Authorization ensures users can only access data they are explicitly permitted to see, significantly reducing security risks.
>
> ---
> **Last Reviewed:** 2025-11-20
> **Document Owner:** Security Team

---
## English

### 1. Business Impact Analysis

A granular access control system is not optional; it is essential for building trust with enterprise customers, ensuring data privacy, and passing security audits. It directly prevents unauthorized users from accessing sensitive business or personal data.

*   **Data Security:** |##########| (10/10)
*   **Compliance (GDPR/CCPA):** |#########-| (9/10)
*   **Enterprise Readiness:** |##########| (10/10)

### 2. Access Control Framework

> **Analogy:** **Authentication** is the guard checking your ID at the front door. **Authorization (RBAC)** is the keycard that only opens the specific rooms you're allowed to enter.

*   **User Roles:** `ADMIN`, `PRODUCER`, `CERTIFIER`, `BUYER`. Each `User` in the database has one role.
*   **Technical Implementation:**
    1.  A user logs in and receives a JWT containing their `role`.
    2.  Endpoints are protected by an `authenticate()` middleware.
    3.  The middleware checks if the user's role is in the allowed list for that endpoint (e.g., `authenticate([UserRole.ADMIN])`).
    4.  If the check fails, the request is rejected with a `403 Forbidden` error.

---
## Español

### 1. Análisis de Impacto de Negocio

Un sistema de control de acceso granular es esencial para construir confianza con clientes empresariales, asegurar la privacidad de los datos y pasar auditorías de seguridad. Previene directamente que usuarios no autorizados accedan a datos sensibles.

*   **Seguridad de Datos:** |##########| (10/10)
*   **Cumplimiento (GDPR/CCPA):** |#########-| (9/10)
*   **Preparación Empresarial:** |##########| (10/10)

### 2. Marco de Control de Acceso

> **Analogía:** La **Autenticación** es el guardia que comprueba tu DNI en la puerta. La **Autorización (RBAC)** es la tarjeta de acceso que solo abre las habitaciones a las que tienes permiso para entrar.

*   **Roles de Usuario:** `ADMIN`, `PRODUCER`, `CERTIFIER`, `BUYER`. Cada `User` en la base de datos tiene un rol.
*   **Implementación Técnica:**
    1.  Un usuario inicia sesión y recibe un JWT que contiene su `role`.
    2.  Los endpoints están protegidos por un middleware `authenticate()`.
    3.  El middleware comprueba si el rol del usuario está en la lista de roles permitidos para ese endpoint (ej. `authenticate([UserRole.ADMIN])`).
    4.  Si la comprobación falla, la solicitud es rechazada con un error `403 Forbidden`.
