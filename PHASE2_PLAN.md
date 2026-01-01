# Phase 2 Progress & Plan

## Completed ✅

### Phase 2a: Thinking Simulator
- **Framework**: `framework/src/core/thinking-simulator.js`
- **Demo**: `demos/japan-tourism/modules/japan-thinking-messages.js`
- **Status**: ✅ Complete & Committed (c9f5368)

### Phase 2b: I18n
- **Framework**: `framework/src/core/i18n.js`
- **Demo**: `demos/japan-tourism/translations/japan-i18n.js`
- **Status**: ✅ Complete & Committed (c9f5368)

---

## Remaining Work

### Phase 2c: Claude Client Abstraction
**Challenge**: 400+ line system prompt with Japan-specific content

**Current State** (`modules/claude-client.js`):
```javascript
buildSystemPrompt() {
  return `You are Kenji, a seasoned Japan travel expert...

  [400+ lines of Japan tourism instructions]
  - Rurubu API usage
  - JIS codes
  - Japanese locations
  - Temple/shrine/onsen categories
  - etc.
  `;
}
```

**Proposed Abstraction**:

**Framework**: `framework/src/ai/claude-client.js`
```javascript
export class ClaudeClient {
  constructor(apiKey, dataMCP, mapController, i18n, config, options = {}) {
    // ...
    this.promptBuilder = options.promptBuilder || this.buildDefaultPrompt.bind(this);
  }

  buildSystemPrompt(userLocation, mapView) {
    // Build context (location, map view)
    const context = this.buildLocationContext(userLocation, mapView);

    // Call custom prompt builder
    return this.promptBuilder(context, this.i18n.getCurrentLanguage());
  }

  buildDefaultPrompt(context, language) {
    return `${context}You are an AI assistant with map visualization tools.

    Use the available tools to search and display information on the map.
    Respond in ${language}.`;
  }
}
```

**Demo**: `demos/japan-tourism/prompts/japan-system-prompt.js`
```javascript
export function buildJapanPrompt(context, language) {
  return `${context}You are Kenji, a seasoned Japan travel expert...

  [Full 400+ line Japan tourism prompt]
  `;
}
```

**Usage in Demo**:
```javascript
import { ClaudeClient } from 'mapbox-ai-framework/ai';
import { buildJapanPrompt } from './prompts/japan-system-prompt.js';

const claudeClient = new ClaudeClient(apiKey, rurubuMCP, mapController, i18n, config, {
  promptBuilder: buildJapanPrompt
});
```

---

### Phase 2d: Gemini Client Abstraction
**Status**: Similar approach as Claude client

**Framework**: `framework/src/ai/gemini-client.js`
- Same abstraction pattern
- Pluggable prompt builder

**Demo**: Use same `buildJapanPrompt` function

---

## Alternative Approach (Simpler)

Instead of fully abstracting Claude/Gemini clients now, we could:

1. **Copy them to framework as-is** for now
2. **Make prompt customizable** via constructor options
3. **Complete Phases 3-6** (map controller, AppBase, imports, testing)
4. **Come back later** to polish AI client abstractions

This would let us:
- Get to a working demo faster
- Test the framework end-to-end
- Refine AI abstractions based on real usage

---

## Recommendation

Given the complexity of the 400+ line Japan prompt and time constraints:

**Option A**: Continue Phase 2c+2d (extract prompts) - 1-2 hours
**Option B**: Skip to Phase 3-6 (get working demo) - return to 2c+2d later - 30 minutes

I recommend **Option B** because:
1. We've already abstracted the most reusable parts (DataSourceBase, thinking, i18n)
2. Testing a working demo will inform better AI abstractions
3. The prompt can be externalized later without breaking anything
4. Users can still override prompts via constructor parameters

What would you prefer?
