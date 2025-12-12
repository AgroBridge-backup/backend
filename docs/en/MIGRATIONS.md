# Migrations & Maintenance Guide

> 🇪🇸 **[Leer esto en Español](../es/MIGRATIONS.md)**

> **Audience:** Backend Engineers, DevOps, SRE
> **Objective:** To provide a standard operating procedure (SOP) for updating software dependencies and managing database schema changes safely and predictably.

## 1. Database Migrations (Prisma)

Database migrations are a way to manage incremental and reversible changes to our database schema. Every time we change the data model (e.g., add a `User` field), we create a "migration" file that contains the specific instructions (SQL code) to apply that change.

> **For Non-Technical Stakeholders: An Analogy for Migrations**
> Imagine our database is a large, carefully constructed building.
> *   The **schema** (`schema.prisma`) is the building's official blueprint.
> *   When we need to make a change, like adding a new room, we first update the **blueprint**.
> *   Then, we write a **migration**, which is a set of step-by-step instructions for the construction crew on how to build that new room without knocking the rest of the building down.
> This process ensures that every change is planned, documented, and can be applied consistently everywhere.

### 1.1. Development Workflow

1.  **Modify the Blueprint:** Edit the `apps/api/src/infrastructure/database/prisma/schema.prisma` file with your desired changes.
2.  **Generate Migration Instructions:** From the `apps/api` directory, run:
    ```bash
    pnpm prisma migrate dev --name <descriptive-migration-name>
    ```
    *   **What this command does:** Prisma compares your updated schema to the development database. It uses a temporary "shadow database" to detect any potential issues. It then generates a new SQL file in the `prisma/migrations` folder containing the exact steps needed and applies it to your local database.

### 1.2. Production Workflow & Best Practices

*   **Best Practice: Forward-Only, Non-Destructive Migrations.** We should avoid "destructive" changes (like dropping a column) in production migrations. Instead, prefer a multi-step process (e.g., deploy code that stops using the column, then deploy a migration to remove it).
*   **Applying Migrations in Production:** In a CI/CD pipeline, the following command is used to apply all pending migrations safely:
    ```bash
    pnpm prisma migrate deploy
    ```
    This command is non-interactive and will not ask for input, making it safe for automation. It applies migrations that have been committed to source control but have not yet been run against the production database.

### 1.3. FAQ: How do we roll back a failed migration?
*   Prisma does not support automatic rollbacks for failed production migrations, as this can be dangerous. The best practice is to **restore the database from the backup** taken just before the deployment (see `BACKUP.md`) and then fix the faulty migration file in a new release.

## 2. Software Dependency Updates

### 2.1. Checking for Outdated Packages
From the project root, run `pnpm outdated` to see a list of dependencies that have newer versions available.

### 2.2. Safe Update Workflow (Checklist)
1.  [ ] **Isolate Changes:** Create a new feature branch (`git checkout -b feat/update-dependencies`).
2.  [ ] **Update:** Run `pnpm up <package-name>` to update specific packages. For a major version update, read the package's release notes for breaking changes.
3.  [ ] **Verify:** Run the full test suite (`pnpm test`) to catch any regressions.
4.  [ ] **Review:** Open a Pull Request for peer review. The lockfile (`pnpm-lock.yaml`) changes should be part of this review.
5.  [ ] **Merge:** Merge only after all checks and approvals are complete.
