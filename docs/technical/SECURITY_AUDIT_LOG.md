# Investor Relations: Security & Compliance Transparency Log

> **Audience:** Investors, Auditors, Legal & Compliance
> **Objective:** To provide a single, immutable source of truth for the company's security posture and compliance history, building trust through radical transparency.
>
> ---
> **Last Reviewed:** 2025-11-20
> **Document Owner:** Chief Information Security Officer (CISO)

---
## English

### 1. Vision

This document serves as a historical log of all major security and compliance events. It is a living testament to our commitment to security. Access to the full, detailed reports linked below is restricted and can be requested by authorized parties.

### 2. Audit & Penetration Test Log

| Date       | Audit Type                 | Auditor / Firm      | Summary of Findings                                                               | Status      | Link to Full Report (Confidential) |
| :--------- | :------------------------- | :------------------ | :-------------------------------------------------------------------------------- | :---------- | :--------------------------------- |
| **Q3 2025**  | External Penetration Test  | Synack, Inc.        | No critical or high-severity vulnerabilities found. Two medium-severity findings related to server header configuration were identified and remediated. | **Completed** | `[Request Access]`                 |
| **Q1 2026**  | SOC 2 Type I Readiness     | A-LIGN              | Gap analysis performed. Remediation plan for control implementation is in progress. | **In Progress** | `[Request Access]`                 |
| **Q3 2026**  | External Penetration Test  | HackerOne           | (Scheduled)                                                                       | **Planned**   | `N/A`                              |

### 3. Compliance Milestone Tracker

| Regulation | Milestone                               | Target Date | Status      |
| :--------- | :-------------------------------------- | :---------- | :---------- |
| **GDPR**   | Data Processing Agreement Finalized     | Q4 2025     | **Completed** |
| **CCPA**   | Privacy Policy Updated for CCPA         | Q4 2025     | **Completed** |
| **SOC 2**  | All Controls Implemented for Type I     | Q2 2026     | **In Progress** |
| **ISO 27001**| Initial Gap Analysis                  | Q3 2026     | **Planned**   |

### 4. Real-time Security API

To further enhance transparency, a secure, investor-only API endpoint can be provided to query the date and status of the last successful security audit.

*   **Endpoint:** `GET /api/v1/investor/security-status`
*   **Response:**
    ```json
    {
      "last_audit_type": "External Penetration Test",
      "last_audit_date": "2025-09-15T00:00:00Z",
      "last_audit_result": "Passed (No Critical Findings)",
      "next_audit_scheduled": "2026-09-01T00:00:00Z"
    }
    ```

---
## Español

### 1. Visión

Este documento sirve como un registro histórico de todos los eventos importantes de seguridad y cumplimiento. Es un testimonio vivo de nuestro compromiso con la seguridad. El acceso a los informes completos y detallados enlazados a continuación está restringido.

### 2. Registro de Auditorías y Pruebas de Penetración

| Fecha      | Tipo de Auditoría            | Auditor / Firma     | Resumen de Hallazgos                                                              | Estado        | Enlace al Informe Completo (Confidencial) |
| :--------- | :--------------------------- | :------------------ | :-------------------------------------------------------------------------------- | :------------ | :---------------------------------------- |
| **T3 2025**  | Prueba de Penetración Externa| Synack, Inc.        | No se encontraron vulnerabilidades críticas o de alta severidad. Dos hallazgos de severidad media fueron identificados y remediados. | **Completado**  | `[Solicitar Acceso]`                      |
| **T1 2026**  | Preparación para SOC 2 Tipo I  | A-LIGN              | Análisis de brechas realizado. Plan de remediación para la implementación de controles en progreso. | **En Progreso** | `[Solicitar Acceso]`                      |
| **T3 2026**  | Prueba de Penetración Externa| HackerOne           | (Programado)                                                                      | **Planeado**    | `N/A`                                     |

### 3. Seguimiento de Hitos de Cumplimiento

| Regulación | Hito                                      | Fecha Objetivo | Estado        |
| :--------- | :---------------------------------------- | :------------- | :------------ |
| **GDPR**   | Acuerdo de Procesamiento de Datos Finalizado | T4 2025        | **Completado**  |
| **CCPA**   | Política de Privacidad Actualizada para CCPA | T4 2025        | **Completado**  |
| **SOC 2**  | Todos los Controles para Tipo I Implementados | T2 2026        | **En Progreso** |
| **ISO 27001**| Análisis de Brechas Inicial                 | T3 2026        | **Planeado**    |

### 4. API de Seguridad en Tiempo Real

Para mejorar aún más la transparencia, se puede proporcionar un endpoint de API seguro, solo para inversionistas, para consultar la fecha y el estado de la última auditoría de seguridad exitosa.

*   **Endpoint:** `GET /api/v1/investor/security-status`
*   **Respuesta:**
    ```json
    {
      "last_audit_type": "Prueba de Penetración Externa",
      "last_audit_date": "2025-09-15T00:00:00Z",
      "last_audit_result": "Aprobado (Sin Hallazgos Críticos)",
      "next_audit_scheduled": "2026-09-01T00:00:00Z"
    }
    ```
