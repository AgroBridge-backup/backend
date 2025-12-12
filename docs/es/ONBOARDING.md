# Guía de Inicio: Onboarding de Desarrolladores API AgroBridge

> 🇺🇸 **[Read this in English](../en/ONBOARDING.md)**

> **Audiencia:** Ingenieros de Software, DevOps
> **Objetivo:** Esta guía proporciona un proceso completo paso a paso para configurar el entorno de desarrollo backend desde una máquina limpia.

## 1. Prerrequisitos

Asegúrese de que el siguiente software esté instalado en su máquina:

*   **Git:** Para clonar el repositorio.
*   **Node.js:** Versión `20.x` o superior.
*   **pnpm:** Versión `8.x` o superior. Instalar vía `npm install -g pnpm`.
*   **Docker & Docker Compose:** Para ejecutar servicios dependientes (Base de Datos, Caché).

## 2. Configuración Paso a Paso

### Paso 2.1: Clonar el Repositorio

Clone el repositorio principal del proyecto en su máquina local.

```bash
git clone <url-del-repositorio>
cd <directorio-del-repositorio>
```

### Paso 2.2: Configurar Variables de Entorno

El servicio backend (`apps/api`) requiere variables de entorno específicas para ejecutarse.

1.  **Navegue al directorio de la API:**
    ```bash
    cd apps/api
    ```

2.  **Cree el archivo `.env`:**
    Copie el archivo de ejemplo. Este archivo es ignorado por git y contendrá sus secretos locales.
    ```bash
    cp .env.example .env
    ```

3.  **Edite el archivo `.env`:**
    Abra `apps/api/.env` y complete las siguientes variables.

    ```dotenv
    # Puerto del servidor backend
    PORT=4000

    # URL de conexión a Base de Datos para el servicio Docker
    DATABASE_URL="postgresql://agro_user:supersecretpassword@localhost:5432/agrobridge?schema=public"

    # URL de conexión a Redis para el servicio Docker
    REDIS_URL="redis://localhost:6379"

    # Rutas a las claves de firma JWT. Genérelas localmente.
    # Ver sección de Solución de Problemas para generar claves.
    JWT_PRIVATE_KEY_PATH="./jwtRS256.key"
    JWT_PUBLIC_KEY_PATH="./jwtRS256.key.pub"

    # Configuración de tiempo de vida del token
    JWT_ACCESS_TOKEN_TTL="15m"
    JWT_REFRESH_TOKEN_TTL="7d"

    # URL del frontend para configuración CORS
    FRONTEND_URL="http://localhost:3000"
    ```

### Paso 2.3: Iniciar Servicios Dependientes

El backend requiere una base de datos PostgreSQL y una instancia de Redis. El archivo `docker-compose.yml` en la raíz del proyecto gestiona estos servicios.

```bash
# Desde el directorio raíz del proyecto
docker-compose up -d db redis
```

Este comando inicia los contenedores de base de datos y Redis en segundo plano.

### Paso 2.4: Instalar Dependencias

Use `pnpm` desde la raíz del monorepo para instalar todas las dependencias de cada proyecto, incluyendo el backend `apps/api`.

```bash
# Desde el directorio raíz del proyecto
pnpm install
```

### Paso 2.5: Preparar la Base de Datos

1.  **Ejecutar Migraciones:** Aplicar el esquema de la base de datos.
    ```bash
    # Desde el directorio apps/api
    pnpm prisma migrate dev
    ```
    Este comando configurará todas las tablas y relaciones en la base de datos `agrobridge`.

2.  **Sembrar (Seed) la Base de Datos:** Poblar la base de datos con datos iniciales (ej. usuario admin, productores de prueba).
    ```bash
    # Desde el directorio apps/api
    pnpm prisma:seed
    ```

### Paso 2.6: Ejecutar la Aplicación

Ahora está listo para iniciar el servidor backend.

```bash
# Desde el directorio apps/api
pnpm run dev
```

La API iniciará en el puerto definido en su archivo `.env` (ej. `http://localhost:4000`). El servidor se reiniciará automáticamente cuando realice cambios en el código fuente.

**¡Ha configurado exitosamente el backend de la API de AgroBridge!**

## 3. Solución de Problemas Comunes

*   **Error: `listen EADDRINUSE: address already in use :::4000`**
    *   **Causa:** Otro proceso está usando el puerto 4000.
    *   **Solución:** Detenga el otro proceso o cambie el `PORT` en su archivo `apps/api/.env` a uno diferente (ej. `4001`).

*   **Error: Can't connect to database**
    *   **Causa:** El contenedor Docker de base de datos no se está ejecutando o la `DATABASE_URL` es incorrecta.
    *   **Solución:**
        1.  Verifique que los contenedores corran con `docker ps`.
        2.  Asegúrese de que su `DATABASE_URL` en `.env` coincida con las credenciales en `docker-compose.yml`.
        3.  Verifique que está usando `localhost` o `127.0.0.1` y no `db` en su cadena de conexión para desarrollo local.

*   **Error: `ENOENT: no such file or directory, open './jwtRS256.key'`**
    *   **Causa:** Las claves de firma JWT no se han generado. La aplicación requiere un par de claves RSA para firmar tokens.
    *   **Solución:** Genere un nuevo par de claves en el directorio `apps/api`.
        ```bash
        # En el directorio apps/api
        ssh-keygen -t rsa -b 2048 -m PEM -f jwtRS256.key
        openssl rsa -in jwtRS256.key -pubout -outform PEM -out jwtRS256.key.pub
        # No agregue una contraseña cuando se le solicite.
        # Asegúrese de que los archivos .key se agreguen a .gitignore y nunca se commiteen.
        ```
