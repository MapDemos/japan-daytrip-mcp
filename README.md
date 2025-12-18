# Mapbox Demo Template

> Simple deployment template for Mapbox demos on `demos.mapbox.com`

This repository is a **template** for creating and deploying Mapbox demos. Deploy with one command using the included deployment script.

## 🚀 Quick Start

### Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

### Deployment

```bash
# 1. Run setup (auto-configures based on folder name)
./setup.sh

# 2. Add your Mapbox token to index.js
# (edit index.js and replace YOUR_MAPBOX_ACCESS_TOKEN)

# 3. Deploy!
./deploy.sh

# 🎉 Live at: https://demos.mapbox.com/your-folder-name/
```

---

## 📦 What's Included

- ✅ **Vite** - Fast development and optimized builds
- ✅ **Mapbox GL JS** - Latest version with TypeScript support
- ✅ **Deployment script** - One-command deploy to S3
- ✅ **ES2020 target** - Modern JavaScript with BigInt support
- ✅ **mbx integration** - Automatic Mapbox authentication

---

## 🎯 Using This Template

### 1. Create New Demo from Template

On GitHub:
1. Click **"Use this template"** → **"Create a new repository"**
2. Name your demo (e.g., `my-awesome-demo`)
3. Clone it locally

```bash
cd ~/your-workspace
git clone https://github.com/YOUR-USERNAME/my-awesome-demo.git
cd my-awesome-demo
```

### 2. Run Setup

```bash
# Auto-configures based on folder name
./setup.sh
```

This will:
- Update `package.json` with folder name
- Install dependencies
- Show next steps

### 3. Customize & Deploy

Edit `index.js`:
```javascript
// Replace with your Mapbox access token
mapboxgl.accessToken = "pk.YOUR_TOKEN_HERE";

// Add your demo code in the map.on("load") callback
map.on("load", () => {
  // Your awesome demo code here!
});
```

Deploy:
```bash
# Authenticate with Mapbox (first time only)
source "/opt/homebrew/lib/node_modules/@mapbox/mbxcli/bin/mapbox.sh"
mbx env

# Deploy (uses folder name automatically)
./deploy.sh
```

**That's it!** Your demo is live at:
```
https://demos.mapbox.com/my-awesome-demo/
```

---

## 🔧 Prerequisites

### For Deployment

1. **Mapbox CLI (mbxcli)** - For authentication
   ```bash
   # Usually already installed for Mapbox employees
   mbx env  # Test if it works
   ```

2. **AWS CLI** - For S3 uploads
   ```bash
   # Install via Homebrew
   brew install awscli

   # Verify installation
   aws --version
   ```

3. **Node.js 18+**
   ```bash
   node --version
   ```

### For Development

Just Node.js - deployment tools are optional for local development.

---

## 📖 Scripts

### setup.sh - Initial Configuration

Automatically configures your demo based on folder name:

```bash
./setup.sh
```

**What it does:**
- ✅ Detects folder name (e.g., `my-awesome-demo`)
- ✅ Updates `package.json` name and build path
- ✅ Installs dependencies
- ✅ Shows next steps

**Run once** when you first create a demo from the template.

### deploy.sh - Deployment

Deploys your demo to demos.mapbox.com:

```bash
./deploy.sh
```

**What it does:**
- ✅ Loads Mapbox CLI environment
- ✅ Authenticates with `mbx env`
- ✅ Builds your project
- ✅ Uploads to S3: `s3://demos.mapbox.com/folder-name/`
- ✅ Sets cache headers
- ✅ Shows live URL

**No parameters needed** - automatically uses folder name.

**Optional - CloudFront cache invalidation:**
```bash
export CLOUDFRONT_DISTRIBUTION_ID="E123456789"
./deploy.sh
```

---

## 🔍 Project Structure

```
your-demo/
├── .github/
│   └── workflows/
│       └── deploy-production.yml  # Optional: GitHub Actions
├── lib/                            # Legacy publisher scripts
├── index.html                      # Entry point
├── index.js                        # Your demo code
├── package.json                    # Dependencies & build config
├── vite.config.js                  # Build configuration
├── setup.sh                        # Initial setup script ⭐
├── deploy.sh                       # Deployment script ⭐
└── README.md                       # This file
```

---

## 📚 Documentation

- **[Mapbox GL JS Docs](https://docs.mapbox.com/mapbox-gl-js/)** - API reference
- **[Vite Docs](https://vitejs.dev/)** - Build tool documentation

---

## 🆘 Troubleshooting

### "mbx: command not found"

```bash
# Check if mbxcli is installed
ls /opt/homebrew/lib/node_modules/@mapbox/mbxcli

# If not found, contact #solutions-arch on Slack
```

### "AWS credentials not configured"

```bash
# Run mbx env to authenticate
source "/opt/homebrew/lib/node_modules/@mapbox/mbxcli/bin/mapbox.sh"
mbx env

# Verify AWS access
aws sts get-caller-identity
```

### Deployment fails with "AccessDenied"

Contact your AWS admin - you may need additional S3 permissions for the `demos.mapbox.com` bucket.

### More help

- Create an issue on GitHub
- Contact Solutions Architecture: `#solutions-arch` on Slack

---

## 📝 License

ISC
