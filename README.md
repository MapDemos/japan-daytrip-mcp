# 🗾 Japan Day Trip MCP Assistant

> AI-powered Japan travel assistant with triple MCP architecture

An intelligent travel companion for exploring Japan, powered by Claude Haiku and three specialized MCP servers. Discover restaurants, shops, attractions, and plan day trips across Japan with rich tourism data and interactive mapping.

**Live Demo:** https://demos.mapbox.com/japan-daytrip-mcp/

---

## ✨ Features

### 🤖 Triple MCP Architecture
- **Mapbox MCP** (hosted): Global geospatial services, geocoding, routing
- **Rurubu MCP** (client-side): Japan-specific POI data with photos and details
- **Map Tools MCP** (CDN): Interactive map visualization

### 🌏 All-Japan Coverage
- **1,900+ municipalities** via JIS (Japanese Industrial Standard) codes
- Coverage from Hokkaido to Okinawa
- City and ward-level search precision

### 🗺️ Rich Tourism Data
- **7 categories:**
  - 🏛️ **見る (See)** - Sightseeing, temples, shrines
  - 🎪 **遊ぶ (Play)** - Entertainment, activities
  - 🍽️ **食べる (Eat)** - Restaurants, dining
  - ☕ **喫茶・甘味 (Cafe)** - Tea houses, sweets
  - 🌃 **ナイトスポット (Nightlife)** - Bars, clubs
  - 🛍️ **買う (Buy)** - Shopping centers, stores
  - ♨️ **温泉他 (Onsen)** - Hot springs, spas
- Photo galleries for each location
- Operating hours, prices, and contact information
- Ratings and rankings

### 🗣️ Bilingual Interface
- **English** and **Japanese** (日本語) support
- One-click language switching
- Localized UI and system messages

### 🎨 Modern UI
- Responsive design for desktop and mobile
- Real-time map updates
- Interactive chat interface
- Quick action category buttons

---

## 🚀 Quick Start

### Prerequisites

