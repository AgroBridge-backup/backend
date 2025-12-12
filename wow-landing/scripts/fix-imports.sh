#!/bin/bash

# Fix broken imports from previous script
# Adds back @shared and @features prefixes

set -e

echo "🔧 Fixing broken import paths..."
echo "================================="

files=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" ! -path "*/index.ts")

for file in $files; do
    echo "Fixing: $file"

    perl -i -pe '
        # Fix shared imports (add @shared prefix)
        s|from [\x27"]/hooks/useApi[\x27"]|from \x27@shared/hooks/useApi\x27|g;
        s|from [\x27"]/hooks/usePerformanceMonitor[\x27"]|from \x27@shared/hooks/usePerformanceMonitor\x27|g;
        s|from [\x27"]/lib/apiClient[\x27"]|from \x27@shared/lib/apiClient\x27|g;
        s|from [\x27"]/types[\x27"]|from \x27@shared/types\x27|g;
        s|from [\x27"]/contexts/ThemeContext[\x27"]|from \x27@shared/contexts/ThemeContext\x27|g;
        s|from [\x27"]/config/api[\x27"]|from \x27@shared/config/api\x27|g;
        s|from [\x27"]/components/ui/(.+?)[\x27"]|from \x27@shared/components/ui/$1\x27|g;
        s|from [\x27"]/components/layout/LoadingScreen[\x27"]|from \x27@shared/components/layout/LoadingScreen\x27|g;
        s|from [\x27"]/components/layout/GlassMorphUI[\x27"]|from \x27@shared/components/layout/GlassMorphUI\x27|g;

        # Fix lots feature imports (add @features prefix)
        s|from [\x27"]/lots/services/lotsService[\x27"]|from \x27@features/lots/services/lotsService\x27|g;
        s|from [\x27"]/lots/components/(.+?)[\x27"]|from \x27@features/lots/components/$1\x27|g;

        # Fix landing feature imports (add @features prefix)
        s|from [\x27"]/landing/components/Background[\x27"]|from \x27@features/landing/components/Background\x27|g;
        s|from [\x27"]/landing/components/WebglLanding[\x27"]|from \x27@features/landing/components/WebglLanding\x27|g;
        s|from [\x27"]/landing/components/DataParticles[\x27"]|from \x27@features/landing/components/DataParticles\x27|g;
        s|from [\x27"]/landing/components/NodosFibonacci[\x27"]|from \x27@features/landing/components/NodosFibonacci\x27|g;
        s|from [\x27"]/landing/components/AgricultureIcons[\x27"]|from \x27@features/landing/components/AgricultureIcons\x27|g;
        s|from [\x27"]/landing/components/InteractiveDemo[\x27"]|from \x27@features/landing/components/InteractiveDemo\x27|g;
        s|from [\x27"]/landing/hooks/useFibonacciNodes[\x27"]|from \x27@features/landing/hooks/useFibonacciNodes\x27|g;
        s|from [\x27"]/landing/hooks/useOrganicBreath[\x27"]|from \x27@features/landing/hooks/useOrganicBreath\x27|g;

        # Fix dashboard feature imports (add @features prefix)
        s|from [\x27"]/dashboard/components/(.+?)[\x27"]|from \x27@features/dashboard/components/$1\x27|g;
    ' "$file"
done

echo ""
echo "✅ Import fixes complete!"
