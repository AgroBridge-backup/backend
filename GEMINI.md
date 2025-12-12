# GEMINI.md - Manual de Contexto y Operaciones del Proyecto AgroBridge

## 1. Resumen Ejecutivo del Proyecto

**AgroBridge 2.0** es una plataforma web de trazabilidad agrícola y comercio justo de clase mundial. Originalmente un prototipo desconectado, el proyecto fue sometido a una completa transformación para convertirlo en una aplicación de nivel empresarial robusta, segura y escalable.

El sistema está diseñado para conectar a productores agrícolas de Michoacán con un mercado global, garantizando la trazabilidad de los productos a través de un libro mayor inmutable (Ledger) y ofreciendo una experiencia de usuario premium inspirada en la filosofía de diseño de Jony Ive ("Naturalismo Digital").

### Arquitectura General:
*   **Modelo Híbrido:** El proyecto opera en un modelo de despliegue híbrido:
    *   **Frontend:** Una Aplicación de Página Única (SPA) servida como un sitio estático desde **SiteGround**.
    *   **Backend:** Una API de Node.js contenerizada y una base de datos PostgreSQL desplegadas en **AWS**.
*   **Frontend:** Aplicación de Página Única (SPA) construida con **Vite** y **JavaScript vanilla**, enfocada en un diseño limpio y animaciones fluidas con **GSAP**.
*   **Backend:** Una API robusta construida con **Node.js** y **Express**, siguiendo las mejores prácticas de seguridad y rendimiento.
*   **Base de Datos:** **PostgreSQL**, gestionada a través de un contenedor Docker para desarrollo y en AWS RDS para producción.
*   **Contenerización:** Toda la aplicación está contenerizada con **Docker** y orquestada con **Docker Compose** para un entorno de desarrollo consistente.

### Características Clave:
*   **Trazabilidad:** Un `LedgerService` simula la interacción con un libro mayor inmutable (preparado para AWS QLDB), presentando la historia de un producto de forma narrativa.
*   **Seguridad:** Autenticación por JWT, control de acceso por roles (RBAC), y un robusto conjunto de encabezados de seguridad gestionados por `helmet`.
*   **Internacionalización (i18n):** Soporte para más de 25 idiomas, con detección automática por IP y selección manual, gestionado por `i18next`.
*   **Headless CMS:** Una sección de noticias y artículos gestionada a través de archivos Markdown en el repositorio, servidos a través de una API, simulando una arquitectura de CMS desacoplado.
*   **Automatización (CI/CD):** Un pipeline completo en GitHub Actions que automatiza pruebas (unitarias, E2E, accesibilidad, seguridad) y el empaquetado de la aplicación.

## 2. Construcción y Ejecución

### Requisitos Previos:
*   Node.js v18.x (LTS)
*   npm v10.x
*   Docker y Docker Compose

### Instalación de Dependencias:
```bash
npm install
```

### Entorno de Desarrollo Local:
Este comando inicia el backend, la base de datos y el frontend de Vite con Hot-Reload.
```bash
docker-compose up -d && npm run dev
```

### Comandos Clave:
*   **Iniciar Backend (sin Docker):**
    ```bash
    npm run start:backend
    ```
*   **Construir Frontend para Producción:**
    *   Este comando genera la carpeta `dist` con todos los archivos estáticos listos para ser subidos a SiteGround.
    ```bash
    npm run build
    ```
*   **Previsualizar el Build de Producción Localmente:**
    *   Después de un `build`, este comando sirve la carpeta `dist` en un servidor local para una última verificación.
    ```bash
    npm run preview
    ```
*   **Ejecutar Pruebas:**
    ```bash
    npm test # Ejecuta pruebas unitarias con Jest
    npm run test:e2e # Ejecuta pruebas End-to-End con Cypress
    npm run test:security # Ejecuta un escaneo de vulnerabilidades con Snyk
    ```
*   **Migraciones de Base de Datos:**
    ```bash
    npm run migrate up # Aplica nuevas migraciones
    ```

## 3. Convenciones y Prácticas de Desarrollo

*   **Estilo de Código:** El proyecto sigue las convenciones estándar de JavaScript. El CSS utiliza la metodología **BEM (Block__Element--Modifier)** para nombrar las clases (ej: `nav__list`, `card__title`).
*   **API:** La API está versionada (`/api/v2/`) para permitir futuras evoluciones sin romper la compatibilidad.
*   **Testing:** Se espera que las nuevas características y correcciones de bugs incluyan pruebas correspondientes. El pipeline de CI/CD es el guardián de la calidad.
*   **Gestión de Secretos:** Todas las claves de API, contraseñas y secretos se gestionan a través de un archivo `.env` en desarrollo y a través de "GitHub Secrets" en el entorno de CI/CD para producción. Nunca se deben subir secretos al repositorio.
*   **Proceso de Despliegue (Híbrido):**
    1.  **Backend:** Cualquier `push` a la rama `main` en GitHub activa el pipeline, que construye una nueva imagen de Docker y la sube a AWS ECR, lista para ser desplegada en ECS.
    2.  **Frontend (Manual):**
        *   Ejecutar `npm run build` localmente tras configurar la `API_BASE_URL` en `public_html/src/config.js`.
        *   Comprimir el contenido de la carpeta `dist`.
        *   Subir y descomprimir el archivo `.zip` en el directorio `public_html` de SiteGround.

Este documento refleja el estado actual del proyecto 'Agrobridge 2.0', una plataforma robusta, segura y lista para su lanzamiento final y futura evolución.

