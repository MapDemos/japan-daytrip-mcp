/**
 * Japan Day Trip MCP Assistant
 * Main Application Entry Point
 *
 * Dual MCP Architecture:
 * - Rurubu MCP (client-side virtual server)
 * - Map Tools (visualization library)
 */

import { CONFIG, validateConfig } from './config.js';
import { RurubuMCPClient } from './modules/rurubu-mcp-client.js';
import { ClaudeClient } from './modules/claude-client.js';
import { GeminiClient } from './modules/gemini-client.js';
import { MapController } from './modules/map-controller.js';
import { I18n } from './modules/i18n.js';
import { ThinkingSimulator } from './modules/thinking-simulator.js';
import { reverseGeocode } from './modules/mapbox-service-utils.js';

class JapanDayTripApp {
  constructor() {
    this.config = CONFIG;
    this.i18n = new I18n(CONFIG.DEFAULT_LANGUAGE);
    this.rurubuMCP = null;
    this.mapController = null;
    this.claudeClient = null;
    this.thinkingSimulator = new ThinkingSimulator(this.i18n);
    this.isProcessing = false;

    // Store full POI data with all Rurubu properties
    // Maps coordinates (as string "lng,lat") to full feature properties
    this.poiDataStore = new Map();

    // Search history management
    this.searchHistory = new Map(); // Map<searchId, SearchResult>
    this.searchIdCounter = 0; // Counter for generating unique search IDs
    this.visibleSearchIds = new Set(); // Set of currently visible search IDs

    // User location for context-aware queries
    this.userLocation = null;
  }

  /**
   * Initialize the application
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Japan Day Trip MCP Assistant...');

      // Validate configuration
      if (!validateConfig()) {
        this.showConfigError();
        return;
      }

      // Show welcome message
      this.addSystemMessage(this.i18n.t('system.welcome'));

      // Initialize Rurubu MCP (client-side)
      console.log('1/4 Initializing Rurubu MCP...');
      this.rurubuMCP = new RurubuMCPClient(this.config);
      await this.rurubuMCP.initialize();
      console.log('✓ Rurubu MCP ready');

      // Initialize Map Controller
      console.log('2/4 Initializing Map...');
      this.mapController = new MapController(this.config, this); // Pass app reference
      await this.mapController.initialize('map');
      console.log('✓ Map initialized');

      // Set initial map language
      this.mapController.setMapLanguage(this.i18n.getCurrentLanguage());

      // Setup POI marker click handler
      this.mapController.onMarkerClick(async (properties) => {
        await this.showPoiModal(properties);
      });

      // Initialize AI Client (Claude or Gemini)
      console.log(`3/4 Initializing ${this.config.AI_PROVIDER.toUpperCase()}...`);
      if (this.config.AI_PROVIDER === 'gemini') {
        this.claudeClient = new GeminiClient(
          this.config.GEMINI_API_KEY,
          this.rurubuMCP,
          this.mapController,
          this.i18n,
          this.config
        );
        console.log('✓ Gemini client ready');
      } else {
        this.claudeClient = new ClaudeClient(
          this.config.CLAUDE_API_KEY,
          this.rurubuMCP,
          this.mapController,
          this.i18n,
          this.config,
          this, // App reference for search history management
          (geojson, metadata) => this.storeRurubuData(geojson, metadata) // Callback to store full POI data
        );
        console.log('✓ Claude client ready');
      }

      // Setup event listeners
      console.log('4/4 Setting up event listeners...');
      this.setupEventListeners();
      console.log('✓ Event listeners attached');

      // Update UI with translations
      this.updateUI();

      // Initialize token counter display
      this.updateTokenCounter();

      console.log('✅ Application initialized successfully!');
      console.log('---');
      console.log('Available tools:');
      console.log('  - Rurubu MCP:', this.rurubuMCP.listTools().length, 'tools');
      console.log('  - Map Tools:', this.mapController.getToolsForClaude().length, 'tools');

      // Auto-show user location or Tokyo Station
      this.showUserLocationAuto();

    } catch (error) {
      console.error('❌ Failed to initialize application:', error);
      this.showError('Initialization Error', error.message);
      this.addSystemMessage(this.i18n.t('system.initError'));
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Send button
    document.getElementById('sendBtn').addEventListener('click', () => {
      this.handleUserInput();
    });

    // Enter key in input
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleUserInput();
      }
    });

    // Language toggle
    document.getElementById('lang-toggle').addEventListener('click', () => {
      this.toggleLanguage();
    });

    // Map controls
    document.getElementById('recenterBtn').addEventListener('click', () => {
      this.recenterMap();
    });

    document.getElementById('clearChatBtn').addEventListener('click', () => {
      this.clearConversation();
    });

    // POI modal
    document.getElementById('closePoiModal').addEventListener('click', () => {
      this.hidePoiModal();
    });

    document.getElementById('poiModal').addEventListener('click', (e) => {
      if (e.target.id === 'poiModal') {
        this.hidePoiModal();
      }
    });

    // Error modal
    document.getElementById('closeErrorModal').addEventListener('click', () => {
      this.hideError();
    });

    document.getElementById('errorModal').addEventListener('click', (e) => {
      if (e.target.id === 'errorModal') {
        this.hideError();
      }
    });
  }

  /**
   * Handle user input from text field
   */
  async handleUserInput() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (!message || this.isProcessing) return;

