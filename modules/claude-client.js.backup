/**
 * Claude Client
 * Handles communication with Claude API and coordinates dual MCP architecture
 * - Rurubu MCP (client-side virtual server)
 * - Map Tools MCP (visualization library)
 */

import { errorLogger } from './error-logger.js';

export class ClaudeClient {
  constructor(apiKey, rurubuMCP, mapController, i18n, config, app = null, onRurubuData = null) {
    this.apiKey = apiKey;
    this.rurubuMCP = rurubuMCP;
    this.mapController = mapController;
    this.i18n = i18n;
    this.config = config;
    this.app = app; // Reference to main app for search history management
    this.onRurubuData = onRurubuData; // Callback to store full Rurubu POI data
    this.conversationHistory = [];

    // Token caching - separate Map to avoid polluting message objects sent to API
    this.messageTokenCache = new WeakMap(); // WeakMap allows garbage collection of old messages
    this._cachedSystemPromptTokens = undefined;
    this._lastSystemPrompt = undefined;

    // Context tracking
    this.userLocation = null; // User's current location
    this.mapView = null; // Current map view (center, zoom, bounds)

    this.systemPrompt = this.buildSystemPrompt();

    // Token management
    this.MAX_TOKENS = config.MAX_CONTEXT_TOKENS || 200000;
    this.PRUNE_THRESHOLD = config.PRUNE_THRESHOLD_TOKENS || 160000; // Start pruning at 80% capacity
    this.WARNING_THRESHOLD = config.WARNING_THRESHOLD_TOKENS || 140000; // Show warning at 70% capacity
    this.conversationSummary = null; // Store summary of pruned messages
  }

