#!/bin/bash

# Mapbox Demo Deployment Script
# Builds and deploys to demos.mapbox.com via mbx/AWS CLI

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get demo name from package.json or use directory name
DEMO_NAME=${1:-$(basename $(pwd))}
S3_BUCKET="demos.mapbox.com"
S3_PATH="s3://${S3_BUCKET}/${DEMO_NAME}/"
BUILD_DIR="./build"

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}Deploying: ${GREEN}${DEMO_NAME}${NC}"
echo -e "${BLUE}Target: ${GREEN}${S3_PATH}${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Step 1: Setup Mapbox CLI environment
echo -e "${BLUE}Setting up Mapbox CLI environment...${NC}"

# Try to source mbxcli from common locations
MBXCLI_PATHS=(
    "/opt/homebrew/lib/node_modules/@mapbox/mbxcli/bin/mapbox.sh"
    "/usr/local/lib/node_modules/@mapbox/mbxcli/bin/mapbox.sh"
    "$(npm root -g 2>/dev/null)/@mapbox/mbxcli/bin/mapbox.sh"
)

MBXCLI_FOUND=false
for path in "${MBXCLI_PATHS[@]}"; do
    if [ -f "$path" ]; then
        source "$path"
        echo -e "${GREEN}✓ Mapbox CLI environment loaded from: $path${NC}"
        MBXCLI_FOUND=true
        break
    fi
done

if [ "$MBXCLI_FOUND" = false ]; then
    echo -e "${YELLOW}⚠ mbxcli not found in common locations${NC}"
    echo -e "${YELLOW}  Attempting to use AWS CLI directly...${NC}"
fi

# Step 2: Check if mbx command is available
if command -v mbx &> /dev/null; then
    echo -e "${BLUE}Authenticating with Mapbox...${NC}"

    # Run mbx env to set up AWS credentials
    if mbx env &> /dev/null; then
        echo -e "${GREEN}✓ Mapbox authentication successful${NC}"
    else
        echo -e "${YELLOW}⚠ mbx env failed, trying direct AWS access...${NC}"
    fi
else
    echo -e "${YELLOW}⚠ mbx command not found${NC}"
    echo -e "${YELLOW}  Install with: npm install -g @mapbox/mbxcli${NC}"
    echo -e "${YELLOW}  Falling back to standard AWS CLI...${NC}"
fi
echo ""

# Step 3: Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    echo "Install it from: https://aws.amazon.com/cli/"
    exit 1
fi

# Step 4: Check AWS credentials
echo -e "${BLUE}Checking AWS credentials...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    echo ""
    echo "Try one of these:"
    echo "  1. mbx login               (Mapbox employees)"
    echo "  2. aws configure           (AWS access keys)"
    echo "  3. aws sso login           (AWS SSO)"
    exit 1
fi

CALLER_IDENTITY=$(aws sts get-caller-identity)
echo -e "${GREEN}✓ Authenticated as:${NC}"
echo "$CALLER_IDENTITY" | grep -E "(UserId|Account|Arn)"
echo ""

# Step 5: Install dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}Installing dependencies...${NC}"
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
    echo ""
fi

# Step 6: Build
echo -e "${BLUE}Building project...${NC}"
npm run build

if [ ! -d "$BUILD_DIR" ]; then
    echo -e "${RED}Error: Build directory not found: ${BUILD_DIR}${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Step 7: Upload to S3
echo -e "${BLUE}Uploading to S3...${NC}"
aws s3 sync "$BUILD_DIR" "$S3_PATH" \
  --delete \
  --cache-control "public, max-age=3600"

echo -e "${GREEN}✓ Upload complete${NC}"
echo ""

# Step 8: Optional - Invalidate CloudFront (if distribution ID is set)
if [ ! -z "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo -e "${BLUE}Invalidating CloudFront cache...${NC}"
    aws cloudfront create-invalidation \
      --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
      --paths "/${DEMO_NAME}/*" \
      > /dev/null
    echo -e "${GREEN}✓ CloudFront invalidated${NC}"
    echo ""
fi

# Done
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}✓ Deployment successful!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo -e "View your demo at:"
echo -e "${BLUE}https://demos.mapbox.com/${DEMO_NAME}/${NC}"
echo ""