    input.value = '';
    await this.processUserMessage(message);
  }

  /**
   * Process user message through Claude
   */
  async processUserMessage(message) {
    try {
      this.isProcessing = true;
      this.showLoading(true);

      // Add user message to chat
      this.addUserMessage(message);

      // Show thinking display
      const thinkingDisplay = document.getElementById('thinkingDisplay');
      const thinkingSteps = document.getElementById('thinkingSteps');
      thinkingDisplay.style.display = 'block';

      // Start simulated thinking process (non-blocking)
      this.thinkingSimulator.startThinking(message, thinkingSteps);

      // Create placeholder for streaming response
      const chatMessages = document.getElementById('chatMessages');
      const streamingMessageDiv = document.createElement('div');
      streamingMessageDiv.className = 'message assistant-message';

      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      streamingMessageDiv.appendChild(contentDiv);
      chatMessages.appendChild(streamingMessageDiv);

      // Scroll to bottom
      chatMessages.scrollTop = chatMessages.scrollHeight;

      // Process with Claude (with streaming)
      const response = await this.claudeClient.sendMessage(
        message,
        (status) => {
          this.updateLoadingStatus(status);
        },
        (text) => {
          // Streaming update callback
          contentDiv.innerHTML = this.formatResponse(text);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      );

      // Update token counter after message is processed
      this.updateTokenCounter();

      // Update with final response (in case streaming didn't work or for thinking)
      if (response.isError) {
        streamingMessageDiv.remove();
        this.addSystemMessage(response.text);
      } else {
        // Add thinking section if present
        if (response.thinking && response.thinking.length > 0) {
          const thinkingDiv = document.createElement('details');
          thinkingDiv.className = 'thinking-section';

          const summary = document.createElement('summary');
          summary.textContent = '🤔 Show AI thinking process';
          summary.style.cursor = 'pointer';
          summary.style.color = '#666';
          summary.style.fontSize = '0.9em';
          summary.style.marginBottom = '8px';
          summary.style.userSelect = 'none';

          const thinkingContent = document.createElement('div');
          thinkingContent.className = 'thinking-content';
          thinkingContent.style.backgroundColor = '#f5f5f5';
          thinkingContent.style.padding = '12px';
          thinkingContent.style.borderRadius = '8px';
          thinkingContent.style.marginBottom = '12px';
          thinkingContent.style.fontSize = '0.9em';
          thinkingContent.style.color = '#555';
          thinkingContent.style.fontFamily = 'monospace';
          thinkingContent.style.whiteSpace = 'pre-wrap';
          thinkingContent.style.maxHeight = '300px';
          thinkingContent.style.overflow = 'auto';

          thinkingContent.textContent = response.thinking.join('\n\n---\n\n');

          thinkingDiv.appendChild(summary);
          thinkingDiv.appendChild(thinkingContent);
          streamingMessageDiv.insertBefore(thinkingDiv, contentDiv);
        }

        // Update final content
        contentDiv.innerHTML = this.formatResponse(response.text);
      }

    } catch (error) {
      console.error('Error processing message:', error);
      this.addSystemMessage(`${this.i18n.t('status.error')}: ${error.message}`);
      this.showError('Processing Error', error.message);
    } finally {
      // Hide thinking display
      const thinkingDisplay = document.getElementById('thinkingDisplay');
      thinkingDisplay.style.display = 'none';
      this.thinkingSimulator.stopThinking();

      this.isProcessing = false;
      this.showLoading(false);
    }
  }

  /**
   * Toggle language
   */
  toggleLanguage() {
    this.i18n.toggleLanguage();
    this.updateUI();

    // Update map language
    const currentLang = this.i18n.getCurrentLanguage();
    if (this.mapController) {
      this.mapController.setMapLanguage(currentLang);
    }

    // Update welcome message in chat
    const chatMessages = document.getElementById('chatMessages');
    const firstMessage = chatMessages.querySelector('.message.system-message');
    if (firstMessage) {
      // Check if it's the welcome message by looking for key phrases
      const messageContent = firstMessage.textContent;
      if (messageContent.includes('travel assistant') || messageContent.includes('旅行アシスタント')) {
        // Replace with translated welcome message
        const contentDiv = firstMessage.querySelector('.message-content');
        if (contentDiv) {
          contentDiv.innerHTML = this.formatResponse(this.i18n.t('system.welcome'));
        }
      }
    }

    console.log('Language switched to:', currentLang);
  }

  /**
   * Update UI with current language
   */
  updateUI() {
    // Update header
    document.getElementById('app-title').textContent = this.i18n.t('title');
    document.getElementById('app-subtitle').textContent = this.i18n.t('subtitle');
    document.getElementById('lang-toggle').textContent = this.i18n.t('langToggle');

    // Update input placeholder
    document.getElementById('chatInput').placeholder = this.i18n.t('inputPlaceholder');
    document.getElementById('sendBtnText').textContent = this.i18n.t('sendButton');

    // Update map control buttons
    document.querySelectorAll('.label[data-i18n]').forEach(label => {
      const key = label.dataset.i18n;
      label.textContent = this.i18n.t(key);
    });
  }

  /**
   * Add user message to chat
   */
  addUserMessage(text) {
    this.addMessage('user', text);
  }

  /**
   * Add assistant message to chat
   */
  addAssistantMessage(text, thinking = null) {
    this.addMessage('assistant', text, thinking);
  }

  /**
   * Add system message to chat
   */
  addSystemMessage(text) {
    this.addMessage('system', text);
  }

  /**
   * Add message to chat display
   */
  addMessage(role, content, thinking = null) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;

    // Add thinking section if present (for assistant messages)
    if (role === 'assistant' && thinking && thinking.length > 0) {
      const thinkingDiv = document.createElement('details');
      thinkingDiv.className = 'thinking-section';

      const summary = document.createElement('summary');
      summary.textContent = '🤔 Show AI thinking process';
      summary.style.cursor = 'pointer';
      summary.style.color = '#666';
      summary.style.fontSize = '0.9em';
      summary.style.marginBottom = '8px';
      summary.style.userSelect = 'none';

      const thinkingContent = document.createElement('div');
      thinkingContent.className = 'thinking-content';
      thinkingContent.style.backgroundColor = '#f5f5f5';
      thinkingContent.style.padding = '12px';
      thinkingContent.style.borderRadius = '8px';
      thinkingContent.style.marginBottom = '12px';
      thinkingContent.style.fontSize = '0.9em';
      thinkingContent.style.color = '#555';
      thinkingContent.style.fontFamily = 'monospace';
      thinkingContent.style.whiteSpace = 'pre-wrap';
      thinkingContent.style.maxHeight = '300px';
      thinkingContent.style.overflow = 'auto';

      thinkingContent.textContent = thinking.join('\n\n---\n\n');

      thinkingDiv.appendChild(summary);
      thinkingDiv.appendChild(thinkingContent);
      messageDiv.appendChild(thinkingDiv);
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    if (role === 'user') {
      contentDiv.innerHTML = `<p><strong>You:</strong> ${this.escapeHtml(content)}</p>`;
    } else if (role === 'assistant') {
      contentDiv.innerHTML = this.formatResponse(content);
    } else {
      contentDiv.innerHTML = this.formatResponse(content);
    }

    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Limit chat history
    const messages = chatMessages.children;
    while (messages.length > this.config.MAX_CHAT_HISTORY) {
      chatMessages.removeChild(messages[0]);
    }
  }

  /**
   * Format response text (markdown-like)
   */
  formatResponse(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show/hide loading indicator
   */
  showLoading(show) {
    const indicator = document.getElementById('loadingIndicator');
    indicator.style.display = show ? 'flex' : 'none';
  }

  /**
   * Update loading status text
   */
  updateLoadingStatus(status) {
    document.getElementById('loadingText').textContent = status;
  }

  /**
   * Update token counter display
   */
  updateTokenCounter() {
    if (!this.claudeClient || !this.claudeClient.getTokenUsage) {
      return;
    }

    const tokenUsage = this.claudeClient.getTokenUsage();
    const tokenCountSpan = document.getElementById('token-count');
    const tokenCounterDiv = document.getElementById('token-counter');

    if (!tokenCountSpan || !tokenCounterDiv) {
      return;
    }

    // Format numbers with K suffix for consistency
    const formatTokens = (num) => {
      if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
      }
      return num.toString();
    };

    // Update display with consistent format and percentage
    const currentFormatted = formatTokens(tokenUsage.total);
    const maxFormatted = formatTokens(tokenUsage.max);
    tokenCountSpan.textContent = `${currentFormatted} / ${maxFormatted} (${tokenUsage.percentage}%)`;

    // Update CSS classes based on usage percentage
    tokenCounterDiv.classList.remove('warning', 'critical');

    if (tokenUsage.percentage >= 70) {
      tokenCounterDiv.classList.add('critical');
      console.log(`[App] ⚠️ Token usage CRITICAL: ${tokenUsage.percentage}% (${tokenUsage.total.toLocaleString()}/${tokenUsage.max.toLocaleString()}) - Auto-pruning will trigger soon`);
    } else if (tokenUsage.percentage >= 50) {
      tokenCounterDiv.classList.add('warning');
      console.log(`[App] ⚠️ Token usage WARNING: ${tokenUsage.percentage}% (${tokenUsage.total.toLocaleString()}/${tokenUsage.max.toLocaleString()})`);
    } else {
      console.log(`[App] Token usage: ${tokenUsage.percentage}% (${tokenUsage.total.toLocaleString()}/${tokenUsage.max.toLocaleString()})`);
    }
  }

  /**
   * Recenter map
   */
  recenterMap() {
    this.mapController.recenterMap();
    this.addSystemMessage(this.i18n.t('system.mapRecentered'));
  }

  /**
   * Show user location automatically on map load
   * Falls back to Tokyo Station if geolocation fails
   */
  async showUserLocationAuto() {
    try {
      // Try to get user's location
      const location = await this.mapController.showUserLocation(true); // Fly to user location
      console.log('[App] User location shown:', location);

      // Reverse geocode to get human-readable place name
      const geocodeResult = await reverseGeocode(
        location.longitude,
        location.latitude,
        this.config.MAPBOX_ACCESS_TOKEN
      );

      if (geocodeResult) {
        const props = geocodeResult.properties || {};
        location.placeName = props.place_formatted || props.full_address || props.name;
        location.name = props.name;
        location.address = props.full_address;
        console.log('[App] Reverse geocoded location:', location.placeName);
      }

      // Store user location for Claude context
      this.userLocation = location;

      // Update Claude with user location
      if (this.claudeClient) {
        this.claudeClient.updateUserLocation(location);
      }
    } catch (error) {
      // Geolocation failed, show Tokyo Station as default
      console.log('[App] Geolocation unavailable, using Tokyo Station as default');

      const tokyoStation = {
        latitude: 35.681236,
        longitude: 139.767125
      };

      // Show marker at Tokyo Station and fly to it
      await this.mapController.showLocationMarker(
        tokyoStation.longitude,
        tokyoStation.latitude,
        'Default Location (Tokyo Station)',
        true // Fly to Tokyo Station
      );

      // Reverse geocode Tokyo Station
      const geocodeResult = await reverseGeocode(
        tokyoStation.longitude,
        tokyoStation.latitude,
        this.config.MAPBOX_ACCESS_TOKEN
      );

      if (geocodeResult) {
        const props = geocodeResult.properties || {};
        tokyoStation.placeName = props.place_formatted || props.full_address || props.name;
        tokyoStation.name = props.name;
        tokyoStation.address = props.full_address;
        console.log('[App] Reverse geocoded Tokyo Station:', tokyoStation.placeName);
      } else {
        tokyoStation.placeName = 'Tokyo Station, Tokyo, Japan';
        tokyoStation.name = 'Tokyo Station';
      }

      // Store Tokyo Station as user location fallback
      this.userLocation = tokyoStation;

      // Update Claude with fallback location
      if (this.claudeClient) {
        this.claudeClient.updateUserLocation(tokyoStation);
      }
    }
  }

  /**
   * Clear conversation
   */
  clearConversation() {
    // Clear Claude history
    this.claudeClient.clearHistory();

    // Clear chat UI
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';

    // Clear map (preserves user location marker)
    this.mapController.clearMap();

    // Add welcome message back
    this.addSystemMessage(this.i18n.t('system.welcome'));

    this.addSystemMessage(this.i18n.t('system.cleared'));

    // Reset token counter
    this.updateTokenCounter();
  }

  /**
   * Store full Rurubu GeoJSON data with all properties
   * Called when Rurubu search results are returned
   * Stores in search history and automatically displays on map
   *
   * @param {object} geojson - GeoJSON FeatureCollection
   * @param {object} metadata - Search metadata (category, location, etc.)
   * @returns {string} searchId - ID of the stored search
   */
  async storeRurubuData(geojson, metadata = {}) {
    console.log('[App] Storing Rurubu POI data:', geojson.features.length, 'features');

    // Generate unique search ID
    const searchId = `search_${++this.searchIdCounter}`;
    const timestamp = new Date().toISOString();

    // Create search record
    const searchRecord = {
      id: searchId,
      timestamp: timestamp,
      category: metadata.category || 'unknown',
      location: metadata.location || 'unknown',
      jis_code: metadata.jis_code || '',
      count: geojson.features.length,
      pages: metadata.pages || 1,
      geojson: geojson,
      visible: true // Start as visible
    };

    // Store in history
    this.searchHistory.set(searchId, searchRecord);
    this.visibleSearchIds.add(searchId);

    console.log(`[App] Stored search ${searchId}: ${searchRecord.count} POIs from ${searchRecord.category} in ${searchRecord.location}`);
    console.log(`[App] Total searches in history: ${this.searchHistory.size}`);

    // Store POI details for quick lookup
    geojson.features.forEach(feature => {
      const name = feature.properties.name;
      if (name) {
        this.poiDataStore.set(name, {
          ...feature.properties,
          searchId: searchId // Tag which search this POI came from
        });
      }
    });

    // AUTOMATICALLY display on map with icon layers
    try {
      // Clear old layers first if this is the first search
      if (this.visibleSearchIds.size === 1) {
        console.log('[App] Clearing map for first search...');
        this.mapController.executeTool('clear_map_layers', {}).catch(() => {});
      }

      // Add icon layer with layer name based on search ID
      const layerName = `search-layer-${searchId}`;
      await this.mapController.addIconLayer(geojson, layerName);

      // Fit map bounds to show all newly added POIs
      const bounds = this.mapController.calculateGeojsonBounds(geojson);
      if (bounds) {
        this.mapController.fitBounds(bounds);
        console.log('[App] Fitted map bounds to show all POIs');
      }

      console.log('[App] Auto-displayed search', searchId, 'on map with icon layer');
    } catch (error) {
      console.error('[App] Failed to auto-display POIs on map:', error);
    }

    return searchId;
  }

  /**
   * List all stored searches
   * @returns {array} Array of search summaries
   */
  listSearchHistory() {
    const searches = Array.from(this.searchHistory.values()).map(search => ({
      id: search.id,
      timestamp: search.timestamp,
      category: search.category,
      location: search.location,
      count: search.count,
      pages: search.pages,
      visible: search.visible
    }));

    console.log(`[App] Listed ${searches.length} searches from history`);
    return searches;
  }

  /**
   * Show a specific search on the map
   * @param {string} searchId - ID of the search to show
   */
  async showSearchResults(searchId) {
    const search = this.searchHistory.get(searchId);
    if (!search) {
      throw new Error(`Search ${searchId} not found in history`);
    }

    if (search.visible) {
      console.log(`[App] Search ${searchId} is already visible`);
      return;
    }

    // Add to visible set
    this.visibleSearchIds.add(searchId);
    search.visible = true;

    // Display on map with icon layer
    try {
      const layerName = `search-layer-${searchId}`;
      await this.mapController.addIconLayer(search.geojson, layerName);

      // Fit map bounds to show all POIs from this search
      const bounds = this.mapController.calculateGeojsonBounds(search.geojson);
      if (bounds) {
        this.mapController.fitBounds(bounds);
        console.log(`[App] Fitted map bounds to show search ${searchId}`);
      }

      console.log(`[App] Showed search ${searchId} on map with icon layer`);
    } catch (error) {
      console.error(`[App] Failed to show search ${searchId}:`, error);
      throw error;
    }
  }

  /**
   * Hide a specific search from the map
   * @param {string} searchId - ID of the search to hide
   */
  hideSearchResults(searchId) {
    const search = this.searchHistory.get(searchId);
    if (!search) {
      throw new Error(`Search ${searchId} not found in history`);
    }

    if (!search.visible) {
      console.log(`[App] Search ${searchId} is already hidden`);
      return;
    }

    // Remove from visible set
    this.visibleSearchIds.delete(searchId);
    search.visible = false;

    // Remove layer from map
    try {
      const layerName = `search-layer-${searchId}`;
      this.mapController.removeLayer(layerName);
      console.log(`[App] Hid search ${searchId} from map (removed layer)`);
    } catch (error) {
      console.error(`[App] Failed to hide search ${searchId}:`, error);
      throw error;
    }
  }

  /**
   * Clear all searches from history and map
   */
  clearAllSearches() {
    console.log(`[App] Clearing all ${this.searchHistory.size} searches from history`);

    // Clear all map layers
    try {
      this.mapController.executeTool('clear_map_layers', {});
    } catch (error) {
      // Ignore errors if there are no layers to clear
    }

    // Clear data structures
    this.searchHistory.clear();
    this.visibleSearchIds.clear();
    this.poiDataStore.clear();
    this.searchIdCounter = 0;

    console.log('[App] All searches cleared');
  }

  /**
   * Get tools for Claude to manage search history
   */
  getSearchHistoryTools() {
    return [
      {
        name: 'list_search_history',
        description: 'List all stored POI searches with their details (ID, category, location, count, visibility status). Use this to see what searches are available.',
        input_schema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'show_search_results',
        description: 'Show a previously stored search on the map by its search ID. The search must exist in history.',
        input_schema: {
          type: 'object',
          properties: {
            search_id: {
              type: 'string',
              description: 'The search ID to show (e.g., "search_1", "search_2")'
            }
          },
          required: ['search_id']
        }
      },
      {
        name: 'hide_search_results',
        description: 'Hide a currently visible search from the map by its search ID. The search remains in history and can be shown again later.',
        input_schema: {
          type: 'object',
          properties: {
            search_id: {
              type: 'string',
              description: 'The search ID to hide (e.g., "search_1", "search_2")'
            }
          },
          required: ['search_id']
        }
      },
      {
        name: 'clear_all_searches',
        description: 'Clear all searches from history and remove all POIs from the map. This is a destructive operation that cannot be undone.',
        input_schema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ];
  }

  /**
   * Get all POIs currently visible on the map
   * Groups POIs by search location and returns essential fields only
   * Used by Claude for trip planning across multiple searches
   *
   * @returns {array} Array of location groups with POI arrays
   */
  getAllSearchPOIs() {
    const locationGroups = [];

    // Iterate through visible searches only
    this.visibleSearchIds.forEach(searchId => {
      const search = this.searchHistory.get(searchId);
      if (!search || !search.geojson) return;

      // Create location group
      const locationGroup = {
        location: search.location,
        category: search.category,
        pois: []
      };

      // Extract essential POI fields
      search.geojson.features.forEach(feature => {
        const props = feature.properties;
        locationGroup.pois.push({
          name: props.name || props.title || 'Unknown',
          category: search.category,
          coordinates: feature.geometry.coordinates, // [lng, lat]
          rating: props.rank || props.rating || null
        });
      });

      locationGroups.push(locationGroup);
    });

    console.log(`[App] Retrieved ${locationGroups.length} location groups with POIs for Claude`);
    return locationGroups;
  }

  /**
   * Execute a search history tool
   */
  async executeSearchHistoryTool(toolName, args) {
    console.log(`[App] Executing search history tool: ${toolName}`, args);

    try {
      switch (toolName) {
        case 'list_search_history': {
          const searches = this.listSearchHistory();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(searches, null, 2)
            }]
          };
        }

        case 'show_search_results': {
          this.showSearchResults(args.search_id);
          return {
            content: [{
              type: 'text',
              text: `Search ${args.search_id} is now visible on the map`
            }]
          };
        }

        case 'hide_search_results': {
          this.hideSearchResults(args.search_id);
          return {
            content: [{
              type: 'text',
              text: `Search ${args.search_id} has been hidden from the map`
            }]
          };
        }

        case 'clear_all_searches': {
          this.clearAllSearches();
          return {
            content: [{
              type: 'text',
              text: 'All searches have been cleared from history and map'
            }]
          };
        }

        default:
          throw new Error(`Unknown search history tool: ${toolName}`);
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * Update POI modal labels based on current language
   */
  updatePoiModalLabels() {
    const modal = document.getElementById('poiModal');
    const labels = modal.querySelectorAll('.poi-details dt');

    // Update each label using i18n
    if (labels.length >= 5) {
      labels[0].textContent = this.i18n.t('poi.address');
      labels[1].textContent = this.i18n.t('poi.phone');
      labels[2].textContent = this.i18n.t('poi.hours');
      labels[3].textContent = this.i18n.t('poi.rating');
      labels[4].textContent = this.i18n.t('poi.price');
    }
  }

  /**
   * Translate POI data from Japanese to English using Claude (direct API call)
   */
  async translatePoiData(properties) {
    try {
      const fieldsToTranslate = {
        name: properties.title || properties.name || '',
        address: properties.address || '',
        summary: properties.summary || '',
        time: properties.time || '',
        price: properties.price || '',
        rank: properties.rank || ''
      };

      // Skip translation if no text to translate
      if (!fieldsToTranslate.name && !fieldsToTranslate.summary) {
        console.log('[App] No text to translate, returning original properties');
        return properties;
      }


      const translationPrompt = `Translate the following Japanese POI (Point of Interest) information to English. Keep it concise and natural. Preserve formatting and structure.

Name: ${fieldsToTranslate.name}
${fieldsToTranslate.address ? `Address: ${fieldsToTranslate.address}` : ''}
${fieldsToTranslate.summary ? `Summary: ${fieldsToTranslate.summary}` : ''}
${fieldsToTranslate.time ? `Hours: ${fieldsToTranslate.time}` : ''}
${fieldsToTranslate.price ? `Price: ${fieldsToTranslate.price}` : ''}
${fieldsToTranslate.rank ? `Rating: ${fieldsToTranslate.rank}` : ''}

Return ONLY the translations in this exact format (omit any fields that weren't provided):
Name: [translated name]
Address: [translated address]
Summary: [translated summary]
Hours: [translated hours]
Price: [translated price]
Rating: [translated rating]`;

      // Save and temporarily clear conversation history for translation
      const savedHistory = [...this.claudeClient.conversationHistory];
      this.claudeClient.conversationHistory = [];

      try {
        const response = await this.claudeClient.sendMessage(
          translationPrompt,
          null,
          null
        );


        // Extract text from response
        const responseText = response.text || '';

        if (!responseText) {
          console.warn('[App] Empty response from translation, returning original');
          return properties;
        }

        const lines = responseText.trim().split('\n');
        const translated = { ...properties };

        for (const line of lines) {
          if (line.startsWith('Name:')) {
            translated.name = line.replace('Name:', '').trim();
            translated.title = translated.name;
          } else if (line.startsWith('Address:')) {
            translated.address = line.replace('Address:', '').trim();
          } else if (line.startsWith('Summary:')) {
            translated.summary = line.replace('Summary:', '').trim();
          } else if (line.startsWith('Hours:')) {
            translated.time = line.replace('Hours:', '').trim();
          } else if (line.startsWith('Price:')) {
            translated.price = line.replace('Price:', '').trim();
          } else if (line.startsWith('Rating:')) {
            translated.rank = line.replace('Rating:', '').trim();
          }
        }

        return translated;
      } finally {
        // Always restore the conversation history
        this.claudeClient.conversationHistory = savedHistory;
      }

    } catch (error) {
      console.error('[App] Translation failed:', error);
      // Return original properties if translation fails
      return properties;
    }
  }

  /**
   * Show POI details modal
   */
  async showPoiModal(properties) {

    // Show modal immediately with loading state if translation needed
    const modal = document.getElementById('poiModal');
    const modalBody = modal.querySelector('.poi-modal-body');

    if (this.i18n.isEnglish()) {
      // Show modal with loading indicator
      modal.style.display = 'flex';

      // Create and show loading overlay
      const loadingOverlay = document.createElement('div');
      loadingOverlay.id = 'poiLoadingOverlay';
      loadingOverlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.95);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        border-radius: 12px;
      `;
      loadingOverlay.innerHTML = `
        <div style="font-size: 2rem; margin-bottom: 1rem;">🌐</div>
        <div style="font-size: 1rem; color: #666;">Translating to English...</div>
      `;
      modal.querySelector('.modal-content').appendChild(loadingOverlay);
    }

    // Try to look up full Rurubu data using name/title
    let fullData = null;
    const nameKey = properties.title || properties.name;

    // Debug: Show what we're looking for and what's available

    if (nameKey) {
      // Try exact match first
      fullData = this.poiDataStore.get(nameKey);

      // If not found and name has English in parentheses, try without it
      if (!fullData && nameKey.includes('(')) {
        const japaneseOnly = nameKey.replace(/\s*\([^)]*\)\s*$/, '').trim();
        fullData = this.poiDataStore.get(japaneseOnly);
      }

      if (fullData) {
        console.log('[App] ✓ Found full Rurubu data for this POI');
        // Merge full data with properties (full data takes precedence)
        properties = { ...properties, ...fullData };
      } else {
        console.log('[App] ✗ No full data found for:', nameKey);
      }
    }

    // Update POI modal labels based on current language
    this.updatePoiModalLabels();

    // Translate to English if language is set to English
    if (this.i18n.isEnglish()) {
      properties = await this.translatePoiData(properties);
    }

    // Handle both property formats:
    // - Map tools uses: title, description (with info embedded in description)
    // - Rurubu uses: name, address, tel, time, rank, price, photo, summary (all in Japanese)

    // Strip English from name (e.g., "ひるがお 本店 (Hirugao Honten)" -> "ひるがお 本店")
    let name = properties.title || properties.name || 'Unknown';
    if (name.includes('(')) {
      name = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
    }

    // ONLY use Rurubu data fields (never use Claude's description)
    const description = properties.summary || ''; // Only Rurubu's summary
    const phone = properties.tel || ''; // Only Rurubu's tel
    const hours = properties.time || ''; // Only Rurubu's time
    const rating = properties.rank || ''; // Only Rurubu's rank
    const price = properties.price || ''; // Only Rurubu's price
    const address = properties.address || ''; // Only Rurubu's address

    // Populate modal with POI data
    document.getElementById('poiName').textContent = name;

    // Helper function to show/hide a field and its label
    const setFieldVisibility = (fieldId, value) => {
      const dd = document.getElementById(fieldId);
      const dt = dd.previousElementSibling; // Get the <dt> label before the <dd>

      if (value) {
        dd.textContent = value;
        dd.style.display = '';
        dt.style.display = '';
      } else {
        dd.style.display = 'none';
        dt.style.display = 'none';
      }
    };

    // Show/hide fields based on availability (only Rurubu data)
    setFieldVisibility('poiAddress', address);
    setFieldVisibility('poiPhone', phone);
    setFieldVisibility('poiHours', hours);
    setFieldVisibility('poiRating', rating);
    setFieldVisibility('poiPrice', price);

    // Handle photo
    const photoDiv = document.getElementById('poiPhoto');
    const photoImg = document.getElementById('poiPhotoImg');
    if (properties.photo) {
      photoImg.src = properties.photo;
      photoDiv.style.display = 'block';
    } else {
      photoDiv.style.display = 'none';
    }

    // Handle summary/description
    const summaryDiv = document.getElementById('poiSummary');
    if (description) {
      summaryDiv.textContent = description;
      summaryDiv.style.display = 'block';
    } else {
      summaryDiv.style.display = 'none';
    }

    // Remove loading overlay if it exists
    const loadingOverlay = document.getElementById('poiLoadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.remove();
    }

    // Show modal (already shown if translating, but show again in case it wasn't)
    modal.style.display = 'flex';
  }

  /**
   * Hide POI details modal
   */
  hidePoiModal() {
    // Clean up loading overlay if it exists
    const loadingOverlay = document.getElementById('poiLoadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.remove();
    }
    document.getElementById('poiModal').style.display = 'none';
  }

  /**
   * Show configuration error
   */
  showConfigError() {
    this.showError('Configuration Required', this.i18n.t('system.configError'));
    this.addSystemMessage(this.i18n.t('system.configError'));
  }

  /**
   * Show error modal
   */
  showError(title, message) {
    document.querySelector('#errorModal h3').textContent = title;
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorModal').style.display = 'flex';
  }

  /**
   * Hide error modal
   */
  hideError() {
    document.getElementById('errorModal').style.display = 'none';
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded');
  window.app = new JapanDayTripApp();
  window.app.initialize();
});
