# AgroBridge Backend - Dead Code Report

**Generated:** December 25, 2025

---

## Summary

| Category | Count | Action |
|----------|-------|--------|
| Empty Files (0 bytes) | 8 | DELETE |
| Auto-generated QA Stubs | 5 | DELETE |
| Orphaned Files | 2 | INVESTIGATE |
| Duplicate Directories | 5 | CONSOLIDATE |
| **Total Files to Remove** | **13** | - |

---

## Category 1: Empty Files (0 bytes)

These files exist but contain no code. **Safe to delete.**

| File Path | Reason | Confidence |
|-----------|--------|------------|
| `src/infrastructure/database/repositories/PrismaEventRepository.ts` | Empty (0 bytes) - superseded by prisma/repositories version | HIGH |
| `src/infrastructure/database/repositories/PrismaUserRepository.ts` | Empty (0 bytes) - superseded by prisma/repositories version | HIGH |
| `src/presentation/validators/event.validator.ts` | Empty (0 bytes) - validation in Zod schemas | HIGH |
| `src/presentation/validators/batch.validator.ts` | Empty (0 bytes) - validation in Zod schemas | HIGH |
| `src/presentation/routes/certifications.routes.ts` | Empty (0 bytes) - not mounted in router | HIGH |
| `src/shared/utils/jwt.utils.ts` | Empty (0 bytes) - JWT in infrastructure/auth | HIGH |
| `src/infrastructure/blockchain/Web3Provider.ts` | Empty (0 bytes) - replaced by ethers.js | HIGH |
| `src/infrastructure/blockchain/ContractManager.ts` | Empty (0 bytes) - replaced by Ethers services | HIGH |

---

## Category 2: Auto-Generated QA Stubs

These were created by QA automation as placeholders. **Safe to delete.**

| File Path | Content | Reason | Confidence |
|-----------|---------|--------|------------|
| `src/application/shared/shared/errors/InvalidTokenError.ts` | Empty export | Nested duplicate directory | HIGH |
| `src/application/domain/repositories/IRefreshTokenRepository.ts` | `export default {}` | QA stub - real interface in domain/ | HIGH |
| `src/application/domain/repositories/IUserRepository.ts` | `export default {}` | QA stub - real interface in domain/ | HIGH |
| `src/infrastructure/domain/entities/Batch.ts` | `export default {}` | Wrong location (infra/domain) | HIGH |
| `src/infrastructure/domain/repositories/IBatchRepository.ts` | `export default {}` | Wrong location (infra/domain) | HIGH |

---

## Category 3: Orphaned Files

Files that may be unused but need investigation before deletion.

| File Path | Type | Reason | Confidence |
|-----------|------|--------|------------|
| `src/infrastructure/services/IPFSService.ts` | Service | Dummy implementation - real one in infrastructure/ipfs/ | MEDIUM |
| `src/infrastructure/storage/IPFSClient.ts` | Client | Advanced client not imported - may be WIP | MEDIUM |

---

## Category 4: Duplicate Directory Structures

These indicate architectural drift during refactoring.

| Old Location | New Location | Issue |
|--------------|--------------|-------|
| `src/infrastructure/database/repositories/` | `src/infrastructure/database/prisma/repositories/` | Old structure, empty files |
| `src/application/shared/shared/` | `src/application/shared/` | Nested duplicate |
| `src/application/domain/` | `src/domain/` | Duplicate interfaces |
| `src/infrastructure/domain/` | `src/domain/` | Wrong location |
| `src/config/` | `src/infrastructure/config/` | Old config location |

---

## Category 5: Duplicate Error Classes

Multiple implementations of the same error class.

| Error Class | Locations | Recommendation |
|-------------|-----------|----------------|
| `InvalidTokenError` | 3 files | Keep `src/shared/errors/InvalidTokenError.ts` |
| | `src/shared/errors/InvalidTokenError.ts` | KEEP (canonical) |
| | `src/application/shared/errors/InvalidTokenError.ts` | DELETE |
| | `src/application/shared/shared/errors/InvalidTokenError.ts` | DELETE |

---

## Files to Delete

### High Confidence (Execute immediately)

```bash
# Empty files
rm -f src/infrastructure/database/repositories/PrismaEventRepository.ts
rm -f src/infrastructure/database/repositories/PrismaUserRepository.ts
rm -f src/presentation/validators/event.validator.ts
rm -f src/presentation/validators/batch.validator.ts
rm -f src/presentation/routes/certifications.routes.ts
rm -f src/shared/utils/jwt.utils.ts
rm -f src/infrastructure/blockchain/Web3Provider.ts
rm -f src/infrastructure/blockchain/ContractManager.ts

# QA stubs
rm -f src/application/shared/shared/errors/InvalidTokenError.ts
rm -f src/application/domain/repositories/IRefreshTokenRepository.ts
rm -f src/application/domain/repositories/IUserRepository.ts
rm -f src/infrastructure/domain/entities/Batch.ts
rm -f src/infrastructure/domain/repositories/IBatchRepository.ts
```

### Medium Confidence (Verify first)

```bash
# Verify these are not imported anywhere
grep -r "from.*IPFSService" src/ --include="*.ts"
grep -r "from.*IPFSClient" src/ --include="*.ts"

# If no imports found, safe to delete
rm -f src/infrastructure/services/IPFSService.ts
rm -f src/infrastructure/storage/IPFSClient.ts
```

### Directories to Remove

```bash
# After deleting files, remove empty directories
rmdir src/application/shared/shared/errors 2>/dev/null
rmdir src/application/shared/shared 2>/dev/null
rmdir src/application/domain/repositories 2>/dev/null
rmdir src/application/domain 2>/dev/null
rmdir src/infrastructure/domain/entities 2>/dev/null
rmdir src/infrastructure/domain/repositories 2>/dev/null
rmdir src/infrastructure/domain 2>/dev/null
rmdir src/infrastructure/database/repositories 2>/dev/null
rmdir src/presentation/validators 2>/dev/null
```

---

## Verification Steps

After cleanup, verify the codebase still works:

```bash
# Type check
npm run type-check

# Run tests
npm test

# Build
npm run build
```

---

## Estimated Impact

| Metric | Before | After |
|--------|--------|-------|
| TypeScript Files | 413 | 400 |
| Dead Code Files | 13 | 0 |
| Empty Directories | 7 | 0 |
| Cognitive Load | Higher | Lower |

---

## Notes

1. **Do not delete** barrel files (`index.ts`) - they export legitimate modules
2. **Do not delete** test files - even if source was removed
3. **Verify imports** before deleting any MEDIUM confidence files
4. **Check git history** if unsure about a file's purpose

---

*Generated by Claude Code Audit - December 25, 2025*
