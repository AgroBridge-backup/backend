#!/bin/bash

# Feature Folder Structure Migration Script
# This script moves files from file-type organization to feature-based organization
# Uses 'git mv' to preserve file history

set -e  # Exit on error

echo "🚀 Starting Feature Folder Migration..."
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to create directory if it doesn't exist
create_dir() {
    if [ ! -d "$1" ]; then
        echo -e "${BLUE}📁 Creating directory: $1${NC}"
        mkdir -p "$1"
    fi
}

# Function to move file with git
move_file() {
    local src="$1"
    local dest="$2"

    if [ -f "$src" ]; then
        echo -e "${GREEN}  ✓ Moving: $src → $dest${NC}"
        git mv "$src" "$dest"
    else
        echo -e "${YELLOW}  ⚠ File not found: $src${NC}"
    fi
}

echo ""
echo "Phase 1: Creating new folder structure..."
echo "=========================================="

# Create features folder structure
create_dir "src/features/lots/components"
create_dir "src/features/lots/hooks"
create_dir "src/features/lots/services"
create_dir "src/features/lots/types"
create_dir "src/features/lots/pages"

create_dir "src/features/dashboard/components"
create_dir "src/features/dashboard/pages"

create_dir "src/features/landing/components"
create_dir "src/features/landing/hooks"
create_dir "src/features/landing/shaders"

create_dir "src/features/certificates"
create_dir "src/features/producers"

# Create shared folder structure
create_dir "src/shared/components/ui"
create_dir "src/shared/components/layout"
create_dir "src/shared/hooks"
create_dir "src/shared/lib"
create_dir "src/shared/types"
create_dir "src/shared/contexts"
create_dir "src/shared/utils"
create_dir "src/shared/config"

echo ""
echo "Phase 2: Migrating Lots Feature..."
echo "=========================================="

# Move lots components
move_file "src/components/lotes/LoteCard.tsx" "src/features/lots/components/LoteCard.tsx"
move_file "src/components/lotes/TraceabilityTimeline.tsx" "src/features/lots/components/TraceabilityTimeline.tsx"
move_file "src/components/lotes/QrScanner.tsx" "src/features/lots/components/QrScanner.tsx"

# Move lots service
move_file "src/services/lotsService.ts" "src/features/lots/services/lotsService.ts"

# Move lots pages
move_file "src/pages/LotesPage.tsx" "src/features/lots/pages/LotesPage.tsx"
move_file "src/pages/LoteDetailPage.tsx" "src/features/lots/pages/LoteDetailPage.tsx"

echo ""
echo "Phase 3: Migrating Dashboard Feature..."
echo "=========================================="

# Move dashboard components
move_file "src/components/dashboard/StatsGrid.tsx" "src/features/dashboard/components/StatsGrid.tsx"
move_file "src/components/dashboard/RecentActivityTable.tsx" "src/features/dashboard/components/RecentActivityTable.tsx"
move_file "src/components/dashboard/ProductionChart.tsx" "src/features/dashboard/components/ProductionChart.tsx"
move_file "src/components/dashboard/DashboardLayout.tsx" "src/features/dashboard/components/DashboardLayout.tsx"

# Move dashboard page
move_file "src/pages/DashboardPage.tsx" "src/features/dashboard/pages/DashboardPage.tsx"

echo ""
echo "Phase 4: Migrating Landing Feature..."
echo "=========================================="

# Move landing components
move_file "src/components/Background.tsx" "src/features/landing/components/Background.tsx"
move_file "src/components/WebglLanding.tsx" "src/features/landing/components/WebglLanding.tsx"
move_file "src/components/DataParticles.tsx" "src/features/landing/components/DataParticles.tsx"
move_file "src/components/NodosFibonacci.tsx" "src/features/landing/components/NodosFibonacci.tsx"
move_file "src/components/AgricultureIcons.tsx" "src/features/landing/components/AgricultureIcons.tsx"
move_file "src/components/marketing/InteractiveDemo.tsx" "src/features/landing/components/InteractiveDemo.tsx"

# Move landing hooks
move_file "src/hooks/useFibonacciNodes.ts" "src/features/landing/hooks/useFibonacciNodes.ts"
move_file "src/hooks/useOrganicBreath.ts" "src/features/landing/hooks/useOrganicBreath.ts"

# Move shaders if they exist
if [ -d "src/shaders" ]; then
    echo -e "${GREEN}  ✓ Moving: src/shaders → src/features/landing/shaders${NC}"
    git mv src/shaders/* "src/features/landing/shaders/" 2>/dev/null || true
fi

echo ""
echo "Phase 5: Migrating Shared Code..."
echo "=========================================="

# Move shared UI components
if [ -d "src/components/ui" ]; then
    for file in src/components/ui/*; do
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            move_file "$file" "src/shared/components/ui/$filename"
        fi
    done
fi

# Move shared layout components
move_file "src/components/LoadingScreen.tsx" "src/shared/components/layout/LoadingScreen.tsx"
move_file "src/components/GlassMorphUI.tsx" "src/shared/components/layout/GlassMorphUI.tsx"

# Move shared hooks
move_file "src/hooks/useApi.ts" "src/shared/hooks/useApi.ts"
move_file "src/hooks/usePerformanceMonitor.ts" "src/shared/hooks/usePerformanceMonitor.ts"

# Move lib
move_file "src/lib/apiClient.ts" "src/shared/lib/apiClient.ts"

# Move types
move_file "src/types/index.ts" "src/shared/types/index.ts"

# Move contexts
move_file "src/contexts/ThemeContext.tsx" "src/shared/contexts/ThemeContext.tsx"

# Move utils
move_file "src/utils/lazyLoad.tsx" "src/shared/utils/lazyLoad.tsx"

# Move config
move_file "src/config/api.ts" "src/shared/config/api.ts"

echo ""
echo "Phase 6: Cleaning up empty directories..."
echo "=========================================="

# Remove empty old directories
rm -rf src/components/lotes 2>/dev/null || true
rm -rf src/components/dashboard 2>/dev/null || true
rm -rf src/components/marketing 2>/dev/null || true
rm -rf src/components/ui 2>/dev/null || true
rm -rf src/hooks 2>/dev/null || true
rm -rf src/services 2>/dev/null || true
rm -rf src/lib 2>/dev/null || true
rm -rf src/types 2>/dev/null || true
rm -rf src/contexts 2>/dev/null || true
rm -rf src/utils 2>/dev/null || true
rm -rf src/config 2>/dev/null || true
rm -rf src/shaders 2>/dev/null || true

# Remove pages directory (now inside features)
rm -rf src/pages 2>/dev/null || true

# Remove data directory (mock data no longer needed)
echo -e "${BLUE}📁 Removing mock data directory...${NC}"
rm -rf src/data 2>/dev/null || true

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Migration complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Create barrel files (index.ts) for each feature"
echo "2. Update tsconfig.json with path aliases"
echo "3. Update vite.config.ts with path aliases"
echo "4. Update all imports to use new paths"
echo "5. Run 'npm run build' to verify"
echo "6. Run 'npm run lint' to check for issues"
echo ""
