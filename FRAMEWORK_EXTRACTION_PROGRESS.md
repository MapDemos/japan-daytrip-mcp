# Framework Extraction Progress

## Overview

Refactoring the Japan Day Trip MCP demo into a reusable framework that can be forked for other domains (real estate, ride hailing, etc.).

**Branch**: `feature/framework-extraction`
**Started**: 2026-01-01
**Status**: Phase 1 Complete (Foundation)

---

## Progress Summary

### ✅ Phase 1: Foundation (COMPLETED)

**Created:**
1. **Framework Structure**
   - `framework/src/core/` - Error handling, utils
   - `framework/src/data/` - DataSourceBase abstract class
   - `framework/src/map/` - Mapbox utilities
   - `framework/src/ai/` - (placeholder for AI clients)
   - `framework/src/lambda/` - AI proxy handler

2. **Core Framework Files**
   - ✅ `framework/src/core/error-logger.js` - Copied
   - ✅ `framework/src/core/utils.js` - Copied
   - ✅ `framework/src/map/mapbox-service-utils.js` - Copied
   - ✅ `framework/src/lambda/handler.js` - Copied
   - ✅ `framework/src/data/data-source-base.js` - Created (NEW)
   - ✅ `framework/src/core/index.js` - Export barrel
   - ✅ `framework/src/data/index.js` - Export barrel
   - ✅ `framework/src/map/index.js` - Export barrel
   - ✅ `framework/package.json` - NPM package config
   - ✅ `framework/README.md` - Comprehensive documentation

3. **Demo Structure**
   - ✅ `demos/japan-tourism/modules/` - Domain MCP client
   - ✅ `demos/japan-tourism/data/` - JIS codes, genre data
   - ✅ `demos/japan-tourism/prompts/` - (placeholder)
   - ✅ `demos/japan-tourism/translations/` - (placeholder)

**Copied Files:**
- ✅ Domain data to `demos/japan-tourism/data/` (jis.json, genre CSVs)
- ✅ `rurubu-mcp-client.js` to `demos/japan-tourism/modules/`

---

## Remaining Work

### 🚧 Phase 2: AI Abstraction

**Files to Refactor:**
1. `modules/thinking-simulator.js` →
   - Core engine: `framework/src/core/thinking-simulator.js`
   - Japan messages: `demos/japan-tourism/modules/japan-thinking-messages.js`

2. `modules/i18n.js` →
   - Core engine: `framework/src/core/i18n.js`
   - Japan translations: `demos/japan-tourism/translations/japan-i18n.js`

3. `modules/claude-client.js` →
   - Base client: `framework/src/ai/claude-client.js`
   - Japan prompt: `demos/japan-tourism/prompts/japan-system-prompt.js`

4. `modules/gemini-client.js` →
   - Base client: `framework/src/ai/gemini-client.js`

**Tasks:**
- [ ] Extract thinking message generation to config
- [ ] Separate i18n engine from translations
- [ ] Create prompt builder abstraction in AI clients
- [ ] Move Japan-specific prompts to demos folder

### 🚧 Phase 3: Map Abstraction

**Files to Refactor:**
1. `modules/map-controller.js` →
   - Core controller: `framework/src/map/map-controller.js`
   - POI formatting: Make customizable via options

**Tasks:**
- [ ] Extract POI display logic to customization hooks
- [ ] Make marker formatting pluggable
- [ ] Keep tool execution generic

### 🚧 Phase 4: App Abstraction

**Files to Refactor:**
1. `index.js` →
   - Base app: `framework/src/app/app-base.js`
   - Demo glue: `index.js` (much smaller)

**Tasks:**
- [ ] Create AppBase with common orchestration
- [ ] Define override points (initializeDataSource, buildSystemPrompt)
- [ ] Extract UI management
- [ ] Simplify demo's index.js to ~30 lines

### 🚧 Phase 5: Update Imports

**Tasks:**
- [ ] Update `index.js` to import from framework
- [ ] Update `config.js` if needed
- [ ] Create `demos/japan-tourism/index.js` if separating further
- [ ] Test all imports resolve correctly

### 🚧 Phase 6: Testing

**Tasks:**
- [ ] Build application (`npm run build`)
- [ ] Test all functionality:
  - [ ] Map loads correctly
  - [ ] Search POIs works
  - [ ] Recommendations display
  - [ ] Star markers show numbers
  - [ ] Alternatives show "-"
  - [ ] Error handling works
  - [ ] Rate limiting works
  - [ ] Token management works
