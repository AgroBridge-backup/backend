# Contributing to AgroBridge Documentation

## 1. English First Policy
All technical documentation must be created or updated in `docs/en/` first. This serves as the "Source of Truth".

## 2. Translation Workflow
1.  **Create/Update:** Modify the English file.
2.  **Sync:** You have **7 days** to provide the Spanish translation in `docs/es/`.
3.  **Automation:** The CI/CD pipeline (`bilingual-sync.yml`) will fail if a Spanish file is missing or significantly outdated compared to its English counterpart.

## 3. Directory Structure
*   `docs/en/` -> English Documentation (Source)
*   `docs/es/` -> Spanish Documentation (Target)
*   `docs/strategy/` -> Global Governance (Bilingual within file or English only)
*   `docs/technical/` -> Deep Technical Specs (English only allowed for low-level specs)