  /**
   * Build the system prompt for Claude
   */
  buildSystemPrompt(userLocation = null, mapView = null) {
    // Get current language
    const currentLang = this.i18n.getCurrentLanguage();
    const langName = currentLang === 'ja' ? 'Japanese' : 'English';

    let locationContext = '';
    if (userLocation) {
      const coords = `${userLocation.latitude.toFixed(6)}, ${userLocation.longitude.toFixed(6)}`;
      const placeName = userLocation.placeName || userLocation.name;

      if (placeName) {
        locationContext = `\n\nUSER LOCATION:\n- Current location: ${placeName}\n- Coordinates: ${coords}\n- When user asks "around me", "near me", "nearby", use this location as reference\n- For location-based searches, search in the nearest city/ward`;
      } else {
        locationContext = `\n\nUSER LOCATION:\n- Current location: ${coords}\n- When user asks "around me", "near me", "nearby", use this location as reference\n- For location-based searches, use reverse geocoding or find the nearest city/ward`;
      }
    }

    let mapViewContext = '';
    if (mapView) {
      const { center, zoom, bounds, placeName, name } = mapView;
      const coords = `${center.lat.toFixed(4)}°N, ${center.lng.toFixed(4)}°E`;

      if (placeName || name) {
        const location = placeName || name;
        mapViewContext = `Map view: ${location} (${coords}, zoom ${zoom.toFixed(1)})

"where is this?" = ${location} (NOT POI markers)
"search here" = search in ${location}
"what's here?" = call get_poi_summary first

`;
      } else {
        mapViewContext = `Map view: ${coords} (zoom ${zoom.toFixed(1)})

"where is this?" = ${coords} (NOT POI markers)
"search here" = use bounds: ${bounds.south.toFixed(2)}°N to ${bounds.north.toFixed(2)}°N
"what's here?" = call get_poi_summary first

`;
      }
    }

    return `${mapViewContext}You are a knowledgeable and friendly Japan travel assistant. You help users discover and explore places across Japan, from bustling Tokyo neighborhoods to historic Kyoto temples.${locationContext}

COMPRESSED DATA FORMAT:
- POI data uses ultra-compact pipe-delimited format with string dictionary to save tokens
- Pipe-delimited format: {t:'p', dict:"レストラン|カフェ|渋谷区|...", f:"id|name|catIdx|lon|lat|rank|time|price|addrIdx|genreIdx|pics\nid2|name2|..."}
  * t='p' means pipe-delimited format
  * dict is a pipe-delimited string of unique strings (categories, addresses, genre names)
  * f is a string with POIs separated by newlines, fields separated by pipes (|)
  * Repeated strings are replaced with dictionary indices (numbers or empty string)
  * To get the actual string: split dict by pipes, then use index - for example, if catIdx=0, category is dict.split('|')[0]
  * Coordinates have 6 decimal precision and can be used directly
  * Field order (pipe-separated): id|name|categoryIndex|longitude|latitude|rank|time|price|addressIndex|genreIndex|photo_count
  * Indices for category (field 2), address (field 8), genre (field 9) are dictionary indices (empty if null)
  * Escaped characters: \| = pipe in data, \n = newline in data (actual newlines separate POIs)
  * Example: dict="レストラン|カフェ|渋谷区|港区", f="123|Tokyo Tower|0|139.745433|35.658581|5|9:00-22:00|¥1200|2|1|5"
    - This means: id=123, name="Tokyo Tower", category=dict[0]="レストラン", lng=139.745433, lat=35.658581, rank=5, time="9:00-22:00", price="¥1200", address=dict[2]="渋谷区", genre=dict[1]="カフェ", photos=5
  * To parse: dictArray=dict.split('|'), then split f by newlines to get POIs, then split each line by pipes to get fields
- Truncated summaries use abbreviated keys: sid=search_id, cat=category, loc=location, jis=jis_code, cnt=count, msg=message
- All JSON is minified (no whitespace) to minimize token usage

TOOL USAGE STRATEGY:

**For Japan POI searches:**
- Use search_rurubu_pois (provides rich data: photos, prices, hours, Japanese details)
- Automatically handles location → JIS code conversion

**For advanced genre filtering:**
- Tool descriptions show only the most common genre codes (temples, ramen, cafes, etc.)
- For specific or unusual genres (pottery, cycling, farm tours, spa, massage, etc.), call get_genre_codes tool first
- Workflow: User asks for specific genre → get_genre_codes(type="small" or "medium") → find exact code → use in search_rurubu_pois
- Example: "pottery workshops" → get_genre_codes(type="small") → find code 202 → search_rurubu_pois(sgenre="202", ...)

**TOOL SELECTION (follow in order):**

PRIORITY 1 - Use search_location ONLY for infrastructure/service POIs:
If user query contains ANY of these keywords (English OR Japanese), skip Rurubu entirely:
  - Hospitals/Clinics: hospital, clinic, 病院, クリニック, 医院
  - Stations: station, train station, subway, 駅, 鉄道駅, 地下鉄駅
  - Hotels: hotel, hostel, inn, ホテル, 宿, 旅館
  - Convenience: convenience store, コンビニ, セブンイレブン, ファミリーマート, ローソン
  - Retail: supermarket, スーパー, bank, ATM, 銀行, post office, 郵便局, pharmacy, 薬局
  - Public: school, university, 学校, 大学, parking, 駐車場, city hall, 市役所

⚠️ If keyword detected → search_location("[location] [category in Japanese]") ONLY
⚠️ Never try search_rurubu_pois first for these categories

Translation examples:
  - "hospitals in Yokohama" → search_location("横浜 病院")
  - "Shibuya Station" → search_location("渋谷駅")
  - "FamilyMart near Tokyo Tower" → search_location("東京タワー ファミリーマート")

PRIORITY 2 - Use search_rurubu_pois for tourism POIs (temples, restaurants, cafes, museums, etc.):
  - ALWAYS try search_rurubu_pois first
  - If returns 0 results → ONLY THEN fallback: search_location(translated query)
  - If Rurubu returns results → DO NOT call search_location (you already have tourism POIs!)

⚠️ NEVER call both search_rurubu_pois AND search_location for the same query
⚠️ search_location is ONLY for: 1) Infrastructure POIs, or 2) Fallback when Rurubu returns 0 results

Results auto-display on map with category icons (🏥 hospitals, 🏪 stores, 🚉 stations).
Never mention "Rurubu" or "SearchBox" to users.

**For visualization and POI context:**
- Both Rurubu and SearchBox results are AUTOMATICALLY displayed on the map as markers
- Each search is stored in history with a unique ID (search_1, search_2, searchbox-timestamp, etc.)
- The first search clears the map; subsequent searches are added as separate layers
- DO NOT call add_points_to_map, fit_map_to_bounds, or pan_map_to_location after searches (auto-displayed)
- After search, call get_poi_summary to see POI details before making recommendations

CORE RULES:

**RULE 1: Only recommend POIs from search results - never use general knowledge**
- Always search → get_poi_summary → recommend from results
- Never mention famous landmarks (金閣寺, 清水寺, 東京タワー) unless in search results
- If search returns 0 results, try different search or fallback to search_location

**RULE 2: Always star Rurubu POIs using ID-first matching**

MANDATORY STARRING WORKFLOW (for Rurubu tourism POIs only):
1. Search → auto-displays on map
2. get_poi_summary → receive POI list with IDs, names, coordinates
3. Select POIs to mention
4. BEFORE response: highlight_recommended_pois([
     {id: "...", name: "...", coordinates: [...]},  // Exact data from step 2
     ...
   ])
5. Write response → starred POIs auto-number (1,2,3...)

NOTE: SearchBox POIs (hospitals, stations, etc.) are NOT starred - they're infrastructure, not curated recommendations.
Only star Rurubu tourism POIs (restaurants, temples, cafes, attractions).

CRITICAL ID-FIRST MATCHING (Rurubu POIs only):
- ALWAYS include "id" field from get_poi_summary (ensures 100% match rate)
- Use exact strings from get_poi_summary - do NOT translate, shorten, or modify names
- Use full-precision coordinates from get_poi_summary - do NOT round

EXAMPLE (Rurubu POI):
get_poi_summary returns: {"id":"12345","name":"浅草寺","coordinates":[139.796938,35.714765]}
✅ CORRECT: highlight_recommended_pois([{"id":"12345","name":"浅草寺","coordinates":[139.796938,35.714765]}])
❌ WRONG: highlight_recommended_pois([{"name":"Senso-ji Temple","coordinates":[139.797,35.715]}]) ← No ID, wrong name

POI matching priority: 1) ID match (99% success), 2) Exact name match (75% success), 3) Coordinate proximity (50% success)

**STARRING VERIFICATION (pre-flight checklist):**
Before sending response, verify:
✓ Called get_poi_summary? (Required - provides IDs and coordinates)
✓ Called highlight_recommended_pois? (Required - enables starring)
✓ Included "id" field for all Rurubu POIs? (Required - ensures match)
✓ Used exact "name" from get_poi_summary? (Required - no translation/shortening)
✓ Used exact "coordinates" from get_poi_summary? (Required - full precision)
✓ POI order matches mention order? (Required - for correct numbering)

Common mistakes that break starring:
- Forgetting to call highlight_recommended_pois → POIs show but not starred
- Translating names to English → name match fails
- Shortening POI names → name match fails
- Omitting ID field → falls back to unreliable name matching
- Rounding coordinates → coordinate match may fail

**To access POI details after a search:**
- **For ranking, comparing, filtering, or listing POIs** (e.g., "rank these", "which is cheapest", "show open after 9pm", "what's here?"):
  * Use get_poi_summary tool - returns lightweight list (just id, name, category, rating, price, time, coordinates)
  * Supports filters: min_rating, search_text, open_after, sort_by, limit
  * Token-efficient: returns only essential fields for ALL stored POIs
  * Returns ALL POIs across all searches - use filters to narrow down results
- **For detailed info on specific POIs**:
  * Use get_poi_details tool - returns full details (summary, photos, etc.) for one POI at a time

**For drawing routes and directions:**
- Use get_directions tool (NOT add_route_to_map - deprecated)
- For POIs on map: use get_poi_summary coordinates (Rurubu ≠ Searchbox coords!)
- For general locations: translate to Japanese → search_location → extract coords → get_directions
- Supports profiles: driving, walking, cycling, driving-traffic

**For search history management:**
- list_search_history: View all stored searches with their IDs and details
- show_search_results: Display a hidden search back on the map by ID
- hide_search_results: Remove a search from the map (keeps in history)
- clear_all_searches: Clear all searches from history and map
- Users can ask to "show previous results", "hide the temples", "show search_2", etc.

**For itinerary planning and day trips:**
ITINERARY WORKFLOW:
  1. Search multiple categories: see, eat, cafe (search_rurubu_pois first, fallback to search_location if 0 results)
  2. get_poi_summary → get all POI details
  3. Select 3-8 POIs from results
  4. draw_itinerary_route(waypoints, profile)
  5. highlight_recommended_pois (BEFORE step 6!)
  6. add_visit_order_markers(locations, route_color)
  7. Write response with selected POIs only
- Default profile: "walking" (best for city exploration)
- Route shows arrows indicating direction, numbers show visit order
- Route color is determined by profile: walking=#9C27B0 (purple), driving=#4264FB (blue), cycling=#95E77D (green)
- Numbered markers must use same color as route

**For route management:**
- hide_all_routes: Hide all routes from the map
- show_all_routes: Show all previously hidden routes
- clear_all_routes: Permanently remove all routes from the map
- Users can ask to "hide the routes", "show the routes", "clear all routes", etc.

IMPORTANT CONSTRAINTS:
- Location names: search_rurubu_pois accepts only JIS codes for municipalities
- JIS codes: Municipality-level only (city/ward), not neighborhood-specific
- Genre system: 3 levels (Large→Medium→Small). Check tool definitions for all codes
- Automatic visualization: All Rurubu POI results are automatically shown and stored in history
- Search history: All searches persist and can be shown/hidden independently

**Handling broad location queries:**
- When user asks for large cities (Tokyo, Osaka, Kyoto, Nagoya, etc.), these span multiple wards
- The search automatically uses the most central/popular ward (first JIS code returned)
- Inform the user which specific district you're searching (e.g., "Searching in Naka Ward, Nagoya...")
- If they want a different area, they can specify: "ramen in Nagoya's Sakae district"
- For Tokyo, common wards: Shibuya-ku, Shinjuku-ku, Minato-ku, Chiyoda-ku, Taito-ku
- For Osaka: Kita-ku, Chuo-ku, Naniwa-ku
- For Kyoto: Higashiyama-ku, Nakagyo-ku, Shimogyo-ku
- For Nagoya: Naka-ku, Nakamura-ku, Atsuta-ku

**Response style:**
- Respond in ${langName} but keep ALL Rurubu data in original Japanese
  * POI names, addresses, descriptions: preserve Japanese exactly as provided
  * Never translate or romanize Rurubu text
- Be conversational and enthusiastic about Japan
- Provide brief context in ${langName} but preserve Japanese details
- Mention the number of results found
- The tool result message will confirm that results are displayed on the map

WORKFLOW: Search → Auto-visualize → Respond
Example: "Find temples in Kyoto" → search_rurubu_pois() → [automatic map display] → respond with summary`;
  }

