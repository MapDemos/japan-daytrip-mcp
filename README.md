# 🗾 Japan Day Trip MCP Assistant

> AI-powered Japan travel assistant with triple MCP architecture

An intelligent travel companion for exploring Japan, powered by Claude Sonnet 4 and three specialized MCP servers. Discover restaurants, shops, attractions, and plan day trips across Japan with rich tourism data and interactive mapping.

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
- 4 categories: **Eat** (restaurants), **Buy** (shopping), **Enjoy** (entertainment), **See** (sightseeing)
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

You'll need API keys from:
1. **Claude API**: Get from [console.anthropic.com](https://console.anthropic.com/)
2. **Mapbox Token**: Get from [account.mapbox.com](https://account.mapbox.com/access-tokens/)

### Setup

```bash
# 1. Clone or navigate to the project
cd japan-daytrip-mcp

# 2. Install dependencies
npm install

# 3. Configure API keys
# Open config.js and add your keys:
#   - CLAUDE_API_KEY: Your Claude API key
#   - MAPBOX_ACCESS_TOKEN: Your Mapbox access token

# 4. Start development server
npm start

# Your browser will open to http://localhost:5173
```

### Configuration

Edit `config.js`:

```javascript
export const CONFIG = {
  // Required: Add your API keys
  CLAUDE_API_KEY: 'sk-ant-...',        // From console.anthropic.com
  MAPBOX_ACCESS_TOKEN: 'pk.eyJ1...',   // From account.mapbox.com

  // Optional: Customize settings
  DEFAULT_LANGUAGE: 'en',               // 'en' or 'ja'
  DEFAULT_MAP_CENTER: [139.7671, 35.6812], // Tokyo
  MAX_RESULTS_PER_CATEGORY: 50,
  // ... more options
};
```

---

## 📦 Deployment

Deploy to `demos.mapbox.com` using the included deployment script:

```bash
# Build for production
npm run build

# Deploy (requires Mapbox AWS access)
./deploy.sh
```

**Live at:** `https://demos.mapbox.com/japan-daytrip-mcp/`

See [Mapbox Demo Template Guide](https://github.com/MapDemos/mapbox-demo-template) for deployment details.

---

## 🏗️ Architecture

### Framework + Demo Structure

This project has been refactored into a **reusable framework** that can be forked for other domains (real estate, ride hailing, etc.):

```
japan-daytrip-mcp/
├── framework/                      # 🎁 Reusable Framework (domain-agnostic)
│   ├── src/
│   │   ├── core/                   # Utilities, i18n, thinking simulator
│   │   ├── data/                   # DataSourceBase (abstract MCP client)
│   │   ├── ai/                     # Claude & Gemini clients
│   │   ├── map/                    # Map controller, Mapbox utilities
│   │   └── lambda/                 # AI proxy handler
│   └── README.md                   # Framework documentation
│
└── demos/japan-tourism/            # 🗾 Japan Tourism Demo (domain-specific)
    ├── modules/
    │   ├── rurubu-mcp-client.js    # Extends DataSourceBase
    │   └── japan-thinking-messages.js  # Custom thinking messages
    ├── translations/
    │   └── japan-i18n.js           # EN/JA translations
    └── data/
        └── jis.json                # JIS municipality codes
```

### Triple MCP System

```
User Query
    ↓
Claude Orchestrator (framework/src/ai/)
    ├─→ Mapbox MCP (hosted)
    │   └─→ Geocoding, routing, global POI search
    │
    ├─→ Rurubu MCP (demos/japan-tourism/)
    │   └─→ Japan tourism POIs with photos
    │
    └─→ Map Tools (framework/src/map/)
        └─→ Visualization: markers, routes, bounds
```

### Component Overview

| Component | Location | Purpose |
|-----------|----------|---------|
| **DataSourceBase** | `framework/src/data/` | Abstract base for domain MCP clients |
| **Claude Client** | `framework/src/ai/` | Orchestrate MCP sources |
| **Map Controller** | `framework/src/map/` | Manage Mapbox GL JS |
| **I18n Engine** | `framework/src/core/` | Translation system |
| **Thinking Simulator** | `framework/src/core/` | Thinking message engine |
| **Rurubu MCP** | `demos/japan-tourism/modules/` | Japan tourism data source |
| **Japan Translations** | `demos/japan-tourism/translations/` | EN/JA UI strings |

---

## 🛠️ Project Structure

```
japan-daytrip-mcp/
├── index.html              # Main HTML entry point
├── index.js                # Application orchestrator
├── config.js               # Configuration & API keys
├── styles/
│   └── main.css            # Application styles
│
├── framework/              # 🎁 Reusable Framework
│   ├── src/
│   │   ├── core/           # error-logger, utils, i18n, thinking-simulator
│   │   ├── data/           # data-source-base (abstract MCP client)
│   │   ├── ai/             # claude-client, gemini-client
│   │   ├── map/            # map-controller, mapbox-service-utils
│   │   ├── lambda/         # AI proxy handler
│   │   └── index.js        # Main framework exports
│   ├── package.json        # Framework package config
│   └── README.md           # Framework documentation
│
├── demos/japan-tourism/    # 🗾 Japan Tourism Demo
│   ├── modules/
│   │   ├── rurubu-mcp-client.js       # Domain MCP (extends DataSourceBase)
│   │   └── japan-thinking-messages.js # Custom thinking messages
│   ├── translations/
│   │   └── japan-i18n.js   # EN/JA translations
│   └── data/
│       └── jis.json        # JIS municipality codes (1900+ entries)
│
├── package.json            # Dependencies
├── vite.config.js          # Build configuration
├── deploy.sh               # Deployment script
└── README.md               # This file
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

### Quick Actions

Click category buttons for instant searches:
- 🍽️ **Restaurants** → Find dining spots
- 🛍️ **Shopping** → Discover stores
- 🎪 **Entertainment** → Fun activities
- 👁️ **Sightseeing** → Tourist attractions

### Voice Commands (planned)

*Voice interface coming in future version*

---

## 🔧 Development

### Running Locally

```bash
npm start     # Development server with hot reload
npm run build # Production build
npm run serve # Preview production build
```

### Creating a New Demo

The framework makes it easy to create new domain-specific demos. Here's how:

**1. Create your demo structure:**

```bash
mkdir -p demos/your-domain/{modules,translations,data}
```

**2. Create a domain-specific MCP client:**

```javascript
// demos/your-domain/modules/your-mcp-client.js
import { DataSourceBase } from '../../../framework/src/data/index.js';

export class YourMCPClient extends DataSourceBase {
  async initialize() {
    // Load your domain data (CSV, JSON, API)
    this.data = await this.loadData();
  }

  listTools() {
    return [
      {
        name: 'search_your_data',
        description: 'Search your domain-specific data',
        input_schema: { /* ... */ }
      }
    ];
  }

  async executeTool(toolName, args) {
    switch(toolName) {
      case 'search_your_data':
        return await this.searchData(args);
      default:
        return this.createErrorResult(`Unknown tool: ${toolName}`);
    }
  }
}
```

**3. Create custom thinking messages (optional):**

```javascript
// demos/your-domain/modules/your-thinking-messages.js
export class YourThinkingMessages {
  extractLocation(question) {
    // Extract location from user question
    // Return location name or null
  }

  generateMessages({ question, location, category, action, isJapanese }) {
    // Return array of contextual thinking messages
    return [
      '🔍 searching your domain...',
      '📊 analyzing results...',
      // ...
    ];
  }
}
```

**4. Create translations:**

```javascript
// demos/your-domain/translations/your-i18n.js
export const YOUR_TRANSLATIONS = {
  en: {
    title: 'Your Domain Assistant',
    subtitle: 'Discover your domain data',
    // ... all UI strings
  },
  // Add more languages as needed
};
```

**5. Update index.js to use your demo:**

```javascript
import { YourMCPClient } from './demos/your-domain/modules/your-mcp-client.js';
import { YOUR_TRANSLATIONS } from './demos/your-domain/translations/your-i18n.js';
import { YourThinkingMessages } from './demos/your-domain/modules/your-thinking-messages.js';

// Initialize with your demo
this.i18n = new I18n(CONFIG.DEFAULT_LANGUAGE, YOUR_TRANSLATIONS);
this.thinkingSimulator = new ThinkingSimulator(this.i18n, new YourThinkingMessages());
this.yourMCP = new YourMCPClient(this.config, this);
```

See `framework/README.md` for complete framework documentation and examples.

### Adding New Features to Japan Demo

**Example: Add a new Rurubu tool**

1. Edit `demos/japan-tourism/modules/rurubu-mcp-client.js`:
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
```

2. Implement tool execution:
```javascript
async executeTool(toolName, args) {
  switch(toolName) {
    case 'get_poi_photos':
      return await this.getPOIPhotos(args);
    // ...
  }
}
```

3. Claude will automatically discover and use the new tool!

---

## 🌐 API Reference

### Rurubu API

**Endpoint:** `https://www.j-jti.com/appif/sight`

**Parameters:**
- `appid`: Application ID (configured in `config.js`)
- `jis`: 5-digit JIS municipality code
- `lgenre`: Category code (1=see, 2=enjoy, 3=eat, 6=buy)
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

---

## 📊 Data Sources

### JIS Codes

Japan's standardized municipality codes:
- **Format:** 5-digit codes (e.g., `13113` = Shibuya, Tokyo)
- **Coverage:** All 47 prefectures, 1900+ municipalities
- **Source:** `data/jis.json` (copied from japan-real-estate demo)

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

### API Keys Not Working

1. Check `config.js` for correct keys
2. Verify Claude API key format: `sk-ant-...`
3. Verify Mapbox token format: `pk.eyJ...`
4. Check browser console for error messages

### Map Not Loading

1. Ensure Mapbox token is valid
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

---

## 🤝 Contributing

This is a Mapbox demo project. For improvements:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## 📄 License

ISC License

---

## 🙏 Acknowledgments

- **Claude** by Anthropic - AI orchestration
- **Mapbox** - Mapping and geospatial services
- **Rurubu** - Japan tourism data
- **Model Context Protocol (MCP)** - Tool integration standard

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/MapDemos/japan-daytrip-mcp/issues)
- **Mapbox Support:** [Mapbox Support](https://support.mapbox.com/)
- **Claude API:** [Anthropic Support](https://support.anthropic.com/)

---

**Built with ❤️ by Mapbox Solutions Architecture**

🗺️ Happy exploring Japan! 🗾
