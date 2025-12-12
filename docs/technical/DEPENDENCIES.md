# Doc 11: Critical Dependencies & Software Supply Chain

> **Executive Summary:** This document lists the core open-source packages foundational to our backend. It establishes a clear policy for managing this "Software Supply Chain," emphasizing reproducible builds via lockfiles and proactive security through automated vulnerability scanning (`snyk`) in our CI/CD pipeline. This governance minimizes risk from third-party code and ensures system stability.
>
> ---
> **Last Reviewed:** 2025-11-20
> **Document Owner:** Backend Platform Team & CISO

---
## English

### 1. Business Impact Analysis

Properly managing our software supply chain is a critical security function. It prevents vulnerabilities from external packages from entering our system and ensures that all builds are stable and reproducible, which is crucial for reliable deployments.

*   **Security Posture:** |#########-| (9/10)
*   **System Stability:** |##########| (10/10)
*   **Compliance:** |########--| (8/10)

### 2. Core Dependencies

| Dependency         | Why it's Critical                                     | Maintainer / Official Source                                       |
| ------------------ | ----------------------------------------------------- | ------------------------------------------------------------------ |
| **`express`**      | The fundamental framework for our entire web server.  | [npm](https://www.npmjs.com/package/express) / [GitHub](https://github.com/expressjs/express) |
| **`@prisma/client`** | The only way our application communicates with the database. | [npm](https://www.npmjs.com/package/@prisma/client) / [GitHub](https://github.com/prisma/prisma) |
| **`jsonwebtoken`** | The core of our authentication and session management. | [npm](https://www.npmjs.com/package/jsonwebtoken) / [GitHub](https://github.com/auth0/node-jsonwebtoken) |
| **`bcryptjs`**     | Responsible for securely hashing all user passwords.   | [npm](https://www.npmjs.com/package/bcryptjs) / [GitHub](https://github.com/dcodeIO/bcrypt.js) |
| **`zod`**          | Our first line of defense against invalid data via input validation. | [npm](https://www.npmjs.com/package/zod) / [GitHub](https://github.com/colinhacks/zod) |

### 3. Dependency Management Policy

*   **Reproducible Builds:** We use a lockfile (`pnpm-lock.yaml`) to ensure that every developer and every build process installs the *exact same version* of every dependency.
*   **Automated Security Scanning:** `snyk test` **must** be integrated as a required check in our CI/CD pipeline before any code can be merged to `develop` or `main`.
*   **Regular Updates:** Dependencies are reviewed quarterly.

---
## Español

### 1. Análisis de Impacto de Negocio

Gestionar adecuadamente nuestra cadena de suministro de software es una función de seguridad crítica. Previene que vulnerabilidades de paquetes externos entren en nuestro sistema y asegura que todas las compilaciones sean estables y reproducibles, lo cual es crucial para despliegues fiables.

*   **Postura de Seguridad:** |#########-| (9/10)
*   **Estabilidad del Sistema:** |##########| (10/10)
*   **Cumplimiento:** |########--| (8/10)

### 2. Dependencias Principales

| Dependencia        | Por qué es Crítica                                      | Responsable / Fuente Oficial                                       |
| ------------------ | ----------------------------------------------------- | ------------------------------------------------------------------ |
| **`express`**      | El framework fundamental para todo nuestro servidor web. | [npm](https://www.npmjs.com/package/express) / [GitHub](https://github.com/expressjs/express) |
| **`@prisma/client`** | La única forma en que nuestra aplicación se comunica con la base de datos. | [npm](https://www.npmjs.com/package/@prisma/client) / [GitHub](https://github.com/prisma/prisma) |
| **`jsonwebtoken`** | El núcleo de nuestra autenticación y gestión de sesiones. | [npm](https://www.npmjs.com/package/jsonwebtoken) / [GitHub](https://github.com/auth0/node-jsonwebtoken) |
| **`bcryptjs`**     | Responsable de hashear de forma segura todas las contraseñas de los usuarios. | [npm](https://www.npmjs.com/package/bcryptjs) / [GitHub](https://github.com/dcodeIO/bcrypt.js) |
| **`zod`**          | Nuestra primera línea de defensa contra datos inválidos mediante la validación de entradas. | [npm](https://www.npmjs.com/package/zod) / [GitHub](https://github.com/colinhacks/zod) |

### 3. Política de Gestión de Dependencias

*   **Builds Reproducibles:** Usamos un lockfile (`pnpm-lock.yaml`) para asegurar que cada desarrollador y cada proceso de build instale la *versión exacta* de cada dependencia.
*   **Escaneo de Seguridad Automatizado:** `snyk test` **debe** integrarse como una verificación obligatoria en nuestro pipeline de CI/CD.
*   **Actualizaciones Regulares:** Las dependencias se revisan trimestralmente.
