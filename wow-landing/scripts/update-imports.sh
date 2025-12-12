#!/bin/bash

# Import Update Script
# Updates all imports to use new feature-based structure

set -e

echo "🔄 Updating imports to use new path aliases..."
echo "==============================================="

# Find all TS/TSX files
files=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*")

for file in $files; do
    # Skip barrel files (index.ts) - they don't need updates
    if [[ "$file" == */index.ts ]]; then
        continue
    fi

    echo "Processing: $file"

    # Use perl for in-place editing (works on macOS and Linux)
    perl -i -pe '
        # Shared imports
        s|from [\x27"]@/hooks/useApi[\x27"]|from \x27@shared/hooks/useApi\x27|g;
        s|from [\x27"]@/hooks/usePerformanceMonitor[\x27"]|from \x27@shared/hooks/usePerformanceMonitor\x27|g;
        s|from [\x27"]@/lib/apiClient[\x27"]|from \x27@shared/lib/apiClient\x27|g;
        s|from [\x27"]@/types[\x27"]|from \x27@shared/types\x27|g;
        s|from [\x27"]@/contexts/ThemeContext[\x27"]|from \x27@shared/contexts/ThemeContext\x27|g;
        s|from [\x27"]@/config/api[\x27"]|from \x27@shared/config/api\x27|g;
        s|from [\x27"]@/components/ui/(.+)[\x27"]|from \x27@shared/components/ui/$1\x27|g;
        s|from [\x27"]@/components/LoadingScreen[\x27"]|from \x27@shared/components/layout/LoadingScreen\x27|g;
        s|from [\x27"]@/components/GlassMorphUI[\x27"]|from \x27@shared/components/layout/GlassMorphUI\x27|g;

        # Lots feature imports
        s|from [\x27"]@/services/lotsService[\x27"]|from \x27@features/lots/services/lotsService\x27|g;
        s|from [\x27"]@/components/lotes/(.+)[\x27"]|from \x27@features/lots/components/$1\x27|g;

        # Landing feature imports
        s|from [\x27"]@/components/Background[\x27"]|from \x27@features/landing/components/Background\x27|g;
        s|from [\x27"]@/components/WebglLanding[\x27"]|from \x27@features/landing/components/WebglLanding\x27|g;
        s|from [\x27"]@/components/DataParticles[\x27"]|from \x27@features/landing/components/DataParticles\x27|g;
        s|from [\x27"]@/components/NodosFibonacci[\x27"]|from \x27@features/landing/components/NodosFibonacci\x27|g;
        s|from [\x27"]@/components/AgricultureIcons[\x27"]|from \x27@features/landing/components/AgricultureIcons\x27|g;
        s|from [\x27"]@/components/marketing/InteractiveDemo[\x27"]|from \x27@features/landing/components/InteractiveDemo\x27|g;
        s|from [\x27"]@/hooks/useFibonacciNodes[\x27"]|from \x27@features/landing/hooks/useFibonacciNodes\x27|g;
        s|from [\x27"]@/hooks/useOrganicBreath[\x27"]|from \x27@features/landing/hooks/useOrganicBreath\x27|g;

        # Dashboard feature imports
        s|from [\x27"]@/components/dashboard/(.+)[\x27"]|from \x27@features/dashboard/components/$1\x27|g;
    ' "$file"
done

echo ""
echo "✅ Import updates complete!"
echo ""
echo "Next: Update relative imports within features..."
