# Docs Automation (AgroBridgeInt.com)

> **Status:** Configured, Pending Activation
> **Framework:** VitePress (Vue-powered Static Site Generator)

## Build & Deployment Instructions

### 1. Installation (Post-Merge)
Before running the docs locally, you must install the dependencies. This step was skipped during the audit remediation phase to keep the PR clean.

```bash
# From root directory
npm install -D vitepress vue
```

### 2. Local Development
To preview the documentation site with hot-reloading:

```bash
npm run docs:dev
```
*Opens at `http://localhost:5173`*

### 3. Production Build
To generate the static assets for deployment:

```bash
npm run docs:build
```
*Output directory: `docs/.vitepress/dist`*

## Directory Structure
*   `docs/.vitepress/config.mts` -> **Main Configuration**: Navigation, Sidebar, Theme.
*   `docs/en/` -> **English Source**: Primary technical documentation.
*   `docs/es/` -> **Spanish Source**: Localized guides (synced weekly).
*   `docs/strategy/` -> **Governance**: Corporate policies and roadmap.
*   `docs/technical/` -> **Architecture**: Deep dives into system design.
*   `docs/legal/` -> **Compliance**: Privacy, Terms, and Licenses.

## CI/CD Workflow
The deployment pipeline is defined in `.github/workflows/deploy-docs.yml`.
*   **Trigger:** Push to `main`.
*   **Action:** Builds the site and deploys to [Target Provider, e.g., Vercel/GitHub Pages].
*   **Current State:** The workflow file is present but deployment steps are commented out pending QA approval.
