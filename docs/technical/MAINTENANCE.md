# Migration & Update Guide

> **Audience:** Backend Engineers, DevOps
> **Objective:** To provide a standard operating procedure (SOP) for updating dependencies and managing database schema changes safely.

## 1. Updating Dependencies

The project uses `pnpm` for package management.

### 1.1. Checking for Outdated Packages

To see a list of outdated dependencies, navigate to the project root and run:

```bash
pnpm outdated
```

### 1.2. Updating a Single Dependency

To update a specific package to its latest version:

```bash
# From the project root
pnpm up <package-name>
```

### 1.3. Safe Update Workflow (Checklist)

1.  [ ] Create a new feature branch for the updates: `git checkout -b feat/update-dependencies`.
2.  [ ] Run the update command(s).
3.  [ ] Review the `pnpm-lock.yaml` file to see what has changed.
4.  [ ] **Run all tests** to check for regressions:
    ```bash
    # From the apps/api directory
    pnpm test
    ```
5.  [ ] Manually test critical API endpoints if the updated package is core to their functionality.
6.  [ ] Commit the changes and open a Pull Request for peer review.

## 2. Database Migrations

The project uses **Prisma** to manage database schema migrations. The schema is defined in `apps/api/src/infrastructure/database/prisma/schema.prisma`.

### 2.1. Development Workflow

When you need to make a change to the data model (e.g., add a field, create a table):

1.  **Modify the Schema:** Edit the `schema.prisma` file. For example, add a new field to the `User` model:
    ```prisma
    model User {
      // ... existing fields
      phone_number String?
    }
    ```

2.  **Create a New Migration:** Run the `prisma migrate dev` command. This will:
    *   Create a new SQL migration file in the `apps/api/src/infrastructure/database/prisma/migrations` directory.
    *   Apply the migration to your local development database.
    *   Update the Prisma Client (`@prisma/client`).

    ```bash
    # From the apps/api directory
    pnpm prisma migrate dev --name add_user_phone_number
    ```
    Always provide a descriptive name for the migration.

### 2.2. Production Workflow

In a production environment, you **do not** run `migrate dev`. The workflow is designed to be non-destructive and is typically part of a CI/CD pipeline.

1.  **Generate SQL (Optional but Recommended):** You can create migrations without applying them to generate the raw SQL for review.
    ```bash
    pnpm prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > migration.sql
    ```

2.  **Apply Migrations:** The standard command to apply all pending migrations in a production or staging environment is:
    ```bash
    pnpm prisma migrate deploy
    ```
    This command runs all migration files that have not yet been applied to the target database and will not prompt for destructive actions, making it safe for automated pipelines.