  /**
   * Update user location and rebuild system prompt
   */
  updateUserLocation(userLocation) {
    this.userLocation = userLocation;
    this.systemPrompt = this.buildSystemPrompt(this.userLocation, this.mapView);
  }

  /**
   * Update map view and rebuild system prompt
   */
  updateMapView(mapView) {
    this.mapView = mapView;
    this.systemPrompt = this.buildSystemPrompt(this.userLocation, this.mapView);
  }

  /**
   * Send message to Claude
   */
  async sendMessage(userMessage, onProgress = null, onStreamUpdate = null) {
    // Backup conversation state
    const conversationBackup = JSON.parse(JSON.stringify(this.conversationHistory));

    try {
      // Add user message
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      // Check token usage and prune if necessary
      // DISABLED: Auto-pruning disabled - will wait for Claude API to return 400 error instead
      // const tokenUsage = this.getTokenUsage();
      //
      // if (tokenUsage.needsPruning) {
      //   if (onProgress) {
      //     onProgress(this.i18n.t('status.optimizing'));
      //   }
      //
      //   const pruneResult = await this.pruneConversation();
      //
      //   if (pruneResult.pruned) {
      //     console.log(`[Claude] Auto-pruned ${pruneResult.messagesPruned} messages, saved ${pruneResult.tokensSaved} tokens`);
      //     console.log(`[Claude] New token count: ${pruneResult.newTotal} (${Math.round((pruneResult.newTotal / this.MAX_TOKENS) * 100)}%)`);
      //
      //     // Optional: Add a subtle notification that pruning occurred
      //     // This helps users understand why older messages might not be in context
      //     if (onProgress) {
      //       onProgress(this.i18n.t('status.processing'));
      //     }
      //   }
      // }

      // Collect tools from available sources
      const tools = [
        ...this.rurubuMCP.getToolsForClaude(),
        ...this.mapController.getToolsForClaude()
      ];

      if (this.config.DEBUG) {
      }

      // Prepare request with streaming disabled
      const requestBody = {
        model: this.config.CLAUDE_MODEL,
        max_tokens: this.config.MAX_TOKENS,
        temperature: this.config.TEMPERATURE,
        system: this.systemPrompt,
        messages: this.conversationHistory,
        tools: tools,
        stream: false // Disable streaming to avoid 502 errors
      };

      if (onProgress) {
        onProgress(this.i18n.t('status.processing'));
      }

      // Call Claude API via proxy server with retry logic
      const apiEndpoint = this.config.CLAUDE_API_PROXY || 'http://localhost:3001/api/claude';
      const MAX_RETRIES = 3;
      const TIMEOUT_MS = 30000;

      let lastError;
      let result;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          // Create abort controller for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            // Retry on 5xx errors or 429 (rate limit)
            if ((response.status >= 500 || response.status === 429) && attempt < MAX_RETRIES) {
              const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }

            const errorText = await response.text();
            throw new Error(`Claude API Error: ${response.status} - ${errorText}`);
          }

          result = await response.json();

          // Success - break retry loop
          lastError = null;
          break;
        } catch (error) {
          lastError = error;

          // If it's an abort error (timeout) or network error, retry
          if ((error.name === 'AbortError' || error.message.includes('fetch')) && attempt < MAX_RETRIES) {
            const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }

          // If max retries reached, throw the error
          if (attempt === MAX_RETRIES) {
            throw error;
          }
        }
      }

      // If we still have an error after all retries, throw it
      if (lastError) {
        throw lastError;
      }

      // Check if we got streaming chunks
      if (result.chunks && Array.isArray(result.chunks)) {
        return await this.processStreamingResponse(result.chunks, onProgress, onStreamUpdate);
      }

      // Fallback to non-streaming processing
      return await this.processClaudeResponse(result, onProgress);

    } catch (error) {
      console.error('[Claude] Error:', error);

      // Check if it's a token overflow error - re-throw to show error modal
      const errorMsg = error?.message || String(error) || '';
      const isTokenError = errorMsg.includes('400') ||
                          errorMsg.includes('token') ||
                          errorMsg.includes('too large') ||
                          errorMsg.includes('context length') ||
                          errorMsg.includes('invalid_request_error');

      if (isTokenError) {
        throw error; // Re-throw to trigger error modal
      }

      // Rollback conversation on error
      this.conversationHistory = conversationBackup;

      return {
        text: `${this.i18n.t('status.error')}: ${error.message}`,
        toolsUsed: [],
        isError: true
      };
    }
  }

  /**
   * Process streaming response chunks incrementally
   */
  async processStreamingResponse(chunks, onProgress = null, onStreamUpdate = null) {
    let assistantMessage = {
      role: 'assistant',
      content: []
    };

    let accumulatedText = '';
    let toolUses = [];
    let contentIndex = 0;

    // Process each chunk
    for (const chunk of chunks) {
      if (chunk.type === 'message_start') {
        // Initial message started
        continue;
      }

      if (chunk.type === 'content_block_start') {
        // New content block starting
        const content = chunk.content_block;

        if (content.type === 'text') {
          contentIndex = chunk.index;
          if (!assistantMessage.content[contentIndex]) {
            assistantMessage.content[contentIndex] = { type: 'text', text: '' };
          }
        } else if (content.type === 'thinking') {
          contentIndex = chunk.index;
          if (!assistantMessage.content[contentIndex]) {
            assistantMessage.content[contentIndex] = { type: 'thinking', thinking: '' };
          }
        } else if (content.type === 'tool_use') {
          contentIndex = chunk.index;
          toolUses.push(content);
          // Only store essential tool_use fields, initialize input as empty string for accumulation
          assistantMessage.content[contentIndex] = {
            type: 'tool_use',
            id: content.id,
            name: content.name,
            input: '' // Start with empty string, will be built from input_json_delta chunks
          };
        }
        continue;
      }

      if (chunk.type === 'content_block_delta') {
        // Incremental text update
        const delta = chunk.delta;

        if (delta.type === 'text_delta') {
          assistantMessage.content[contentIndex].text += delta.text;
          accumulatedText += delta.text;

          // Call streaming update callback
          if (onStreamUpdate) {
            onStreamUpdate(accumulatedText);
          }
        } else if (delta.type === 'input_json_delta') {
          // Tool input being built
          if (!assistantMessage.content[contentIndex].input) {
            assistantMessage.content[contentIndex].input = '';
          }
          assistantMessage.content[contentIndex].input += delta.partial_json;
        }
        continue;
      }

      if (chunk.type === 'content_block_stop') {
        // Content block finished
        continue;
      }

      if (chunk.type === 'message_delta') {
        // Message metadata update (stop_reason, etc.)
        continue;
      }

      if (chunk.type === 'message_stop') {
        // Message complete
        break;
      }
    }

    // Add assistant message to history
    // Note: Thinking blocks from streaming don't have proper structure (missing signature field)
    // so we filter them out from conversation history
    const messageForHistory = {
      role: 'assistant',
      content: assistantMessage.content
        .filter(block => block.type !== 'thinking') // Always filter out thinking blocks
        .map(block => {
          // Parse string inputs back to objects for tool_use blocks
          if (block.type === 'tool_use' && typeof block.input === 'string') {
            try {
              return {
                ...block,
                input: JSON.parse(block.input)
              };
            } catch (e) {
              console.error('[Claude] Failed to parse tool input for history:', e);
              return block;
            }
          }
          return block;
        })
    };
    this.conversationHistory.push(messageForHistory);

    // If we have tool calls, execute them
    if (toolUses.length > 0) {
      if (onProgress) {
        onProgress(this.i18n.t('status.callingRurubu'));
      }

      // Collect all tool calls first
      const toolCalls = assistantMessage.content
        .filter(content => content.type === 'tool_use')
        .map(content => {
          // Parse tool input if it's a string (from streaming chunks)
          let toolInput = content.input;
          if (typeof toolInput === 'string') {
            try {
              toolInput = JSON.parse(toolInput);
            } catch (e) {
              // Failed to parse tool input
            }
          }
          return { content, toolInput };
        });

      // Execute all tools in parallel
      const toolExecutionPromises = toolCalls.map(({ content, toolInput }) =>
        this.executeTool(content.name, toolInput)
      );

      const toolExecutionResults = await Promise.all(toolExecutionPromises);

      // Process results
      let toolResults = [];
      let truncatedToolResults = [];

      toolCalls.forEach(({ content }, index) => {
        const toolResult = toolExecutionResults[index];

        // Compress GeoJSON in tool result if it's a POI search (for follow-up request)
        const compressedResult = this.compressToolResult(content.name, toolResult);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: content.id,
          content: compressedResult.content
        });

        // Also keep truncated version for conversation history
        const truncatedResult = this.truncateToolResult(content.name, toolResult);
        truncatedToolResults.push({
          type: 'tool_result',
          tool_use_id: content.id,
          content: truncatedResult.content
        });
      });

      // Add TRUNCATED tool results to conversation history (to reduce payload for future requests)
      this.conversationHistory.push({
        role: 'user',
        content: truncatedToolResults
      });

      if (onProgress) {
        onProgress(this.i18n.t('status.processing'));
      }

      try {
        // Make follow-up request with FULL tool results (not from conversation history)
        // This allows Claude to see all data for the immediate follow-up without bloating the conversation
        const followUpResponse = await this.sendFollowUpRequest(toolResults);
        return followUpResponse;
      } catch (error) {
        console.error('[Claude] Follow-up request failed:', error);

        // Check if it's a token overflow error - re-throw to show error modal
        const errorMsg = error?.message || String(error) || '';
        const isTokenError = errorMsg.includes('400') ||
                            errorMsg.includes('token') ||
                            errorMsg.includes('too large') ||
                            errorMsg.includes('context length') ||
                            errorMsg.includes('invalid_request_error');

        if (isTokenError) {
          throw error; // Re-throw to trigger error modal
        }

        // For other errors, return partial response
        return {
          text: accumulatedText || 'I used some tools but encountered an error.',
          toolsUsed: toolResults.map(r => r.tool_use_id)
        };
      }
    }

    // No tool calls, return text response
    return {
      text: accumulatedText,
      toolsUsed: []
    };
  }

  /**
   * Process Claude's response and handle tool calls
   */
  async processClaudeResponse(claudeResponse, onProgress = null) {
    let assistantMessage = {
      role: 'assistant',
      content: []
    };

    let hasToolUse = false;

    // Separate text and tool use blocks
    const textBlocks = [];
    const toolUseBlocks = [];

    for (const content of claudeResponse.content) {
      if (content.type === 'text') {
        textBlocks.push(content);
      } else if (content.type === 'tool_use') {
        hasToolUse = true;
        toolUseBlocks.push(content);
      }
    }

    // Add text blocks to assistant message
    assistantMessage.content.push(...textBlocks);

    // Execute all tool calls in parallel
    let toolResults = [];
    let truncatedToolResults = [];

    if (hasToolUse && toolUseBlocks.length > 0) {
      if (onProgress) {
        onProgress(this.i18n.t('status.callingRurubu'));
      }

      // Execute all tools in parallel
      const toolExecutionPromises = toolUseBlocks.map(content =>
        this.executeTool(content.name, content.input)
      );

      const toolExecutionResults = await Promise.all(toolExecutionPromises);

      // Process results
      toolUseBlocks.forEach((content, index) => {
        const toolResult = toolExecutionResults[index];

        // Add tool use to assistant message
        assistantMessage.content.push(content);

        // Compress GeoJSON in tool result if it's a POI search (for follow-up request)
        const compressedResult = this.compressToolResult(content.name, toolResult);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: content.id,
          content: compressedResult.content
        });

        // Also keep truncated version for conversation history
        const truncatedResult = this.truncateToolResult(content.name, toolResult);
        truncatedToolResults.push({
          type: 'tool_result',
          tool_use_id: content.id,
          content: truncatedResult.content
        });
      });
    }

    // Add assistant message to history
    this.conversationHistory.push(assistantMessage);

    // If we have tool calls, add results and get follow-up
    if (hasToolUse && toolResults.length > 0) {
      // Add TRUNCATED tool results to conversation history (to reduce payload for future requests)
      this.conversationHistory.push({
        role: 'user',
        content: truncatedToolResults
      });

      if (onProgress) {
        onProgress(this.i18n.t('status.processing'));
      }

      try {
        // Make follow-up request with FULL tool results (not from conversation history)
        // This allows Claude to see all data for the immediate follow-up without bloating the conversation
        const followUpResponse = await this.sendFollowUpRequest(toolResults);
        return followUpResponse;
      } catch (error) {
        console.error('[Claude] Follow-up request failed:', error);

        // Check if it's a token overflow error - re-throw to show error modal
        const errorMsg = error?.message || String(error) || '';
        const isTokenError = errorMsg.includes('400') ||
                            errorMsg.includes('token') ||
                            errorMsg.includes('too large') ||
                            errorMsg.includes('context length') ||
                            errorMsg.includes('invalid_request_error');

        if (isTokenError) {
          throw error; // Re-throw to trigger error modal
        }

        // For other errors, return partial response
        return {
          text: assistantMessage.content.find(c => c.type === 'text')?.text ||
            'I used some tools but encountered an error processing the results.',
          toolsUsed: toolResults.map(r => r.tool_use_id)
        };
      }
    }

    // No tool calls, return text response
    return {
      text: assistantMessage.content.find(c => c.type === 'text')?.text || '',
      toolsUsed: []
    };
  }

  /**
   * Send follow-up request after tool execution
   * @param {Array} overrideToolResults - Optional: Use these tool results instead of last message in history (for same-turn full data)
   */
  async sendFollowUpRequest(overrideToolResults = null) {
    const tools = [
      ...this.rurubuMCP.getToolsForClaude(),
      ...this.mapController.getToolsForClaude(),
      ...(this.app ? this.app.getSearchHistoryTools() : [])
    ];

    // Check token usage and prune if necessary before follow-up
    // DISABLED: Auto-pruning disabled - will wait for Claude API to return 400 error instead
    // const tokenUsage = this.getTokenUsage();
    //
    // if (tokenUsage.needsPruning) {
    //   await this.pruneConversation();
    // }

    // If override tool results provided, use conversation history with full results temporarily
    let messages = this.conversationHistory;
    if (overrideToolResults && overrideToolResults.length > 0) {
      // Clone conversation history and add/replace tool results
      messages = [...this.conversationHistory];
      if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
        // Replace existing user message (update with uncompressed results)
        messages[messages.length - 1] = {
          role: 'user',
          content: overrideToolResults
        };
      } else {
        // Add new user message with tool results (last message was assistant with tool_use)
        messages.push({
          role: 'user',
          content: overrideToolResults
        });
      }
    }

    // Validate message structure before sending
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        const toolUseBlocks = msg.content.filter(b => b.type === 'tool_use');
        if (toolUseBlocks.length > 0) {
          // Next message must be user with tool_result
          const nextMsg = messages[i + 1];
          if (!nextMsg || nextMsg.role !== 'user') {
            console.error('[Claude] VALIDATION ERROR: tool_use without following user message', {
              messageIndex: i,
              toolUseIds: toolUseBlocks.map(b => b.id),
              nextMessage: nextMsg
            });
            console.error('[Claude] Full messages array:', JSON.stringify(messages, null, 2));
          } else if (Array.isArray(nextMsg.content)) {
            const toolResultIds = nextMsg.content
              .filter(b => b.type === 'tool_result')
              .map(b => b.tool_use_id);
            const toolUseIds = toolUseBlocks.map(b => b.id);
            const missingIds = toolUseIds.filter(id => !toolResultIds.includes(id));
            if (missingIds.length > 0) {
              console.error('[Claude] VALIDATION ERROR: tool_use without matching tool_result', {
                messageIndex: i,
                missingToolUseIds: missingIds,
                toolUseIds,
                toolResultIds
              });
              console.error('[Claude] Full messages array:', JSON.stringify(messages, null, 2));
            }
          }
        }
      }
    }

    const requestBody = {
      model: this.config.CLAUDE_MODEL,
      max_tokens: this.config.MAX_TOKENS,
      temperature: 1,
      system: this.systemPrompt,
      messages: messages,
      tools: tools,
      stream: false // Disable streaming for follow-up requests
      // Note: Thinking disabled for follow-up to avoid signature field requirement issues
    };

    const apiEndpoint = this.config.CLAUDE_API_PROXY || 'http://localhost:3001/api/claude';
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Follow-up request failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    // Recursively process response (may include more tool calls)
    return await this.processClaudeResponse(result);
  }

  /**
   * Compress tool result by applying GeoJSON compression if applicable
   * Used for follow-up requests to reduce token usage while keeping POI data available
   */
  compressToolResult(toolName, result) {
    // For Rurubu POI searches, compress the GeoJSON but keep it (unlike truncate which removes it)
    if (toolName === 'search_rurubu_pois' && result.content && result.content[0]) {
      try {
        const data = JSON.parse(result.content[0].text);
        if (data.geojson && data.geojson.features) {
          // Compress GeoJSON while keeping structure
          const compressed = {
            ...data,
            geojson: this.compressGeoJSON(data.geojson)
          };
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(compressed) // No formatting - save tokens
            }]
          };
        }
      } catch (e) {
        // If parsing fails, return original
        return result;
      }
    }
    return result;
  }

  /**
   * Compress GeoJSON data by removing verbose properties and reducing precision
   * Reduces token usage by ~60-70% while keeping user-relevant POI information
   *
   * Ultra-compressed format optimizations:
   * - Pipe-delimited string format (saves ~20-30% vs JSON arrays)
   * - String dictionary/interning (saves ~30-40% on repeated strings)
   * - Single-letter property keys (saves ~40% on property names)
   * - 6-decimal coordinate precision (saves ~10% while maintaining accuracy)
   * - Remove GeoJSON structure overhead (saves ~20%)
   * - No JSON formatting whitespace (saves ~15%)
   */
  compressGeoJSON(geojson) {
    if (!geojson || !geojson.features) return geojson;

    // STEP 1: Build string dictionary for repeated values
    // Collect unique strings for category, address, and sgenreName
    const stringSet = new Set();

    geojson.features.forEach(feature => {
      const p = feature.properties || {};
      if (p.category) stringSet.add(p.category);
      if (p.address) stringSet.add(p.address);
      if (p.sgenreName) stringSet.add(p.sgenreName);
    });

    // Convert set to array (dictionary)
    const dictionary = Array.from(stringSet);

    // Create reverse lookup map for O(1) index access
    const dictMap = new Map();
    dictionary.forEach((str, idx) => dictMap.set(str, idx));

    // Helper function to escape pipes and newlines in field values
    const escapeField = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      return str.replace(/\|/g, '\\|').replace(/\n/g, '\\n');
    };

    // Create pipe-delimited dictionary string (escape pipes in dict strings)
    const dictionaryString = dictionary.map(str => escapeField(str)).join('|');

    // STEP 2: Compress features using pipe-delimited format
    // Format: id|name|catIdx|lon|lat|rank|time|price|addrIdx|genreIdx|picCount
    const compressedLines = geojson.features.map(feature => {
      const p = feature.properties || {};
      const c = feature.geometry.coordinates;

      // Create pipe-delimited string for this POI
      // Indices: 0=id, 1=name, 2=catIdx, 3=lon, 4=lat, 5=rank, 6=time, 7=price, 8=addrIdx, 9=genreIdx, 10=pics
      const fields = [
        p.id,
        escapeField(p.name),
        p.category ? dictMap.get(p.category) : '', // Dictionary index (empty if null)
        Math.round(c[0] * 1000000) / 1000000, // 6 decimal precision (~11cm accuracy)
        Math.round(c[1] * 1000000) / 1000000, // 6 decimal precision
        p.rank || 0,
        escapeField(p.time || ''),
        escapeField(p.price || ''),
        p.address ? dictMap.get(p.address) : '', // Dictionary index
        p.sgenreName ? dictMap.get(p.sgenreName) : '', // Dictionary index
        (p.photos && p.photos.length) || 0
      ];

      return fields.join('|');
    });

    // Join all POIs with newlines
    const compressedString = compressedLines.join('\n');

    // Return pipe-delimited format with pipe-delimited dictionary
    return {
      t: 'p', // type: pipe-delimited
      dict: dictionaryString, // Pipe-delimited dictionary string
      f: compressedString // features as pipe-delimited string
    };
  }

  /**
   * Truncate large tool results to reduce payload size
   * Keeps essential info while removing verbose data
   */
  truncateToolResult(toolName, result) {
    // For Rurubu POI searches, truncate the GeoJSON to just a summary
    if (toolName === 'search_rurubu_pois' && result.content && result.content[0]) {
      try {
        const data = JSON.parse(result.content[0].text);
        if (data.geojson && data.geojson.features) {
          // Keep minimal summary - POI details available via get_visible_pois tool
          const truncated = {
            sid: data.search_id || 'unknown', // Abbreviate keys
            cat: data.category,
            loc: data.location,
            jis: data.jis_code,
            cnt: data.count,
            msg: `${data.count} ${data.category} POIs in ${data.location}. Use get_poi_summary for details.`
          };
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(truncated) // No formatting - save tokens
            }]
          };
        }
      } catch (e) {
        // If parsing fails, return original
        return result;
      }
    }
    return result;
  }

  /**
   * Execute a tool from any of the three MCP sources
   */
  async executeTool(toolName, args) {
    try {
      // Check Rurubu MCP tools
      const rurubuTool = this.rurubuMCP.getToolDefinition(toolName);
      if (rurubuTool) {
        const result = await this.rurubuMCP.executeTool(toolName, args);

        // If this is a search_rurubu_pois call, extract and store the full GeoJSON data
        if (toolName === 'search_rurubu_pois' && this.onRurubuData && result.content) {
          try {
            const resultText = result.content[0].text;
            const resultData = JSON.parse(resultText);
            if (resultData.geojson && resultData.geojson.features) {
              // Store full POI data with metadata for search history
              const metadata = {
                category: resultData.category,
                location: resultData.location,
                jis_code: resultData.jis_code,
                pages: resultData.pages
              };
              this.onRurubuData(resultData.geojson, metadata);
            }
          } catch (e) {
            // Failed to extract Rurubu GeoJSON
          }
        }

        return result;
      }

      // Check Map Tools
      const mapTools = this.mapController.getToolsForClaude();
      const mapTool = mapTools.find(t => t.name === toolName);
      if (mapTool) {
        return await this.mapController.executeTool(toolName, args);
      }

      // Check Search History Tools
      if (this.app) {
        const searchHistoryTools = this.app.getSearchHistoryTools();
        const searchHistoryTool = searchHistoryTools.find(t => t.name === toolName);
        if (searchHistoryTool) {
          return await this.app.executeSearchHistoryTool(toolName, args);
        }
      }

      throw new Error(`Unknown tool: ${toolName}`);

    } catch (error) {
      console.error(`[Claude] Tool execution error for ${toolName}:`, error);
      return {
        content: [{
          type: 'text',
          text: `Error executing ${toolName}: ${error.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Get conversation history
   */
  getHistory() {
    return this.conversationHistory;
  }

  /**
   * Get conversation summary
   */
  getConversationSummary() {
    return {
      messageCount: this.conversationHistory.length,
      hasHistory: this.conversationHistory.length > 0
    };
  }

  /**
   * Estimate token count for text (extremely conservative approximation)
   * Uses 1.5 chars per token to account for:
   * - JSON structure overhead (brackets, quotes, commas)
   * - Tool definitions and complex nested data
   * - Japanese/multi-byte characters
   * - Encoding overhead
   *
   * Note: Previous formula (chars/3) underestimated by 21.5x, causing 208k token overflow.
   * This conservative formula prevents exceeding the 200k limit.
   */
  estimateTokens(text) {
    if (!text) return 0;

    // Extremely conservative: 1.5 chars per token (was 3, which severely underestimated)
    // Testing showed chars/3 resulted in 21.5x underestimation (9.7k estimate vs 208k actual)
    let tokens = Math.ceil(text.length / 1.5);

    // Add significant overhead for JSON structures (check for brackets/braces)
    if (text.includes('{') || text.includes('[')) {
      // JSON has significant token overhead from structure, especially with tool definitions
      tokens = Math.ceil(tokens * 1.5); // 50% overhead for JSON
    }

    return tokens;
  }

  /**
   * Calculate and cache token count for a message
   * Uses cached value if available, otherwise calculates and caches
   * Uses WeakMap to avoid polluting message objects sent to API
   * @param {Object} msg - Message object
   * @returns {number} Token count
   */
  getMessageTokens(msg) {
    // Return cached value if available
    const cached = this.messageTokenCache.get(msg);
    if (cached !== undefined) {
      return cached;
    }

    // Calculate token count
    let tokens = 0;
    if (typeof msg.content === 'string') {
      tokens = this.estimateTokens(msg.content);
    } else if (Array.isArray(msg.content)) {
      msg.content.forEach(block => {
        if (block.type === 'text') {
          tokens += this.estimateTokens(block.text);
        } else if (block.type === 'tool_use') {
          tokens += this.estimateTokens(JSON.stringify(block.input));
        } else if (block.type === 'tool_result') {
          tokens += this.estimateTokens(JSON.stringify(block.content));
        }
      });
    }

    // Cache the result in WeakMap
    this.messageTokenCache.set(msg, tokens);
    return tokens;
  }

  /**
   * Calculate total tokens in conversation
   * Uses cached token counts for efficiency
   */
  calculateTotalTokens() {
    // Cache system prompt tokens
    if (this._cachedSystemPromptTokens === undefined || this._lastSystemPrompt !== this.systemPrompt) {
      this._cachedSystemPromptTokens = this.estimateTokens(this.systemPrompt);
      this._lastSystemPrompt = this.systemPrompt;
    }
    let total = this._cachedSystemPromptTokens;

    // Add conversation history using cached tokens
    this.conversationHistory.forEach(msg => {
      total += this.getMessageTokens(msg);
    });

    return total;
  }

  /**
   * Prune old conversation messages to stay under token limit
   * @returns {Object} Pruning info: { pruned, messagesPruned, tokensSaved, newTotal }
   */
  async pruneConversation() {
    const currentTokens = this.calculateTotalTokens();

    if (currentTokens < this.PRUNE_THRESHOLD) {
      return { pruned: false, reason: 'Below threshold' };
    }

    errorLogger.info('Token Management', 'Auto-pruning triggered', {
      currentTokens,
      threshold: this.PRUNE_THRESHOLD,
      percentage: Math.round((currentTokens / this.MAX_TOKENS) * 100)
    });

    // Keep first 2 messages (initial context) and last N messages
    // Less aggressive pruning per instance, but prune earlier to prevent overflow
    const messagesToKeep = 8; // Keep more messages per prune
    const initialMessages = 2;

    if (this.conversationHistory.length <= initialMessages + messagesToKeep) {
      errorLogger.warn('Token Management', 'Cannot prune: too few messages', {
        messageCount: this.conversationHistory.length,
        requiredMin: initialMessages + messagesToKeep
      });
      return { pruned: false, reason: 'Too few messages to prune' };
    }

    const beforeCount = this.conversationHistory.length;

    // Find safe cut point that doesn't break tool_use/tool_result pairs
    // We need to keep complete message pairs: assistant (with tool_use) + user (with tool_result)
    let cutIndex = this.conversationHistory.length - messagesToKeep;

    // Keep searching backward for a safe cut point
    // A safe cut point is where recentMessages starts with:
    // - A user message WITHOUT tool_result, OR
    // - An assistant message WITHOUT tool_use
    while (cutIndex > initialMessages && cutIndex < this.conversationHistory.length) {
      const messageAtCut = this.conversationHistory[cutIndex];

      // Check if this is a safe cut point
      let isSafe = false;

      if (messageAtCut.role === 'user') {
        // Safe if user message has NO tool_result
        if (Array.isArray(messageAtCut.content)) {
          const hasToolResult = messageAtCut.content.some(block => block.type === 'tool_result');
          isSafe = !hasToolResult;
        } else {
          // String content (no tool_result)
          isSafe = true;
        }
      } else if (messageAtCut.role === 'assistant') {
        // Assistant messages are ALWAYS safe to start with
        // If it has tool_use, the next message (user with tool_result) will also be in recentMessages
        isSafe = true;
      }

      if (isSafe) {
        break; // Found safe cut point
      }

      // Not safe, move back by one message pair (user + assistant)
      cutIndex -= 2;
    }

    // Ensure we don't go below initialMessages
    if (cutIndex <= initialMessages) {
      // Couldn't find a safe cut point - skip pruning this time
      errorLogger.warn('Token Management', 'No safe cut point found, skipping pruning', {
        conversationLength: this.conversationHistory.length,
        initialMessages: initialMessages
      });
      return { pruned: false, reason: 'No safe cut point found' };
    }

    const prunedMessages = this.conversationHistory.slice(initialMessages, cutIndex);
    const recentMessages = this.conversationHistory.slice(cutIndex);

    // Create intelligent summary of pruned content
    const summary = this.createConversationSummary(prunedMessages);
    this.conversationSummary = summary;

    // Keep initial messages, add summary, keep recent messages
    this.conversationHistory = [
      ...this.conversationHistory.slice(0, initialMessages),
      {
        role: 'user',
        content: `[Previous conversation summary: ${summary}]`
      },
      ...recentMessages
    ];

    const afterCount = this.conversationHistory.length;
    const newTokens = this.calculateTotalTokens();
    const tokensSaved = currentTokens - newTokens;

    errorLogger.info('Token Management', 'Pruning completed', {
      messagesPruned: prunedMessages.length,
      beforeCount,
      afterCount,
      tokensSaved,
      newTotal: newTokens,
      newPercentage: Math.round((newTokens / this.MAX_TOKENS) * 100)
    });

    return {
      pruned: true,
      messagesPruned: prunedMessages.length,
      tokensSaved,
      newTotal: newTokens,
      summary
    };
  }

  /**
   * Create an intelligent summary of conversation messages
   * Preserves important context like locations searched, POIs found, and actions taken
   */
  createConversationSummary(messages) {
    const userQueries = [];
    const locations = new Set();
    const actions = new Set();
    const searches = []; // Track search results
    const toolsUsed = new Set();

    messages.forEach(msg => {
      // Process user messages
      if (msg.role === 'user' && typeof msg.content === 'string') {
        // Skip summary messages
        if (msg.content.startsWith('[Previous conversation summary:')) {
          return;
        }

        userQueries.push(msg.content);

        // Extract Japanese location names (カタカナ and 漢字)
        const japaneseLocations = msg.content.match(/[一-龠ぁ-ゔァ-ヴー々〆〤]{2,}/g);
        if (japaneseLocations) {
          japaneseLocations.forEach(loc => locations.add(loc));
        }

        // Extract English location names
        const englishLocations = msg.content.match(/(?:in|near|at|from|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g);
        if (englishLocations) {
          englishLocations.forEach(match => {
            const location = match.replace(/(?:in|near|at|from|to)\s+/, '');
            locations.add(location);
          });
        }

        // Extract actions
        if (msg.content.match(/探して|検索|見つけ|find|show|search|get/i)) actions.add('search');
        if (msg.content.match(/ルート|道順|route|direction|navigate|go/i)) actions.add('routing');
        if (msg.content.match(/隠す|消す|hide|clear|remove/i)) actions.add('manage');
        if (msg.content.match(/おすすめ|人気|recommend|popular/i)) actions.add('recommendations');
      }

      // Process assistant messages with tool use
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        msg.content.forEach(block => {
          if (block.type === 'tool_use') {
            toolsUsed.add(block.name);

            // Track searches
            if (block.name === 'search_pois_by_jis_code' || block.name === 'search_pois_by_location') {
              const location = block.input?.location || 'unknown';
              const category = block.input?.category || 'unknown';
              searches.push(`${category} in ${location}`);
            }
          }

          // Extract POI counts from text responses
          if (block.type === 'text') {
            const countMatch = block.text.match(/(\d+)件|found (\d+)|showing (\d+)/i);
            if (countMatch) {
              const count = countMatch[1] || countMatch[2] || countMatch[3];
              if (searches.length > 0) {
                searches[searches.length - 1] += ` (${count} POIs)`;
              }
            }
          }
        });
      }
    });

    // Build comprehensive summary
    const parts = [];

    if (userQueries.length > 0) {
      parts.push(`${userQueries.length} questions asked`);
    }

    if (locations.size > 0) {
      const locationList = Array.from(locations).slice(0, 5).join(', ');
      parts.push(`Locations: ${locationList}`);
    }

    if (searches.length > 0) {
      const searchSummary = searches.slice(0, 3).join('; ');
      parts.push(`Searches: ${searchSummary}`);
    }

    if (actions.size > 0) {
      parts.push(`Actions: ${Array.from(actions).join(', ')}`);
    }

    if (toolsUsed.size > 0) {
      parts.push(`Tools used: ${Array.from(toolsUsed).slice(0, 5).join(', ')}`);
    }

    const summary = parts.join(' | ');
    return summary || 'Previous conversation about Japan travel';
  }

  /**
   * Get token usage info using cached calculations
   */
  getTokenUsage() {
    // Use cached system prompt tokens
    if (this._cachedSystemPromptTokens === undefined || this._lastSystemPrompt !== this.systemPrompt) {
      this._cachedSystemPromptTokens = this.estimateTokens(this.systemPrompt);
      this._lastSystemPrompt = this.systemPrompt;
    }
    const systemPromptTokens = this._cachedSystemPromptTokens;

    // Use cached message tokens
    let conversationTokens = 0;
    this.conversationHistory.forEach(msg => {
      conversationTokens += this.getMessageTokens(msg);
    });

    // Estimate tools array size (not included in request but adds overhead)
    // Tools are sent with every request and can be 20-40k tokens
    const tools = [
      ...this.rurubuMCP.getToolsForClaude(),
      ...this.mapController.getToolsForClaude(),
      ...(this.app ? this.app.getSearchHistoryTools() : [])
    ];
    const toolsTokens = this.estimateTokens(JSON.stringify(tools));

    const total = systemPromptTokens + conversationTokens + toolsTokens;
    const percentage = (total / this.MAX_TOKENS) * 100;
    const remaining = this.MAX_TOKENS - total;

    return {
      total,
      systemPrompt: systemPromptTokens,
      conversationHistory: conversationTokens,
      tools: toolsTokens,
      max: this.MAX_TOKENS,
      percentage: Math.round(percentage),
      remaining,
      needsPruning: total >= this.PRUNE_THRESHOLD,
      showWarning: total >= this.WARNING_THRESHOLD
    };
  }
}
