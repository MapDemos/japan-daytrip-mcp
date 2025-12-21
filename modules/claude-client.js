/**
 * Claude Client
 * Handles communication with Claude API and coordinates dual MCP architecture
 * - Rurubu MCP (client-side virtual server)
 * - Map Tools MCP (visualization library)
 */

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
    this.systemPrompt = this.buildSystemPrompt();

    // Token management
    this.MAX_TOKENS = 200000;
    this.PRUNE_THRESHOLD = 140000; // Start pruning at 70% capacity (60k buffer for tool responses)
    this.WARNING_THRESHOLD = 100000; // Show warning at 50% capacity
    this.conversationSummary = null; // Store summary of pruned messages
  }

  /**
   * Build the system prompt for Claude
   */
  buildSystemPrompt(userLocation = null) {
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

    return `You are a knowledgeable and friendly Japan travel assistant. You help users discover and explore places across Japan, from bustling Tokyo neighborhoods to historic Kyoto temples.${locationContext}

TOOL USAGE STRATEGY:

**For Japan POI searches:**
- Use search_rurubu_pois (provides rich data: photos, prices, hours, Japanese details)
- Automatically handles location → JIS code conversion

**For visualization:**
- Rurubu POI search results are AUTOMATICALLY displayed on the map
- Each search is stored in history with a unique ID (search_1, search_2, etc.)
- The first search clears the map; subsequent searches are added as separate layers
- DO NOT call add_points_to_map, fit_map_to_bounds, or pan_map_to_location after Rurubu searches
- You only need to provide a friendly response describing the results

**For drawing routes and directions:**
- ALWAYS use the get_directions tool when users want routes, directions, or to navigate between locations
- DO NOT use add_route_to_map - it is deprecated and will cause errors
- WORKFLOW: First use search_location to get coordinates, then pass coordinates to get_directions
  1. TRANSLATE English location names to Japanese before calling search_location:
     - "Tokyo Tower" → "東京タワー"
     - "Shibuya Station" → "渋谷駅"
     - "Senso-ji Temple" → "浅草寺"
     - "Kyoto Station" → "京都駅"
  2. Call search_location with Japanese query for each destination/waypoint
  3. Extract coordinates from search_location results (use first result)
  4. Pass array of coordinates to get_directions
- get_directions automatically displays the route on the map with proper road routing
- Supports multiple routing profiles: driving (default), walking, cycling, driving-traffic
- Returns distance, duration, and turn-by-turn instructions

**For search history management:**
- list_search_history: View all stored searches with their IDs and details
- show_search_results: Display a hidden search back on the map by ID
- hide_search_results: Remove a search from the map (keeps in history)
- clear_all_searches: Clear all searches from history and map
- Users can ask to "show previous results", "hide the temples", "show search_2", etc.

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
- Respond in English BUT keep ALL Rurubu data in its original Japanese:
  * POI names: Keep in Japanese (e.g., "ひるがお 本店" NOT "Hirugao Honten")
  * Addresses: Keep in Japanese (e.g., "東京都世田谷区野沢2-1-2")
  * Descriptions/summaries: Keep in Japanese exactly as provided by Rurubu
  * NEVER translate or romanize Japanese text from Rurubu
- Be conversational and enthusiastic about Japan
- Provide brief context in English but preserve Japanese details
- Mention the number of results found
- The tool result message will confirm that results are displayed on the map

WORKFLOW: Search → Auto-visualize → Respond
Example: "Find temples in Kyoto" → search_rurubu_pois() → [automatic map display] → respond with summary`;
  }

  /**
   * Update user location and rebuild system prompt
   */
  updateUserLocation(userLocation) {
    this.systemPrompt = this.buildSystemPrompt(userLocation);
    console.log('[Claude] User location updated in context');
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
      const tokenUsage = this.getTokenUsage();

      if (tokenUsage.needsPruning) {
        console.log('[Claude] Token limit approaching, pruning conversation...');
        await this.pruneConversation();
        const newUsage = this.getTokenUsage();
      }

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

      // Call Claude API via proxy server to avoid CORS issues
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
        throw new Error(`Claude API Error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      // Check if we got streaming chunks
      if (result.chunks && Array.isArray(result.chunks)) {
        return await this.processStreamingResponse(result.chunks, onProgress, onStreamUpdate);
      }

      // Fallback to non-streaming processing
      return await this.processClaudeResponse(result, onProgress);

    } catch (error) {
      console.error('[Claude] Error:', error);

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
    console.log(`[Claude] Processing ${chunks.length} streaming chunks`);

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
      let toolResults = [];
      let truncatedToolResults = [];

      for (let i = 0; i < assistantMessage.content.length; i++) {
        const content = assistantMessage.content[i];
        if (content.type !== 'tool_use') continue;

        if (onProgress) {
          const toolName = content.name;
          if (toolName.startsWith('search_rurubu')) {
            onProgress(this.i18n.t('status.callingRurubu'));
          } else if (toolName.includes('map') || toolName.includes('route')) {
            onProgress(this.i18n.t('status.visualizing'));
          } else {
            onProgress(this.i18n.t('status.callingMapbox'));
          }
        }

        // Get the accumulated tool input from the content block
        let toolInput = content.input;

        // Parse tool input if it's a string (from streaming chunks)
        if (typeof toolInput === 'string') {
          try {
            toolInput = JSON.parse(toolInput);
            console.log(`[Claude] Parsed tool input for ${content.name}:`, toolInput);
          } catch (e) {
            console.error(`[Claude] Failed to parse tool input for ${content.name}:`, e);
            console.error(`[Claude] Raw input was:`, toolInput);
          }
        }

        // Execute the tool
        const toolResult = await this.executeTool(content.name, toolInput);

        // Keep full result for immediate follow-up
        toolResults.push({
          type: 'tool_result',
          tool_use_id: content.id,
          content: toolResult.content
        });

        // Also keep truncated version for conversation history
        const truncatedResult = this.truncateToolResult(content.name, toolResult);
        truncatedToolResults.push({
          type: 'tool_result',
          tool_use_id: content.id,
          content: truncatedResult.content
        });
      }

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
    let toolResults = [];
    let truncatedToolResults = [];

    // Process each content block
    for (const content of claudeResponse.content) {
      if (content.type === 'text') {
        assistantMessage.content.push(content);

      } else if (content.type === 'tool_use') {
        hasToolUse = true;

        if (onProgress) {
          const toolName = content.name;
          if (toolName.startsWith('search_rurubu')) {
            onProgress(this.i18n.t('status.callingRurubu'));
          } else if (toolName.includes('map') || toolName.includes('route')) {
            onProgress(this.i18n.t('status.visualizing'));
          } else {
            onProgress(this.i18n.t('status.callingMapbox'));
          }
        }

        // Execute the tool
        const toolResult = await this.executeTool(content.name, content.input);

        // Add tool use to assistant message
        assistantMessage.content.push(content);

        // Keep full result for immediate follow-up
        toolResults.push({
          type: 'tool_result',
          tool_use_id: content.id,
          content: toolResult.content
        });

        // Also keep truncated version for conversation history
        const truncatedResult = this.truncateToolResult(content.name, toolResult);
        truncatedToolResults.push({
          type: 'tool_result',
          tool_use_id: content.id,
          content: truncatedResult.content
        });
      }
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

        // Return partial response
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

    // If override tool results provided, use conversation history with full results temporarily
    let messages = this.conversationHistory;
    if (overrideToolResults && overrideToolResults.length > 0) {
      console.log('[Claude] Applying full tool results override:', overrideToolResults.length, 'results');
      // Clone conversation history and replace last message with full tool results
      messages = [...this.conversationHistory];
      if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
        console.log('[Claude] Replacing last user message with full results');
        messages[messages.length - 1] = {
          role: 'user',
          content: overrideToolResults
        };
      } else {
        console.warn('[Claude] Last message is not user role, cannot replace');
      }
    } else {
      console.log('[Claude] No override tool results provided');
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
   * Truncate large tool results to reduce payload size
   * Keeps essential info while removing verbose data
   */
  truncateToolResult(toolName, result) {
    // For Rurubu POI searches, truncate the GeoJSON to just a summary
    if (toolName === 'search_rurubu_pois' && result.content && result.content[0]) {
      try {
        const data = JSON.parse(result.content[0].text);
        if (data.geojson && data.geojson.features) {
          // Keep summary info but truncate detailed POI data
          const truncated = {
            category: data.category,
            location: data.location,
            jis_code: data.jis_code,
            count: data.count,
            // Only include first 3 POI names as examples
            sample_pois: data.geojson.features.slice(0, 3).map(f => f.properties.name),
            message: `Found ${data.count} results. All POIs have been automatically displayed on the map with markers - no need to call add_points_to_map or other visualization tools. The map is automatically centered and zoomed to show all results. Just provide a friendly response to the user describing what was found.`
          };
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(truncated, null, 2)
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
    console.log(`[Claude] Executing tool: ${toolName}`, args);

    try {
      // Check Rurubu MCP tools
      const rurubuTool = this.rurubuMCP.getToolDefinition(toolName);
      if (rurubuTool) {
        console.log('[Claude] → Rurubu MCP');
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
            console.warn('[Claude] Failed to extract Rurubu GeoJSON:', e);
          }
        }

        return result;
      }

      // Check Map Tools
      const mapTools = this.mapController.getToolsForClaude();
      const mapTool = mapTools.find(t => t.name === toolName);
      if (mapTool) {
        console.log('[Claude] → Map Tools');
        return await this.mapController.executeTool(toolName, args);
      }

      // Check Search History Tools
      if (this.app) {
        const searchHistoryTools = this.app.getSearchHistoryTools();
        const searchHistoryTool = searchHistoryTools.find(t => t.name === toolName);
        if (searchHistoryTool) {
          console.log('[Claude] → Search History');
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
    console.log('[Claude] Conversation history cleared');
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
   * Estimate token count for text (conservative approximation: ~3 chars per token)
   * More conservative to account for structured content (JSON, tool calls, etc.)
   */
  estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 3);
  }

  /**
   * Calculate total tokens in conversation
   */
  calculateTotalTokens() {
    let total = this.estimateTokens(this.systemPrompt);

    // Add conversation history
    this.conversationHistory.forEach(msg => {
      if (typeof msg.content === 'string') {
        total += this.estimateTokens(msg.content);
      } else if (Array.isArray(msg.content)) {
        msg.content.forEach(block => {
          if (block.type === 'text') {
            total += this.estimateTokens(block.text);
          } else if (block.type === 'tool_use') {
            total += this.estimateTokens(JSON.stringify(block.input));
          } else if (block.type === 'tool_result') {
            total += this.estimateTokens(JSON.stringify(block.content));
          }
        });
      }
    });

    return total;
  }

  /**
   * Prune old conversation messages to stay under token limit
   */
  async pruneConversation() {
    const currentTokens = this.calculateTotalTokens();

    if (currentTokens < this.PRUNE_THRESHOLD) {
      return false; // No pruning needed
    }

    console.log(`[Claude] Pruning conversation: ${currentTokens} tokens (threshold: ${this.PRUNE_THRESHOLD})`);

    // Keep first 2 messages (initial context) and last 10 messages
    const messagesToKeep = 10;
    const initialMessages = 2;

    if (this.conversationHistory.length > initialMessages + messagesToKeep) {
      const prunedMessages = this.conversationHistory.slice(initialMessages, -messagesToKeep);

      // Create summary of pruned content
      const summary = this.createConversationSummary(prunedMessages);
      this.conversationSummary = summary;

      // Keep initial messages, add summary, keep recent messages
      const recentMessages = this.conversationHistory.slice(-messagesToKeep);
      this.conversationHistory = [
        ...this.conversationHistory.slice(0, initialMessages),
        {
          role: 'user',
          content: `[Previous conversation summary: ${summary}]`
        },
        ...recentMessages
      ];

      const newTokens = this.calculateTotalTokens();
      console.log(`[Claude] Conversation pruned: ${currentTokens} → ${newTokens} tokens`);
      console.log(`[Claude] Kept ${initialMessages} initial + ${messagesToKeep} recent messages`);

      return true;
    }

    return false;
  }

  /**
   * Create a summary of conversation messages
   */
  createConversationSummary(messages) {
    const userQueries = [];
    const locations = new Set();
    const actions = new Set();

    messages.forEach(msg => {
      if (msg.role === 'user' && typeof msg.content === 'string') {
        userQueries.push(msg.content);

        // Extract location mentions (rough heuristic)
        const locationMatches = msg.content.match(/(?:in|near|at|from|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g);
        if (locationMatches) {
          locationMatches.forEach(match => {
            const location = match.replace(/(?:in|near|at|from|to)\s+/, '');
            locations.add(location);
          });
        }

        // Extract actions
        if (msg.content.match(/find|show|search|get/i)) actions.add('search');
        if (msg.content.match(/route|direction|navigate|go/i)) actions.add('routing');
        if (msg.content.match(/hide|clear|remove/i)) actions.add('manage');
      }
    });

    const summary = [
      `User asked ${userQueries.length} questions`,
      locations.size > 0 ? `about ${Array.from(locations).slice(0, 3).join(', ')}` : '',
      actions.size > 0 ? `including ${Array.from(actions).join(', ')}` : ''
    ].filter(Boolean).join(' ');

    return summary || 'Previous conversation about Japan travel';
  }

  /**
   * Get token usage info
   */
  getTokenUsage() {
    const total = this.calculateTotalTokens();
    const percentage = (total / this.MAX_TOKENS) * 100;
    const remaining = this.MAX_TOKENS - total;

    return {
      total,
      max: this.MAX_TOKENS,
      percentage: Math.round(percentage),
      remaining,
      needsPruning: total >= this.PRUNE_THRESHOLD,
      showWarning: total >= this.WARNING_THRESHOLD
    };
  }
}
