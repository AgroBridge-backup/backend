# Getting Started: AgroBridge API Developer Onboarding

> 🇪🇸 **[Leer esto en Español](../es/ONBOARDING.md)**

> **Audience:** Software Engineers, DevOps
> **Objective:** This guide provides a complete, step-by-step process to set up the backend development environment from a clean machine.

## 1. Prerequisites

Ensure the following software is installed on your machine:

*   **Git:** For cloning the repository.
*   **Node.js:** Version `20.x` or higher.
*   **pnpm:** Version `8.x` or higher. Install via `npm install -g pnpm`.
*   **Docker & Docker Compose:** For running dependent services (Database, Cache).

## 2. Step-by-Step Setup

### Step 2.1: Clone the Repository

Clone the main project repository to your local machine.

```bash
git clone <repository-url>
cd <repository-directory>
```

### Step 2.2: Configure Environment Variables

The backend service (`apps/api`) requires specific environment variables to run.

1.  **Navigate to the API directory:**
    ```bash
    cd apps/api
    ```

2.  **Create the `.env` file:**
    Copy the example file. This file is git-ignored and will contain your local secrets.
    ```bash
    cp .env.example .env
    ```

3.  **Edit the `.env` file:**
    Open `apps/api/.env` and fill in the following variables.

    ```dotenv
    # Backend server port
    PORT=4000

    # Database connection URL for the Docker service
    DATABASE_URL="postgresql://agro_user:supersecretpassword@localhost:5432/agrobridge?schema=public"

    # Redis connection URL for the Docker service
    REDIS_URL="redis://localhost:6379"

    # Paths to JWT signing keys. Generate these locally.
    # See Troubleshooting section for generating keys.
    JWT_PRIVATE_KEY_PATH="./jwtRS256.key"
    JWT_PUBLIC_KEY_PATH="./jwtRS256.key.pub"

    # Token time-to-live settings
    JWT_ACCESS_TOKEN_TTL="15m"
    JWT_REFRESH_TOKEN_TTL="7d"

    # URL of the frontend for CORS configuration
    FRONTEND_URL="http://localhost:3000"
    ```

### Step 2.3: Start Dependent Services

The backend requires a PostgreSQL database and a Redis instance. The `docker-compose.yml` file at the project root manages these services.

```bash
# From the project root directory
docker-compose up -d db redis
```

This command starts the database and Redis containers in the background.

### Step 2.4: Install Dependencies

Use `pnpm` from the root of the monorepo to install all dependencies for every project, including the `apps/api` backend.

```bash
# From the project root directory
pnpm install
```

### Step 2.5: Prepare the Database

1.  **Run Migrations:** Apply the database schema.
    ```bash
    # From the apps/api directory
    pnpm prisma migrate dev
    ```
    This command will set up all tables and relationships in the `agrobridge` database.

2.  **Seed the Database:** Populate the database with initial data (e.g., admin user, test producers).
    ```bash
    # From the apps/api directory
    pnpm prisma:seed
    ```

### Step 2.6: Run the Application

You are now ready to start the backend server.

```bash
# From the apps/api directory
pnpm run dev
```

The API will start on the port defined in your `.env` file (e.g., `http://localhost:4000`). The server will automatically restart when you make changes to the source code.

**You have successfully set up the AgroBridge API backend!**

## 3. Troubleshooting Common Issues

*   **Error: `listen EADDRINUSE: address already in use :::4000`**
    *   **Cause:** Another process is using port 4000.
    *   **Solution:** Stop the other process or change the `PORT` in your `apps/api/.env` file to a different one (e.g., `4001`).

*   **Error: Can't connect to database**
    *   **Cause:** The Docker database container is not running or the `DATABASE_URL` is incorrect.
    *   **Solution:**
        1.  Verify the containers are running with `docker ps`.
        2.  Ensure your `DATABASE_URL` in `.env` matches the credentials in the `docker-compose.yml` file.
        3.  Check that you are using `localhost` or `127.0.0.1` and not `db` in your connection string for local development.

*   **Error: `ENOENT: no such file or directory, open './jwtRS256.key'`**
    *   **Cause:** The JWT signing keys have not been generated. The application requires an RSA key pair to sign tokens.
    *   **Solution:** Generate a new key pair in the `apps/api` directory.
        ```bash
        # In the apps/api directory
        ssh-keygen -t rsa -b 2048 -m PEM -f jwtRS256.key
        openssl rsa -in jwtRS256.key -pubout -outform PEM -out jwtRS256.key.pub
        # Do not add a passphrase when prompted.
        # Ensure the .key files are added to .gitignore and never committed.
        ```
