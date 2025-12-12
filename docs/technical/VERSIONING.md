# Doc 3: Versioning, Release & Documentation Quality Policy

> **Executive Summary:** This document outlines our strict adherence to Semantic Versioning and a Git Flow-based release process. This policy now includes two mandatory quality gates in our CI/CD pipeline: an automated documentation linter to prevent doc-code drift, and an automated link checker to ensure all references are valid. Documentation versions are tied directly to software versions, ensuring they remain in sync.
>
> ---
> **Last Reviewed:** 2025-11-20
> **Document Owner:** Backend Platform Team

---
## English

### 1. Documentation Versioning Policy

*   **Principle:** Documentation is code. Its version must match the software version it describes.
*   **Process:** When a `MINOR` or `MAJOR` software version is released, the documentation must be updated to reflect those changes. The "Document Version" at the top of each file should be updated accordingly. A `CHANGELOG` section should be added to the end of the modified document.
*   **Example Changelog Entry:**
    ```
    ---
    ### Change Log
    *   **v2.2.0:** Added new section on "External Collaboration." Updated diagrams.
    *   **v2.1.1:** Corrected typo in an example code snippet.
    ```

### 2. Software Versioning & Release Process

We strictly follow **Semantic Versioning (`MAJOR.MINOR.PATCH`)** and a **Git Flow** branching model (`main`, `develop`, `feature/*`).

### 3. Automated Quality Gates

To ensure the quality of both our code and our documentation, the following checks are **mandatory** and will be automated in our CI/CD pipeline for every Pull Request.

#### 3.1. Code Quality Gates
*   `pnpm test`: All unit, integration, and E2E tests must pass.
*   `pnpm lint`: Code must adhere to our established linting rules.
*   `snyk test`: The code must have zero known critical vulnerabilities in its dependencies.

#### 3.2. Documentation Quality Gates
*   **Automated Link Validation:**
    *   **Tool:** `markdown-link-check`
    *   **Action:** A script runs `npx markdown-link-check **/*.md` on all changed markdown files.
    *   **Rule:** The PR will be **blocked** if any broken internal or external links are detected. A report like `REPORT_LINK_VALIDATION.md` will be generated.
*   **Automated Style & Grammar Check:**
    *   **Tool:** `vale`
    *   **Action:** A script runs `vale docs/` to check against our style guide.
    *   **Rule:** The PR will be **blocked** for major style violations.

---
## Español

### 1. Política de Versionado de la Documentación

*   **Principio:** La documentación es código. Su versión debe coincidir con la versión del software que describe.
*   **Proceso:** Cuando se lanza una versión `MENOR` o `MAYOR` del software, la documentación debe actualizarse para reflejar esos cambios. La "Versión del Documento" en la parte superior de cada archivo debe actualizarse. Se debe añadir una sección `CHANGELOG` (Registro de Cambios) al final del documento modificado.
*   **Ejemplo de Registro de Cambios:**
    ```
    ---
    ### Registro de Cambios
    *   **v2.2.0:** Añadida nueva sección sobre "Colaboración Externa." Diagramas actualizados.
    *   **v2.1.1:** Corregido error tipográfico en un fragmento de código de ejemplo.
    ```

### 2. Versionado de Software y Proceso de Lanzamiento

Seguimos estrictamente el **Versionado Semántico (`MAYOR.MENOR.PARCHE`)** y un modelo de ramas **Git Flow** (`main`, `develop`, `feature/*`).

### 3. Controles de Calidad Automatizados

Para asegurar la calidad tanto de nuestro código como de nuestra documentación, las siguientes verificaciones son **obligatorias** y se automatizarán en nuestro pipeline de CI/CD para cada Pull Request.

#### 3.1. Controles de Calidad del Código
*   `pnpm test`: Todas las pruebas deben pasar.
*   `pnpm lint`: El código debe adherirse a nuestras reglas de linting.
*   `snyk test`: El código no debe tener vulnerabilidades críticas conocidas en sus dependencias.

#### 3.2. Controles de Calidad de la Documentación
*   **Validación Automática de Enlaces:**
    *   **Herramienta:** `markdown-link-check`
    *   **Acción:** Un script ejecuta `npx markdown-link-check **/*.md` en todos los archivos markdown modificados.
    *   **Regla:** El PR será **bloqueado** si se detectan enlaces rotos. Se generará un informe como `REPORT_LINK_VALIDATION.md`.
*   **Verificación Automática de Estilo y Gramática:**
    *   **Herramienta:** `vale`
    *   **Acción:** Un script ejecuta `vale docs/` para verificar contra nuestra guía de estilo.
    *   **Regla:** El PR será **bloqueado** por violaciones de estilo mayores.
