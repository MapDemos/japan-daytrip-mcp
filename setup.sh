#!/bin/bash

# Mapbox Demo Template Setup Script
# Automatically configures package.json based on folder name

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the current directory name (will be the demo name)
DEMO_NAME=$(basename "$(pwd)")

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}Mapbox Demo Template Setup${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""
echo -e "${BLUE}Demo name (from folder): ${GREEN}${DEMO_NAME}${NC}"
echo ""

# Step 1: Update package.json
echo -e "${BLUE}Updating package.json...${NC}"

if [ ! -f "package.json" ]; then
    echo -e "${YELLOW}⚠ package.json not found!${NC}"
    echo "Are you in the template directory?"
    exit 1
fi

# Update the build script in package.json
npm pkg set name="$DEMO_NAME"
npm pkg set scripts.build="vite build --outDir build --base=/${DEMO_NAME}/"

echo -e "${GREEN}✓ package.json updated${NC}"
echo "  - name: ${DEMO_NAME}"
echo "  - build path: /${DEMO_NAME}/"
echo ""

# Step 2: Check if index.js needs token
echo -e "${BLUE}Checking index.js...${NC}"

if grep -q "YOUR_MAPBOX_ACCESS_TOKEN" index.js 2>/dev/null; then
    echo -e "${YELLOW}⚠ Don't forget to update your Mapbox access token in index.js!${NC}"
    echo ""
fi

# Step 3: Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Done
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}✓ Setup complete!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo -e "Next steps:"
echo ""
echo -e "1. ${BLUE}Edit index.js${NC} - Add your Mapbox access token and demo code"
echo ""
echo -e "2. ${BLUE}Test locally:${NC}"
echo -e "   npm start"
echo ""
echo -e "3. ${BLUE}Deploy:${NC}"
echo -e "   ./deploy.sh"
echo ""
echo -e "Your demo will be live at:"
echo -e "${BLUE}https://demos.mapbox.com/${DEMO_NAME}/${NC}"
echo ""
