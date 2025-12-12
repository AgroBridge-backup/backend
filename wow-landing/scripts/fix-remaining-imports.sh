#!/bin/bash

# Fix all remaining / prefixed imports

set -e

echo "🔧 Fixing remaining broken imports..."
echo "======================================"

# Fix InteractiveDemo.tsx
perl -i -pe 's|from [\x27"]/components/ui/GlowButton[\x27"]|from \x27@shared/components/ui/GlowButton\x27|g' \
    src/features/landing/components/InteractiveDemo.tsx

# Fix TraceabilityTimeline.tsx
perl -i -pe 's|from [\x27"]/types[\x27"]|from \x27../types\x27|g' \
    src/features/lots/components/TraceabilityTimeline.tsx

# Fix LoteCard.tsx
perl -i -pe 's|from [\x27"]/types[\x27"]|from \x27../types\x27|g' \
    src/features/lots/components/LoteCard.tsx
perl -i -pe 's|from [\x27"]/components/ui/Badge[\x27"]|from \x27@shared/components/ui/Badge\x27|g' \
    src/features/lots/components/LoteCard.tsx

# Fix LoteDetailPage.tsx
perl -i -pe 's|from [\x27"]/dashboard/components/DashboardLayout[\x27"]|from \x27@features/dashboard/components/DashboardLayout\x27|g' \
    src/features/lots/pages/LoteDetailPage.tsx
perl -i -pe 's|from [\x27"]/lots/components/TraceabilityTimeline[\x27"]|from \x27../components/TraceabilityTimeline\x27|g' \
    src/features/lots/pages/LoteDetailPage.tsx
perl -i -pe 's|from [\x27"]/components/ui/Badge[\x27"]|from \x27@shared/components/ui/Badge\x27|g' \
    src/features/lots/pages/LoteDetailPage.tsx

# Fix lotsService.ts
perl -i -pe 's|from [\x27"]/lib/apiClient[\x27"]|from \x27@shared/lib/apiClient\x27|g' \
    src/features/lots/services/lotsService.ts
perl -i -pe 's|from [\x27"]/config/api[\x27"]|from \x27@shared/config/api\x27|g' \
    src/features/lots/services/lotsService.ts
perl -i -pe 's|from [\x27"]/types[\x27"]|from \x27@shared/types\x27|g' \
    src/features/lots/services/lotsService.ts

# Fix RecentActivityTable.tsx
perl -i -pe 's|from [\x27"]/components/ui/GlassCard[\x27"]|from \x27@shared/components/ui/GlassCard\x27|g' \
    src/features/dashboard/components/RecentActivityTable.tsx
perl -i -pe 's|from [\x27"]/components/ui/Badge[\x27"]|from \x27@shared/components/ui/Badge\x27|g' \
    src/features/dashboard/components/RecentActivityTable.tsx

# Fix ProductionChart.tsx
perl -i -pe 's|from [\x27"]/components/ui/GlassCard[\x27"]|from \x27@shared/components/ui/GlassCard\x27|g' \
    src/features/dashboard/components/ProductionChart.tsx

# Fix DashboardPage.tsx
perl -i -pe 's|from [\x27"]/dashboard/components/DashboardLayout[\x27"]|from \x27../components/DashboardLayout\x27|g' \
    src/features/dashboard/pages/DashboardPage.tsx
perl -i -pe 's|from [\x27"]/dashboard/components/StatsGrid[\x27"]|from \x27../components/StatsGrid\x27|g' \
    src/features/dashboard/pages/DashboardPage.tsx
perl -i -pe 's|from [\x27"]/dashboard/components/RecentActivityTable[\x27"]|from \x27../components/RecentActivityTable\x27|g' \
    src/features/dashboard/pages/DashboardPage.tsx

# Fix ThemeToggle.tsx
perl -i -pe 's|from [\x27"]/contexts/ThemeContext[\x27"]|from \x27../../contexts/ThemeContext\x27|g' \
    src/shared/components/ui/ThemeToggle.tsx

# Fix useApi.ts
perl -i -pe 's|from [\x27"]/lib/apiClient[\x27"]|from \x27../lib/apiClient\x27|g' \
    src/shared/hooks/useApi.ts

# Fix apiClient.ts
perl -i -pe 's|from [\x27"]/config/api[\x27"]|from \x27../config/api\x27|g' \
    src/shared/lib/apiClient.ts

echo ""
echo "✅ All remaining imports fixed!"
