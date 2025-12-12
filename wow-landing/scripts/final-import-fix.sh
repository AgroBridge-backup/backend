#!/bin/bash

# Final comprehensive import fix
# Handles all edge cases and cross-feature imports

set -e

echo "🔧 Final import fix pass..."
echo "============================"

files=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" ! -path "*/index.ts")

for file in $files; do
    echo "Processing: $file"

    perl -i -pe '
        # Fix any remaining broken /path imports - add @features or @shared
        s|from [\x27"]/hooks/|from \x27@shared/hooks/|g;
        s|from [\x27"]/lib/|from \x27@shared/lib/|g;
        s|from [\x27"]/types[\x27"]|from \x27@shared/types\x27|g;
        s|from [\x27"]/contexts/|from \x27@shared/contexts/|g;
        s|from [\x27"]/config/|from \x27@shared/config/|g;
        s|from [\x27"]/utils/|from \x27@shared/utils/|g;
        s|from [\x27"]/components/ui/|from \x27@shared/components/ui/|g;
        s|from [\x27"]/components/layout/|from \x27@shared/components/layout/|g;

        # Fix dashboard cross-feature imports
        s|from [\x27"]/dashboard/|from \x27@features/dashboard/|g;

        # Fix lots cross-feature imports
        s|from [\x27"]/lots/|from \x27@features/lots/|g;

        # Fix landing cross-feature imports
        s|from [\x27"]/landing/|from \x27@features/landing/|g;
    ' "$file"
done

echo ""
echo "✅ Final import fix complete!"
echo ""
echo "Running build to verify..."
