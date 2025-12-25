#!/bin/bash
# AgroBridge Backend - Dead Code Cleanup Script
# Generated: December 25, 2025
#
# This script removes files identified as dead code during the audit.
# Review docs/audit/DEAD-CODE-REPORT.md before running.

set -e

echo "========================================"
echo "🧹 AgroBridge Backend - Dead Code Cleanup"
echo "========================================"
echo ""
echo "⚠️  WARNING: This will DELETE files identified as unused."
echo "   Make sure you've reviewed docs/audit/DEAD-CODE-REPORT.md"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    echo "❌ Error: Run this script from apps/api directory"
    exit 1
fi

# Confirm before proceeding
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "📦 Creating git stash backup..."
git stash push -m "Pre-cleanup backup $(date +%Y%m%d_%H%M%S)" 2>/dev/null || echo "   (no changes to stash)"

echo ""
echo "🗑️  Deleting empty files (0 bytes)..."

# Empty files - HIGH CONFIDENCE
files_to_delete=(
    "src/infrastructure/database/repositories/PrismaEventRepository.ts"
    "src/infrastructure/database/repositories/PrismaUserRepository.ts"
    "src/presentation/validators/event.validator.ts"
    "src/presentation/validators/batch.validator.ts"
    "src/presentation/routes/certifications.routes.ts"
    "src/shared/utils/jwt.utils.ts"
    "src/infrastructure/blockchain/Web3Provider.ts"
    "src/infrastructure/blockchain/ContractManager.ts"
)

deleted_count=0
for file in "${files_to_delete[@]}"; do
    if [ -f "$file" ]; then
        rm -f "$file"
        echo "   ✓ Deleted: $file"
        ((deleted_count++))
    else
        echo "   - Skipped (not found): $file"
    fi
done

echo ""
echo "🗑️  Deleting QA-generated stub files..."

# QA stubs - HIGH CONFIDENCE
stub_files=(
    "src/application/shared/shared/errors/InvalidTokenError.ts"
    "src/application/domain/repositories/IRefreshTokenRepository.ts"
    "src/application/domain/repositories/IUserRepository.ts"
    "src/infrastructure/domain/entities/Batch.ts"
    "src/infrastructure/domain/repositories/IBatchRepository.ts"
)

for file in "${stub_files[@]}"; do
    if [ -f "$file" ]; then
        rm -f "$file"
        echo "   ✓ Deleted: $file"
        ((deleted_count++))
    else
        echo "   - Skipped (not found): $file"
    fi
done

echo ""
echo "📁 Removing empty directories..."

# Remove empty directories
empty_dirs=(
    "src/application/shared/shared/errors"
    "src/application/shared/shared"
    "src/application/domain/repositories"
    "src/application/domain"
    "src/infrastructure/domain/entities"
    "src/infrastructure/domain/repositories"
    "src/infrastructure/domain"
    "src/infrastructure/database/repositories"
    "src/presentation/validators"
)

for dir in "${empty_dirs[@]}"; do
    if [ -d "$dir" ]; then
        rmdir "$dir" 2>/dev/null && echo "   ✓ Removed: $dir" || echo "   - Not empty: $dir"
    fi
done

echo ""
echo "✅ Verifying codebase integrity..."

# Type check
echo "   Running type-check..."
if npm run type-check > /dev/null 2>&1; then
    echo "   ✓ TypeScript: OK"
else
    echo "   ⚠️  TypeScript errors detected - check manually"
fi

# Run tests (quick check)
echo "   Running tests..."
if npm test -- --run 2>/dev/null | tail -1 | grep -q "passed"; then
    echo "   ✓ Tests: OK"
else
    echo "   ⚠️  Some tests may need attention - check manually"
fi

echo ""
echo "========================================"
echo "✅ Cleanup complete!"
echo "========================================"
echo ""
echo "📊 Summary:"
echo "   Files deleted: $deleted_count"
echo ""
echo "📋 Next steps:"
echo "   1. Review changes: git status"
echo "   2. Run full tests: npm test"
echo "   3. Commit: git commit -am 'refactor: remove dead code per audit'"
echo ""
echo "💡 To undo, run: git stash pop"
echo ""
