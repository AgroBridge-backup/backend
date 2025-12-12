# Enterprise Report: Known Issues Log

> **Report Date:** 2025-11-20
> **Status:** Active
> **Owner:** Head of Engineering
>
> ---
>
> ## English
>
> ### **Executive Summary**
>
> This document provides a transparent log of known, non-critical issues identified during architectural and operational analysis. All listed items are considered low-to-medium priority with no immediate impact on production stability, but are tracked for resolution to reduce technical debt and improve the developer experience. The primary issue is the presence of stubbed, incomplete business logic in several core use cases.
>
> ### **1. Purpose**
>
> This log serves as a proactive registry of minor environmental inconsistencies, warnings, and incomplete implementations. Its goal is to provide full transparency to the engineering team and to guide backlog prioritization for technical debt sprints.
>
> ### **2. Known Issues & Remediation Plan**
>
> | ID  | Issue Description                                       | Priority | Impact Analysis                                                              | Recommended Remediation Action                                                                       |
> | --- | ------------------------------------------------------- | -------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
> | 001 | **Incomplete Business Logic (Use Case Stubs)**          | **High** | Core product features are non-functional. Blocks product launch and user value. | **Action:** Dedicate engineering sprints to implement the logic for all stubbed use cases (e.g., `ListProducersUseCase`). See `ROADMAP.md`. |
> | 002 | **Frontend Build Failures (Vercel Deployment Logs)**      | Medium   | Blocks frontend deployment and end-to-end testing. Indicates dependency or configuration conflicts in the monorepo. | **Action:** Execute the "Nuke and Pave" protocol detailed in the Vercel deployment failure logs (see `GEMINI.md`, 2025-11-20). |
> | 003 | **Lack of Automated Documentation Linter in CI/CD**       | Medium   | Risk of documentation becoming outdated as code changes, increasing onboarding time and potential for errors. | **Action:** Integrate `Vale` or `markdownlint` into the GitHub Actions pipeline as a required check on all PRs. See `VERSIONING.md`. |
> | 004 | **Lack of Automated Dependency Vulnerability Scan in CI/CD** | Medium | Potential for security vulnerabilities from open-source packages to enter the `main` branch undetected. | **Action:** Integrate `snyk test` as a required check in the GitHub Actions pipeline. |
> | 005 | **Missing `pnpm-lock.yaml` in `/agrobridge-corazon`** | Low      | Can lead to non-reproducible frontend builds between developers and CI.   | **Action:** Run `pnpm install` within the `/agrobridge-corazon` directory and commit the generated `pnpm-lock.yaml` file. |
>
> ---
> ## Español
>
> ### **Resumen Ejecutivo**
>
> Este documento proporciona un registro transparente de problemas conocidos no críticos identificados durante el análisis arquitectónico y operativo. Todos los elementos listados se consideran de prioridad baja a media sin impacto inmediato en la estabilidad de producción, pero se rastrean para su resolución con el fin de reducir la deuda técnica y mejorar la experiencia del desarrollador. El problema principal es la presencia de lógica de negocio incompleta (stubs) en varios casos de uso centrales.
>
> ### **1. Propósito**
>
> Este registro sirve como un listado proactivo de inconsistencias ambientales menores, advertencias e implementaciones incompletas. Su objetivo es proporcionar total transparencia al equipo de ingeniería y guiar la priorización del backlog para los sprints de deuda técnica.
>
> ### **2. Incidencias Conocidas y Plan de Remediación**
>
> | ID  | Descripción de la Incidencia                            | Prioridad | Análisis de Impacto                                                          | Acción de Remediación Recomendada                                                                    |
> | --- | ------------------------------------------------------- | --------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
> | 001 | **Lógica de Negocio Incompleta (Stubs de Casos de Uso)**  | **Alta**  | Las características principales del producto no son funcionales. Bloquea el lanzamiento del producto. | **Acción:** Dedicar sprints de ingeniería para implementar la lógica de todos los casos de uso incompletos (ej. `ListProducersUseCase`). Ver `ROADMAP.md`. |
> | 002 | **Fallos de Build del Frontend (Logs de Despliegue en Vercel)** | Media   | Bloquea el despliegue del frontend y las pruebas end-to-end. Indica conflictos de dependencias en el monorepo. | **Acción:** Ejecutar el protocolo "Nuke and Pave" detallado en los logs de fallo de despliegue de Vercel (ver `GEMINI.md`, 2025-11-20). |
> | 003 | **Falta de Linter de Documentación Automatizado en CI/CD**  | Media     | Riesgo de que la documentación se desactualice, aumentando el tiempo de onboarding y el potencial de errores. | **Acción:** Integrar `Vale` o `markdownlint` en el pipeline de GitHub Actions como una verificación obligatoria en todos los PRs. Ver `VERSIONING.md`. |
> | 004 | **Falta de Escaneo de Vulnerabilidades Automatizado en CI/CD** | Media   | Posibilidad de que vulnerabilidades de paquetes de código abierto entren en la rama `main` sin ser detectadas. | **Acción:** Integrar `snyk test` como una verificación obligatoria en el pipeline de GitHub Actions. |
> | 005 | **Falta de `pnpm-lock.yaml` en `/agrobridge-corazon`** | Baja      | Puede llevar a builds del frontend no reproducibles entre desarrolladores y la CI. | **Acción:** Ejecutar `pnpm install` dentro del directorio `/agrobridge-corazon` y hacer commit del archivo `pnpm-lock.yaml` generado. |