You'll need:
1. **Mapbox Token**: Get from [account.mapbox.com](https://account.mapbox.com/access-tokens/)
2. **Note**: Claude API is accessed via a pre-configured Lambda proxy (no API key needed)

### Setup

```bash
# 1. Clone or navigate to the project
cd japan-daytrip-mcp

# 2. Install dependencies (including private @mapdemos packages)
npm install

# 3. Configure Mapbox token
# Open config.js and add your token:
#   - MAPBOX_ACCESS_TOKEN: Your Mapbox access token

# 4. Start development server
npm start

# Your browser will open to http://localhost:5173
```

### Configuration

Edit `config.js`:

```javascript
export const CONFIG = {
  // Required: Add your Mapbox token
  MAPBOX_ACCESS_TOKEN: 'pk.eyJ1...',   // From account.mapbox.com

  // Pre-configured Lambda proxy for Claude API
  LAMBDA_URL: 'https://okqfpyxf4oe6htegrlcgrwdssa0yoxcr.lambda-url.us-east-1.on.aws/',

  // Optional: Customize settings
  DEFAULT_LANGUAGE: 'en',               // 'en' or 'ja'
  DEFAULT_MAP_CENTER: [139.7671, 35.6812], // Tokyo
  MAX_RESULTS_PER_CATEGORY: 50,
  MODEL_ID: 'claude-haiku-4-5-20251001',  // Claude model version
  // ... more options
};
```

---

## 📦 Deployment

### Production Build & Deploy

```bash
# Build for production
npm run build

# Deploy to demos.mapbox.com (requires AWS access)
./deploy.sh
```

### CI/CD Pipeline

The project includes GitHub Actions for automated deployment:

```yaml
# .github/workflows/deploy-production.yml
# Triggers on push to 'publisher-production' branch
# Builds and deploys to S3 bucket: demos.mapbox.com/japan-daytrip-mcp/
```

**Live at:** `https://demos.mapbox.com/japan-daytrip-mcp/`

---

## 🏗️ Architecture

### Framework Architecture

This project uses the **@mapdemos/ai-framework** npm package (v0.2.1) to provide reusable components for AI-powered map applications:

```
japan-daytrip-mcp/
├── node_modules/
│   └── @mapdemos/ai-framework/     # Reusable framework (npm package)
│       ├── src/
│       │   ├── core/               # Utilities, i18n, thinking simulator
│       │   ├── data/               # DataSourceBase (abstract MCP client)
│       │   ├── ai/                 # Claude & Gemini clients
│       │   ├── map/                # Map controller, Mapbox utilities
│       │   └── lambda/             # AI proxy handler
│       └── package.json
│
└── [project root]                  # This Japan tourism implementation
    ├── modules/
    │   ├── rurubu-mcp-client.js    # Extends DataSourceBase from framework
    │   └── japan-thinking-messages.js  # Custom thinking messages
    ├── prompts/
    │   └── japan-system-prompt.js  # Claude system prompt (579 lines)
    ├── translations/
    │   └── japan-i18n.js           # EN/JA translations
    └── data/
        ├── jis.json                # JIS municipality codes (1900+ entries)
        ├── LGenre_master.csv       # Large genre categories
        ├── MGenre_master.csv       # Medium genre classifications
        ├── SGenre_master.csv       # Small genre classifications
        ├── levelcodes.csv          # Administrative level codes
        └── parameters.csv          # API parameters reference
```

### Triple MCP System

```
User Query
    ↓
Claude Orchestrator (via Lambda proxy)
    ├─→ Mapbox MCP (hosted at https://mcp.mapbox.com/mcp)
    │   └─→ Geocoding, routing, global POI search
    │
    ├─→ Rurubu MCP (client-side in this app)
    │   └─→ Japan tourism POIs with photos
    │
    └─→ Map Tools (CDN-based visualization)
        └─→ Display markers, routes, bounds
```

### Component Overview

| Component | Location | Purpose |
|-----------|----------|---------|
| **BaseApp** | `@mapdemos/ai-framework` | Base application class with initialization, UI, and flow control |
| **DataSourceBase** | `@mapdemos/ai-framework` | Abstract base for domain MCP clients |
| **Claude Client** | `@mapdemos/ai-framework` | Orchestrate MCP sources |
| **Map Controller** | `@mapdemos/ai-framework` | Manage Mapbox GL JS |
| **I18n Engine** | `@mapdemos/ai-framework` | Translation system |
| **Thinking Simulator** | `@mapdemos/ai-framework` | Thinking message engine |
| **JapanDayTripApp** | `index.js` | Main app class extending BaseApp (1,463 lines) |
| **Rurubu MCP** | `modules/rurubu-mcp-client.js` | Japan tourism data source (843 lines) |
| **System Prompt** | `prompts/japan-system-prompt.js` | Claude instructions (579 lines) |
| **Thinking Messages** | `modules/japan-thinking-messages.js` | Custom thinking (499 lines) |
| **Japan Translations** | `translations/japan-i18n.js` | EN/JA UI strings |

---

## 🛠️ Project Structure

```
japan-daytrip-mcp/
├── index.html                      # Main HTML entry point
├── index.js                        # Application orchestrator (1,463 lines)
├── config.js                       # Configuration & API keys (275 lines)
├── vite.config.js                  # Build configuration
├── package.json                    # Dependencies (includes @mapdemos/ai-framework)
├── deploy.sh                       # Deployment script
├── DEPLOYMENT.md                   # Deployment documentation
│
├── styles/
│   └── main.css                    # Application styles (18KB)
│
├── modules/                        # Domain-specific business logic
│   ├── rurubu-mcp-client.js       # Rurubu API client (843 lines)
│   └── japan-thinking-messages.js # Thinking messages (499 lines)
│
├── prompts/
│   └── japan-system-prompt.js     # Claude system prompt (579 lines)
│
├── translations/
│   └── japan-i18n.js              # EN/JA translations
│
├── data/                           # Static data files
│   ├── jis.json                   # JIS municipality codes (472KB)
│   ├── LGenre_master.csv          # POI categories
│   ├── MGenre_master.csv          # Medium genres
│   ├── SGenre_master.csv          # Small genres
│   ├── levelcodes.csv             # Administrative levels
│   └── parameters.csv             # API parameters
│
├── public/
│   └── data/                      # Data files for public access
│
├── build/                          # Production build output (generated)
│   ├── index.html
│   ├── assets/                    # Bundled JS & CSS
│   └── data/                      # Copied data files
│
├── .github/
│   └── workflows/
│       └── deploy-production.yml  # GitHub Actions CI/CD
│
└── node_modules/
    └── @mapdemos/
        └── ai-framework/          # Reusable framework package
```

---

## 💡 Usage Examples

### Text Queries

```
"Find restaurants in Shibuya"
→ Shows 50+ restaurants with photos, prices, hours

"Show me temples in Kyoto"
→ Displays famous temples with cultural information

"Plan a day trip in Asakusa"
→ Creates itinerary with multiple categories

"Route from Tokyo Station to Shibuya"
→ Shows route with travel time
```
---

## 🔧 Development

### Running Locally

```bash
npm start     # Development server with hot reload (port 5173)
npm run build # Production build
npm run serve # Preview production build
```

### Extending the Application

Since this project uses `@mapdemos/ai-framework` as an npm package, customization focuses on domain-specific implementations:

**1. Add new Rurubu tools:**

Edit `modules/rurubu-mcp-client.js`:
```javascript
listTools() {
  return [
    // ... existing tools
    {
      name: 'get_poi_photos',
      description: 'Get photo gallery for a POI',
      input_schema: { /* ... */ }
    }
  ];
}

async executeTool(toolName, args) {
  switch(toolName) {
    case 'get_poi_photos':
      return await this.getPOIPhotos(args);
    // ...
  }
}
```

**2. Customize thinking messages:**

Edit `modules/japan-thinking-messages.js`:
```javascript
generateMessages({ question, location, category, action, isJapanese }) {
  // Add your custom thinking patterns
  return [
    '🔍 Searching tourism database...',
    '📊 Analyzing results...',
    // ...
  ];
}
```

**3. Modify system prompt:**

Edit `prompts/japan-system-prompt.js` to adjust Claude's behavior and responses.

**4. Add translations:**

Edit `translations/japan-i18n.js` to add or modify UI strings in English and Japanese.

### Creating a New Domain Application

To create a similar application for a different domain:

1. **Fork or copy this repository**
2. **Keep the framework dependency:**
   ```json
   "@mapdemos/ai-framework": "^0.2.1"
   ```
3. **Replace domain-specific files:**
   - Create your own MCP client extending `DataSourceBase`
   - Write your custom system prompt
   - Add your translations
   - Implement your thinking messages
4. **Update `index.js`** to use your components

---

## 🌐 API Reference

### Rurubu API

**Endpoint:** `https://www.j-jti.com/appif/sight`

**Parameters:**
- `appid`: Application ID (configured in `config.js`)
- `jis`: 5-digit JIS municipality code
- `lgenre`: Category code (1=see, 2=enjoy, 3=eat, 4=cafe, 5=nightlife, 6=buy, 7=onsen)
- `pagecount`: Results per page (1-100)
- `pageno`: Page number
- `responsetype`: Response format (json)

**Example:**
```
https://www.j-jti.com/appif/sight?appid=n2xNzqos7NirxGBJ&jis=13113&lgenre=3&pagecount=50&pageno=1&responsetype=json
```

### Mapbox MCP Server

**Endpoint:** `https://mcp.mapbox.com/mcp`

**Available Tools:**
- `category_search_tool`: Search POIs globally
- Geocoding tools
- Routing tools
- (See Mapbox MCP documentation for full list)

### Claude API (via Lambda Proxy)

**Endpoint:** `https://okqfpyxf4oe6htegrlcgrwdssa0yoxcr.lambda-url.us-east-1.on.aws/`

**Model:** `claude-haiku-4-5-20251001`
**Max Tokens:** 4,096 response, 200k context

---

## 📊 Data Sources

### JIS Codes
Japan's standardized municipality codes:
- **Format:** 5-digit codes (e.g., `13113` = Shibuya, Tokyo)
- **Coverage:** All 47 prefectures, 1900+ municipalities
- **Source:** `data/jis.json`

### Genre Classifications
POI categorization system with three levels:
- **Large Genres** (`LGenre_master.csv`): Main categories
- **Medium Genres** (`MGenre_master.csv`): Subcategories
- **Small Genres** (`SGenre_master.csv`): Detailed classifications

### Rurubu POI Database
Tourism information from Rurubu (るるぶ), Japan's leading travel guide:
- Restaurants, shops, attractions, activities
- Photos, descriptions, practical information
- Ratings and rankings

---

## 🎨 Customization

### Theming

Edit `styles/main.css` CSS variables:

```css
:root {
  --primary-red: #d32f2f;
  --primary-blue: #1976d2;
  --accent-orange: #ff6f00;
  /* ... */
}
```

### Default Location

Change default map center in `config.js`:

```javascript
DEFAULT_MAP_CENTER: [139.7671, 35.6812],  // [longitude, latitude]
DEFAULT_MAP_ZOOM: 11,
```

### Language

Set default language:

```javascript
DEFAULT_LANGUAGE: 'ja',  // 'en' or 'ja'
```

---

## 🐛 Troubleshooting

### Map Not Loading

1. Ensure Mapbox token is valid in `config.js`
2. Check browser supports WebGL
3. Clear browser cache
4. Try different browser

### No POIs Found

1. Try different location names (e.g., "Shibuya" instead of "Shibuya-ku")
2. Check if location is in Japan
3. Try broader search (e.g., "Tokyo" instead of specific ward)

### Build Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf build node_modules/.vite
npm run build
```

### Private Package Access

If you get errors installing `@mapdemos/ai-framework`:
1. Ensure you have access to the private npm registry
2. Check your npm authentication
3. Contact the Mapbox Solutions Architecture team

---

## 🙏 Acknowledgments

- **Claude** by Anthropic - AI orchestration
- **Mapbox** - Mapping and geospatial services
- **Rurubu** - Japan tourism data
- **Model Context Protocol (MCP)** - Tool integration standard

---

**Built with ❤️ by Mapbox Solutions Architecture**

🗺️ Happy exploring Japan! 🗾