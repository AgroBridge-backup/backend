# AgroBridge API v2.0

This is the enterprise-grade backend API for AgroBridge 2.0, built with Node.js, TypeScript, and a Clean Architecture approach.

## Features

- **RESTful API**: A complete API for managing producers, batches, traceability events, and certifications.
- **Authentication**: JWT-based authentication (RS256) with refresh token rotation.
- **Blockchain Integration**: Interacts with Polygon smart contracts for traceability and certification.
- **Database**: Uses PostgreSQL with Prisma ORM.
- **Caching**: Leverages Redis for caching expensive queries and for rate limiting.
- **IPFS Integration**: Uses Pinata for decentralized file storage (certificates, photos).
- **Robust Error Handling**: Centralized error handling with domain-specific error mapping.
- **Validation**: Request validation using Zod schemas.

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Docker and Docker Compose
- PostgreSQL instance
- Redis instance

### Installation

1.  **Clone the repository**

2.  **Navigate to the API directory:**
    ```bash
    cd apps/api
    ```

3.  **Install dependencies:**
    ```bash
    pnpm install
    ```

4.  **Set up environment variables:**
    Copy the `.env.example` file to a new `.env` file:
    ```bash
    cp .env.example .env
    ```
    Fill in the required environment variables in the `.env` file.

5.  **Generate RSA keys for JWT:**
    Use OpenSSL to generate a private/public key pair for signing JWTs.
    ```bash
    openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt rsa_keygen_bits:2048
    openssl rsa -pubout -in private_key.pem -out public_key.pem
    ```
    Copy the contents of `private_key.pem` and `public_key.pem` into the `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` variables in your `.env` file. Remember to format them as single-line strings with `\n` for newlines.

6.  **Set up the database:**
    Run the Prisma migrations to create the database schema.
    ```bash
    pnpm prisma:migrate
    ```

7.  **(Optional) Seed the database:**
    ```bash
    pnpm prisma:seed
    ```

### Running the Application

-   **Development mode (with hot-reloading):**
    ```bash
    pnpm dev
    ```

-   **Production mode:**
    ```bash
    pnpm build
    pnpm start
    ```

### Running Tests

-   **Run all tests:**
    ```bash
    pnpm test
    ```

-   **Run E2E tests:**
    ```bash
    pnpm test:e2e
    ```

-   **Get test coverage:**
    ```bash
    pnpm test:coverage
    ```

## API Endpoints

See the individual route files in `src/presentation/routes/` for a detailed list of endpoints.
- `/api/v1/auth`
- `/api/v1/batches`
- `/api/v1/events`
- `/api/v1/producers`
