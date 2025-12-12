# Doc 15: Open Source Program & Contribution Policy

> **Audience:** Engineering, Legal, External Developers
> **Objective:** To define the company's policy on using and contributing to open-source software (OSS), and to establish a framework for potentially open-sourcing some of our own non-critical tools.
>
> ---
> **Last Reviewed:** 2025-11-20
> **Document Owner:** Head of Engineering & Legal Counsel

---
## English

### 1. Philosophy

We are built on open source, and we believe in giving back to the community. Our policy is to "consume responsibly and contribute meaningfully." We also believe that open-sourcing non-core libraries can improve their quality through community feedback and enhance our brand as a technology leader.

### 2. Contributing to External Projects

*   **Process:**
    1.  Any bug fix or minor improvement to an external OSS library developed during company time should be contributed back to the original project.
    2.  The developer should open a Pull Request to the upstream repository.
    3.  The PR must be reviewed internally by the developer's lead before being made public.
*   **Legal:** Contributions must adhere to the license of the upstream project. No company-confidential information may be included in the contribution.

### 3. Open-Sourcing Our Own Code

We may choose to open-source internal libraries that are not part of our core, proprietary business logic.

*   **Candidate Modules:** Generic utilities, helper libraries, or tools. (e.g., a custom `eslint` plugin we develop).
*   **Approval Process:** A proposal to open-source a new library must be approved by the CTO and Legal Counsel.
*   **Default License:** All company-initiated open-source projects will use the **MIT License** unless otherwise specified.
*   **Core Files:** All of our open-source projects must contain:
    *   `LICENSE` file
    *   `README.md`
    *   `CONTRIBUTING.md` (explaining the contribution process)
    *   `CODE_OF_CONDUCT.md`

### 4. Community & Contribution Governance

*   **Official Channels:** All community interaction for our OSS projects will happen on **GitHub**.
*   **Contribution Process:**
    1.  Fork the repository.
    2.  Create a feature branch.
    3.  Submit a Pull Request with a clear description of the changes.
    4.  All PRs must pass automated CI checks (testing, linting).
    5.  A designated internal maintainer must review and approve the PR. We will strive to provide feedback on all PRs within 7 business days.

---
## Español

### 1. Filosofía

Estamos construidos sobre código abierto, y creemos en retribuir a la comunidad. Nuestra política es "consumir responsablemente y contribuir significativamente". También creemos que abrir el código de librerías no centrales puede mejorar su calidad a través del feedback de la comunidad y potenciar nuestra marca como líder tecnológico.

### 2. Contribuciones a Proyectos Externos

*   **Proceso:**
    1.  Cualquier corrección de error o mejora menor a una librería OSS externa desarrollada en tiempo de la empresa debe ser contribuida de vuelta al proyecto original.
    2.  El desarrollador debe abrir un Pull Request al repositorio upstream.
    3.  El PR debe ser revisado internamente por el líder del desarrollador antes de hacerse público.
*   **Legal:** Las contribuciones deben adherirse a la licencia del proyecto upstream. No se puede incluir información confidencial de la empresa.

### 3. Abriendo Nuestro Propio Código

Podemos decidir abrir el código de librerías internas que no forman parte de nuestra lógica de negocio principal y propietaria.

*   **Módulos Candidatos:** Utilidades genéricas, librerías de ayuda o herramientas.
*   **Proceso de Aprobación:** Una propuesta para abrir una nueva librería debe ser aprobada por el CTO y el Asesor Legal.
*   **Licencia por Defecto:** Todos los proyectos de código abierto iniciados por la empresa usarán la **Licencia MIT**, a menos que se especifique lo contrario.
*   **Archivos Centrales:** Todos nuestros proyectos OSS deben contener `LICENSE`, `README.md`, `CONTRIBUTING.md`, y `CODE_OF_CONDUCT.md`.

### 4. Gobernanza de la Comunidad y Contribuciones

*   **Canales Oficiales:** Toda la interacción comunitaria para nuestros proyectos OSS ocurrirá en **GitHub**.
*   **Proceso de Contribución:**
    1.  Hacer un "fork" del repositorio.
    2.  Crear una rama de feature.
    3.  Enviar un Pull Request con una descripción clara de los cambios.
    4.  Todos los PRs deben pasar las verificaciones de CI automatizadas.
    5.  Un mantenedor interno designado debe revisar y aprobar el PR. Nos esforzaremos por dar feedback en todos los PRs en un plazo de 7 días hábiles.