- [ ] Fix any issues
- [ ] Performance check

### 🚧 Phase 7: Documentation

**Tasks:**
- [ ] Create `demos/japan-tourism/README.md`
- [ ] Document what's framework vs demo
- [ ] Create migration guide
- [ ] Add comments to demo code
- [ ] Update main README.md

---

## Architecture

### Current State

```
japan-daytrip-mcp/
├── framework/               # ✅ NEW - Framework code
│   ├── src/
│   │   ├── core/           # ✅ Error handling, utils
│   │   ├── ai/             # 🚧 AI clients (needs work)
│   │   ├── map/            # ✅ Mapbox utilities
│   │   ├── data/           # ✅ DataSourceBase
│   │   └── lambda/         # ✅ AI proxy
│   ├── package.json        # ✅ Framework package config
│   └── README.md           # ✅ Framework docs
├── demos/
│   └── japan-tourism/      # ✅ NEW - Demo specific code
│       ├── modules/        # ✅ rurubu-mcp-client.js
│       ├── data/           # ✅ JIS codes, genres
│       ├── prompts/        # 🚧 System prompts (needs work)
│       └── translations/   # 🚧 i18n (needs work)
├── modules/                # ⚠️ OLD - To be refactored
│   ├── claude-client.js    # 🚧 Needs abstraction
│   ├── gemini-client.js    # 🚧 Needs abstraction
│   ├── thinking-simulator.js  # 🚧 Needs abstraction
│   ├── i18n.js             # 🚧 Needs abstraction
│   └── map-controller.js   # 🚧 Needs abstraction
├── index.js                # ⚠️ Needs simplification
└── config.js               # ✅ OK (demo-specific)
```

### Target State

```
japan-daytrip-mcp/
├── framework/              # Framework package
│   ├── src/
│   │   ├── core/          # ✅ Complete
│   │   ├── ai/            # Claude/Gemini (abstracted)
│   │   ├── map/           # Map controller (abstracted)
│   │   ├── data/          # ✅ DataSourceBase
│   │   ├── app/           # AppBase
│   │   └── lambda/        # ✅ AI proxy
│   └── README.md          # ✅ Complete
├── demos/
│   └── japan-tourism/     # Demo code
│       ├── modules/
│       │   └── rurubu-mcp-client.js  # ✅ Extends DataSourceBase
│       ├── prompts/
│       │   └── system-prompt.js      # Japan-specific prompt
│       ├── translations/
│       │   └── i18n.js               # Japan translations
│       └── data/          # ✅ JIS codes, genres
├── index.js               # ~30 lines (uses AppBase)
└── config.js              # Demo config
```

---

## Key Abstractions Created

### 1. DataSourceBase

**Location**: `framework/src/data/data-source-base.js`

**Purpose**: Abstract base class for domain-specific MCP clients

**Required Methods**:
- `initialize()` - Load data
- `listTools()` - Define tools
- `executeTool(toolName, args)` - Execute tool

**Helper Methods**:
- `parseCSV(text)` - Parse CSV files
- `toGeoJSON(results, mapper)` - Convert to GeoJSON
- `createToolResult(data)` - Format results
- `createErrorResult(message)` - Format errors

**Usage Example**:
```javascript
export class RealEstateMCP extends DataSourceBase {
  async initialize() {
    this.properties = await fetch('./data/listings.json').then(r => r.json());
  }

  listTools() {
    return [{
      name: 'search_properties',
      description: 'Search properties...',
      inputSchema: { /* ... */ }
    }];
  }

  async executeTool(toolName, args) {
    // Search logic
  }
}
```

---

## Next Steps

1. **Continue Phase 2**: Abstract thinking-simulator
2. **Continue Phase 2**: Abstract i18n
3. **Continue Phase 2**: Abstract AI clients
4. **Move to Phase 3**: Abstract map-controller
5. **Move to Phase 4**: Create AppBase

**Estimated Time**: 2-3 more hours to complete all phases

---

## Success Criteria

- [ ] Framework is domain-agnostic (no Japan code)
- [ ] Demo code is <500 lines (vs 11,000 total)
- [ ] Application works identically after refactor
- [ ] Clear separation between framework and demo
- [ ] Easy to create new demos (real estate example)

---

## Notes

- Using in-place refactoring (Option C - Hybrid approach)
- Can later extract framework to separate repo
- Maintains git history
- Safe to test incrementally
