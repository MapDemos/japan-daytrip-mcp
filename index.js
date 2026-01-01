/**
 * Japan Day Trip MCP Assistant - Refactored
 *
 * This file extends BaseApp from @mapdemos/ai-framework with Japan-specific logic.
 *
 * BEFORE: 2478 lines (everything including common boilerplate)
 * AFTER: ~1400 lines (only Japan-specific business logic)
 *
 * Common code now in BaseApp (framework):
 * - Complete initialization flow (initialize())
 * - UI management (addMessage, showLoading, formatResponse, etc.)
 * - Event handling (setupEventListeners, cleanup)
 * - Rate limiting
 * - Input validation
 * - Error handling (showError, hideError)
 * - Token counter
 * - AI conversation flow (processUserMessage)
 * - AI client initialization (Claude/Gemini)
 * - Map controller initialization
 * - Map language setup
 * - Map context updates (updateClaudeMapContext)
 *
 * Japan demo only provides:
 * - Configuration validation (validateConfig)
 * - Data sources (getDataSources - returns RurubuMCP)
 * - System prompt (getSystemPromptBuilder - returns buildJapanTravelPrompt)
 * - Map event handlers (onMapReady - POI marker clicks)
 * - Domain-specific methods (POI management, search history, translations)
 */

import { CONFIG, validateConfig } from './config.js';
import { RurubuMCPClient } from './modules/rurubu-mcp-client.js';
import { reverseGeocode } from '@mapdemos/ai-framework/map';
import { errorLogger, safeGetElement, getUserLocation } from '@mapdemos/ai-framework/core';
import { JAPAN_TRANSLATIONS } from './translations/japan-i18n.js';
import { JapanThinkingMessages } from './modules/japan-thinking-messages.js';
import { buildJapanTravelPrompt } from './prompts/japan-system-prompt.js';

// Import BaseApp from framework
import { BaseApp } from '@mapdemos/ai-framework/app';

/**
 * Japan Day Trip Application
 * Extends BaseApp with Japan-specific functionality:
 * - POI data management
 * - Search history
 * - Rurubu MCP integration
 * - Translation features
 * - Japan location detection
 */
class JapanDayTripApp extends BaseApp {
  constructor() {
    // Call parent constructor with config, translations, and thinking messages
    super(CONFIG, JAPAN_TRANSLATIONS, new JapanThinkingMessages());

    // Define Japan region bounds for location checking
    this.regionBounds = {
      north: 45.5,
      south: 24.0,
      east: 154.0,
      west: 122.0
    };

    // Japan-specific properties
    this.rurubuMCP = null;

    // Store full POI data with all Rurubu properties
    this.poiDataStore = new Map();
    this.MAX_POI_DATA_STORE_SIZE = this.config.MAX_POI_DATA_STORE_SIZE;

    // Search history management
    this.searchHistory = new Map();
    this.searchIdCounter = 0;
    this.visibleSearchIds = new Set();

    // Translation cache
    this.translationCache = new Map();
    this.MAX_TRANSLATION_CACHE_SIZE = this.config.MAX_TRANSLATION_CACHE_SIZE;
  }

  /**
   * Validate configuration (override from BaseApp)
   */
  validateConfig() {
    return validateConfig();
  }

  /**
   * Get data sources for AI client (override from BaseApp)
   */
  async getDataSources() {
    // Initialize Rurubu MCP (client-side)
    this.rurubuMCP = new RurubuMCPClient(this.config, this);
    await this.rurubuMCP.initialize();

    return [this.rurubuMCP];
  }

  /**
   * Get system prompt builder (override from BaseApp)
   */
  getSystemPromptBuilder() {
    return buildJapanTravelPrompt;
  }

  /**
   * Hook called after map is ready (override from BaseApp)
   * Setup Japan-specific map handlers
   */
  async onMapReady() {
    // Setup POI marker click handler
    this.mapController.onMarkerClick(async (properties) => {
      await this.showPoiModal(properties);
    });
  }

  /**
   * Setup event listeners
   * Extends BaseApp.setupEventListeners() with Japan-specific listeners
   */
  setupEventListeners() {
    // Call parent to setup common listeners (send button, clear chat, etc.)
    super.setupEventListeners();

    // Add Japan-specific event listeners
    // POI Modal close
    this.eventHandlers.closePoi = () => this.hidePoiModal();
    document.getElementById('closePoiModal')?.addEventListener(
      'click',
      this.eventHandlers.closePoi,
      { signal: this.abortController.signal }
    );
  }

  /**
   * Check if location is in Japan
   * Delegates to BaseApp.isLocationInRegion()
   */
  isLocationInJapan(longitude, latitude) {
    return this.isLocationInRegion(longitude, latitude);
  }

  /**
   * Show user location automatically (Japan-specific implementation)
   * Falls back to Tokyo Station if geolocation fails or location is outside Japan
   */
  async showUserLocationAuto() {
    try {
      // Try to get user's location
      const location = await this.mapController.showUserLocation();

      // Check if location is within Japan's bounding box
      if (!this.isLocationInJapan(location.longitude, location.latitude)) {
        throw new Error('Location outside Japan');
      }

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
      }

      // Store user location for Claude context
      this.userLocation = location;

      // Update Claude with user location
      if (this.claudeClient) {
        this.claudeClient.updateUserLocation(location);
      }
    } catch (error) {
      // Geolocation failed or location outside Japan, show Tokyo Station as default
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
   * Store full Rurubu GeoJSON data with all properties
   * Called when Rurubu search results are returned
   * Stores in search history and automatically displays on map
   *
   * @param {object} geojson - GeoJSON FeatureCollection
   * @param {object} metadata - Search metadata (category, location, etc.)
   * @returns {string} searchId - ID of the stored search
   */
  async storeSearchData(geojson, metadata = {}) {
    // Cap search history to prevent memory issues
    const MAX_SEARCHES = this.config.MAX_SEARCH_HISTORY || 10;
    if (this.searchHistory.size >= MAX_SEARCHES) {
      // Remove oldest search
      const oldestSearchId = Array.from(this.searchHistory.keys())[0];

      // Remove from map
      try {
        const layerName = `search-layer-${oldestSearchId}`;
        this.mapController.removeLayer(layerName);
      } catch (error) {
        errorLogger.warn('Search History Cleanup', 'Error removing old layer', { searchId: oldestSearchId, error: error.message });
      }

      // Remove from history and visible set
      this.searchHistory.delete(oldestSearchId);
      this.visibleSearchIds.delete(oldestSearchId);

      // Clean up POIs from that search
      for (const [name, data] of this.poiDataStore.entries()) {
        if (data.searchId === oldestSearchId) {
          this.poiDataStore.delete(name);
        }
      }
    }

    // Check total visible POI count
    const totalVisiblePOIs = Array.from(this.visibleSearchIds)
      .reduce((count, searchId) => {
        const search = this.searchHistory.get(searchId);
        return count + (search?.count || 0);
      }, 0);

    const MAX_VISIBLE_POIS = this.config.MAX_VISIBLE_POIS || 500;
    if (totalVisiblePOIs > MAX_VISIBLE_POIS) {
      errorLogger.warn('POI Display', 'Too many visible POIs, hiding oldest search', {
        totalVisiblePOIs,
        maxAllowed: MAX_VISIBLE_POIS,
        visibleSearchCount: this.visibleSearchIds.size
      });
      const oldestVisible = Array.from(this.visibleSearchIds)[0];
      if (oldestVisible) {
        this.hideSearchResults(oldestVisible);
      }
    }

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
      visible: false // Not displayed by default (prevents clutter)
    };

    // Store in history (but NOT in visibleSearchIds since layer is not displayed)
    this.searchHistory.set(searchId, searchRecord);
    // Note: visibleSearchIds will be updated when show_search_results is called

    // Store POI details for quick lookup with LRU eviction
    geojson.features.forEach(feature => {
      const name = feature.properties.name;
      if (name) {
        // LRU eviction: remove oldest entry if at capacity
        if (this.poiDataStore.size >= this.MAX_POI_DATA_STORE_SIZE && !this.poiDataStore.has(name)) {
          const firstKey = this.poiDataStore.keys().next().value;
          this.poiDataStore.delete(firstKey);
        }

        // If updating existing entry, delete and re-add to move to end (LRU)
        if (this.poiDataStore.has(name)) {
          this.poiDataStore.delete(name);
        }

        this.poiDataStore.set(name, {
          ...feature.properties,
          searchId: searchId // Tag which search this POI came from
        });
      }
    });

    // Store search results in memory but DON'T automatically display on map
    // This prevents map clutter (100+ POI icons)
    // Results will be shown only when:
    // 1. Claude calls highlight_recommended_pois (shows 3-5 curated picks), OR
    // 2. User explicitly asks to see all results (Claude calls show_search_results tool)
    // Note: Layer can be added later via showSearchResults(searchId) method

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
      }
    } catch (error) {
      errorLogger.log('Show Search Results', error, { searchId });
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
      return;
    }

    // Remove from visible set
    this.visibleSearchIds.delete(searchId);
    search.visible = false;

    // Remove layer from map
    try {
      const layerName = `search-layer-${searchId}`;
      this.mapController.removeLayer(layerName);
    } catch (error) {
      errorLogger.log('Hide Search Results', error, { searchId });
      throw error;
    }
  }

  /**
   * Clear all searches from history and map
   */
  async clearAllSearches() {
    // Manually remove each search layer before clearing data structures
    // This ensures layers are removed even if clear_map_layers doesn't work
    for (const searchId of this.searchHistory.keys()) {
      try {
        const layerName = `search-layer-${searchId}`;
        this.mapController.removeLayer(layerName);
      } catch (error) {
        // Ignore errors if layer doesn't exist
        errorLogger.warn('Clear Searches', 'Failed to remove layer', { searchId, error: error.message });
      }
    }

    // Also try clear_map_layers as backup
    try {
      await this.mapController.executeTool('clear_map_layers', {});
    } catch (error) {
      // Ignore errors if there are no layers to clear
      errorLogger.warn('Clear Searches', 'Failed to clear map layers', { error: error.message });
    }

    // Clear data structures
    this.searchHistory.clear();
    this.visibleSearchIds.clear();
    this.poiDataStore.clear();
    this.searchIdCounter = 0;
  }

  /**
   * Parse time string and extract closing time
   * Handles common Japanese time formats and edge cases
   * @param {string} timeStr - Time string like "9:00-21:00" or "24時間営業"
   * @returns {Object|null} {closes_at: "21:00", is_24h: boolean, irregular: boolean} or null if unparseable
   */
  parseTimeString(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;

    const str = timeStr.trim();

    // Check for 24-hour places
    if (str.includes('24時間') || str.includes('24h') || str.includes('24H')) {
      return { closes_at: '24:00', is_24h: true, irregular: false };
    }

    // Check for irregular/variable hours (common in Japanese)
    const irregularPatterns = [
      '不定休', '不規則', '不定期', 'irregular', 'varies',
      '要確認', '応相談', 'check', '確認'
    ];
    for (const pattern of irregularPatterns) {
      if (str.includes(pattern)) {
        return { closes_at: null, is_24h: false, irregular: true };
      }
    }

    // Check for closed/休み
    if (str.includes('定休') || str.includes('休業') || str.includes('closed')) {
      return { closes_at: null, is_24h: false, irregular: true };
    }

    // Try to extract closing time from common formats
    // Formats: "9:00-21:00", "9:00~21:00", "9時-21時", "11:00~14:00, 17:00~22:00"

    // Handle overnight hours (e.g., "18:00-翌2:00", "18:00-next day 2:00")
    const overnightMatch = str.match(/(\d{1,2}):(\d{2})\s*[-~～]\s*(?:翌|next day|翌日)\s*(\d{1,2}):(\d{2})/i);
    if (overnightMatch && overnightMatch.length >= 5) {
      const closeHour = parseInt(overnightMatch[3]);
      const closeMin = overnightMatch[4];
      // Convert to 24+ hour format (e.g., 2:00 next day = 26:00)
      const adjustedHour = (closeHour + 24).toString().padStart(2, '0');
      return { closes_at: `${adjustedHour}:${closeMin}`, is_24h: false, irregular: false };
    }

    // Match HH:MM-HH:MM or HH:MM~HH:MM
    const match1 = str.match(/(\d{1,2}):(\d{2})\s*[-~～]\s*(\d{1,2}):(\d{2})/g);
    if (match1 && match1.length > 0) {
      // Get the last time range (handles lunch/dinner splits)
      const lastRange = match1[match1.length - 1];
      const parts = lastRange.match(/(\d{1,2}):(\d{2})\s*[-~～]\s*(\d{1,2}):(\d{2})/);
      if (parts && parts.length >= 5 && parts[3] && parts[4]) {
        const openHour = parseInt(parts[1]);
        const closeHour = parseInt(parts[3]);
        const closeMin = parts[4];

        // Detect overnight hours (close time < open time suggests next day)
        // e.g., "22:00-2:00" likely means 22:00 to 2:00 next day
        let adjustedCloseHour = closeHour;
        if (closeHour < openHour && closeHour < 12) {
          adjustedCloseHour = closeHour + 24; // Convert to 24+ format
        }

        const formattedHour = adjustedCloseHour.toString().padStart(2, '0');
        return { closes_at: `${formattedHour}:${closeMin}`, is_24h: false, irregular: false };
      }
    }

    // Match Japanese format: "9時-21時"
    const match2 = str.match(/(\d{1,2})時\s*[-~～]\s*(\d{1,2})時/g);
    if (match2 && match2.length > 0) {
      const lastRange = match2[match2.length - 1];
      const parts = lastRange.match(/(\d{1,2})時\s*[-~～]\s*(\d{1,2})時/);
      if (parts && parts.length >= 3 && parts[2]) {
        const openHour = parseInt(parts[1]);
        const closeHour = parseInt(parts[2]);

        // Handle overnight
        let adjustedCloseHour = closeHour;
        if (closeHour < openHour && closeHour < 12) {
          adjustedCloseHour = closeHour + 24;
        }

        const formattedHour = adjustedCloseHour.toString().padStart(2, '0');
        return { closes_at: `${formattedHour}:00`, is_24h: false, irregular: false };
      }
    }

    // Couldn't parse
    return null;
  }

  /**
   * Check if a place is open after a specific time using pre-parsed time object
   * Performance optimized version that avoids re-parsing
   * @param {Object|null} parsed - Parsed time object from parseTimeString()
   * @param {string} targetTime - Target time like "21:00"
   * @returns {boolean} True if open after target time (or unknown)
   */
  isOpenAfterParsed(parsed, targetTime) {
    // If can't parse, include it (let Claude decide)
    if (!parsed) return true;

    // 24-hour places are always open
    if (parsed.is_24h) return true;

    // Irregular hours - include them (let Claude/user verify)
    if (parsed.irregular || !parsed.closes_at) return true;

    // Compare closing time with target time
    // Convert to minutes for comparison
    const [targetH, targetM] = targetTime.split(':').map(Number);
    const targetMinutes = targetH * 60 + targetM;

    const [closeH, closeM] = parsed.closes_at.split(':').map(Number);
    const closeMinutes = closeH * 60 + closeM;

    // Open if closes after target time
    return closeMinutes > targetMinutes;
  }

  /**
   * Get lightweight POI summary list across ALL stored POIs
   * Returns just id, name, category, rating for token efficiency
   * @param {Object} options - Filter options
   * @returns {Object} Summary list of POIs
   */
  getPOISummary(options = {}) {
    const {
      category = null,
      min_rating = null,
      search_text = null,
      open_after = null,
      sort_by = 'rating',
      limit = 100
    } = options;

    // Cap limit to prevent token overflow
    const cappedLimit = Math.min(limit, 200);

    // Pre-compute search string (avoid repeated toLowerCase calls)
    const searchLower = search_text ? search_text.toLowerCase() : null;

    const allPOIs = [];

    // Collect POIs from ALL searches in history (not just visible ones)
    // This allows get_poi_summary to work even when layers aren't displayed on map
    this.searchHistory.forEach((search, searchId) => {
      if (!search || !search.geojson) return;

      // Filter by category if specified (category filter at search level)
      if (category && search.category !== category) return;

      search.geojson.features.forEach(feature => {
        const props = feature.properties;
        const rating = props.rank || props.rating || 0;

        // Apply rating filter (early exit for performance)
        if (min_rating && rating < min_rating) return;

        // Text search using cached lowercase strings
        if (searchLower) {
          // Use cached _searchText or compute once
          if (!props._searchText) {
            props._searchText = `${props.name || ''} ${props.sgenreName || ''} ${props.address || ''}`.toLowerCase();
          }

          if (!props._searchText.includes(searchLower)) {
            return;
          }
        }

        // Time filter using cached parsed time
        if (open_after && props.time) {
          // Parse and cache time on first access
          if (props._parsedTime === undefined) {
            props._parsedTime = this.parseTimeString(props.time);
          }

          // Use cached parsed time for comparison
          if (!props._parsedTime || !this.isOpenAfterParsed(props._parsedTime, open_after)) {
            return;
          }
        }

        // Add lightweight summary with full-precision coordinates
        allPOIs.push({
          id: String(props.id), // Convert to string for consistency with get_poi_details
          name: props.name || 'Unknown',
          category: search.category,
          genre: props.sgenreName || null,
          rating: rating,
          price: props.price || null,
          time: props.time || null,
          coordinates: feature.geometry?.coordinates || null,
          source: search.source || 'rurubu' // Add source field (rurubu or searchbox)
        });
      });
    });

    // Sort
    if (sort_by === 'rating') {
      allPOIs.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sort_by === 'name') {
      allPOIs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    // Limit results
    const total = allPOIs.length;
    const results = allPOIs.slice(0, cappedLimit);

    const response = {
      pois: results,
      count: results.length,
      total_available: total,
      filters_applied: {
        category,
        min_rating,
        search_text,
        sort_by,
        limit: cappedLimit
      }
    };

    // Add message if results were capped
    if (total > cappedLimit) {
      response.message = `Showing top ${cappedLimit} POIs (sorted by ${sort_by}). ${total - cappedLimit} more available. Use filters (category, min_rating, search_text, open_after) to narrow results instead of increasing limit.`;
    }

    return response;
  }

  /**
   * Get full details for specific POIs by ID
   * @param {Array<string>} ids - POI IDs to fetch
   * @returns {Object} Full POI details
   */
  getPOIDetails(ids = []) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return {
        pois: [],
        count: 0,
        message: 'No POI IDs provided'
      };
    }

    const detailedPOIs = [];
    const idsSet = new Set(ids);

    // Search through ALL searches in history (not just visible ones)
    // This allows get_poi_details to work even when layers aren't displayed on map
    this.searchHistory.forEach((search, searchId) => {
      if (!search || !search.geojson) {
        return;
      }

      search.geojson.features.forEach((feature, idx) => {
        const props = feature.properties;

        // Check if this POI is in the requested IDs
        // Convert to string for comparison (IDs come as strings from Claude, stored as numbers)
        const idStr = String(props.id);
        if (idsSet.has(idStr)) {
          const [lng, lat] = feature.geometry.coordinates;

          // Return FULL details
          detailedPOIs.push({
            id: idStr, // Use string version for consistency
            name: props.name || 'Unknown',
            kana: props.kana || null,
            address: props.address || null,
            category: search.category,
            coordinates: [lng, lat],
            rating: props.rank || props.rating || null,
            time: props.time || null,
            tel: props.tel || null,
            price: props.price || null,
            summary: props.summary || null,
            genre: props.sgenreName || null,
            photo: props.photo || null,
            photos: props.photos || [],
            lgenre: props.lgenre || null,
            mgenre: props.mgenre || null,
            sgenre: props.sgenre || null
          });

          // Remove from set once found (use string version)
          idsSet.delete(idStr);
        }
      });
    });

    return {
      pois: detailedPOIs,
      count: detailedPOIs.length,
      requested: ids.length,
      not_found: Array.from(idsSet)
    };
  }

  /**
   * Validate photo URL to prevent security issues
   * Only allows trusted domains and HTTPS protocol
   * @param {string} url - The URL to validate
   * @returns {boolean} - True if URL is valid and safe
   */
  validatePhotoUrl(url) {
    if (!url || typeof url !== 'string') return false;

    try {
      const parsedUrl = new URL(url);

      // Only allow HTTPS protocol (no http, data:, javascript:, etc.)
      if (parsedUrl.protocol !== 'https:') {
        return false;
      }

      // Whitelist of trusted domains for photo URLs
      const trustedDomains = [
        'www.j-jti.com',           // Rurubu API
        'api.mapbox.com',           // Mapbox
        'images.unsplash.com',      // Unsplash (if used)
        'cdn.jsdelivr.net',         // CDN for libraries
        'static-assets.mapbox.com'  // Mapbox static assets
      ];

      // Check if hostname matches any trusted domain
      const isValidDomain = trustedDomains.some(domain =>
        parsedUrl.hostname === domain ||
        parsedUrl.hostname.endsWith('.' + domain)
      );

      return isValidDomain;
    } catch (error) {
      // Invalid URL format
      errorLogger.warn('URL Validation', 'Failed to parse photo URL', { url, error: error.message });
      return false;
    }
  }

  /**
   * Sanitize external data (e.g., POI data from APIs) for safe display
   * Strips all HTML and potentially dangerous content
   * @param {string} data - Data from external source
   * @returns {string} Sanitized plain text
   */
  sanitizeExternalData(data) {
    if (!data || typeof data !== 'string') return '';

    // Use DOMPurify to strip all HTML, keeping only plain text
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(data, {
        ALLOWED_TAGS: [], // Strip all HTML tags
        ALLOWED_ATTR: [], // Strip all attributes
        KEEP_CONTENT: true, // Keep text content
        ALLOW_DATA_ATTR: false,
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false
      });
    }

    // Fallback: escape HTML entities
    return this.escapeHtml(data);
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
   * Set field visibility in POI modal (shows/hides field and its label)
   * Reusable helper to avoid code duplication
   * @param {string} fieldId - ID of the field element
   * @param {string} value - Value to display (empty/null hides the field)
   */
  setPoiFieldVisibility(fieldId, value) {
    const dd = document.getElementById(fieldId);
    if (!dd) return;

    const dt = dd.previousElementSibling; // Get the <dt> label before the <dd>

    if (value) {
      dd.textContent = value;
      dd.style.display = '';
      if (dt) dt.style.display = '';
    } else {
      dd.style.display = 'none';
      if (dt) dt.style.display = 'none';
    }
  }

  /**
   * Populate POI modal fields with data
   * Centralized method to avoid duplication
   * @param {Object} data - POI data object with properties
   */
  populatePoiFields(data) {
    const { name, address, phone, hours, rating, price } = data;

    // Set name
    const nameElement = document.getElementById('poiName');
    if (nameElement) {
      nameElement.textContent = name || 'Unknown';
    }

    // Set other fields with visibility handling
    this.setPoiFieldVisibility('poiAddress', address);
    this.setPoiFieldVisibility('poiPhone', phone);
    this.setPoiFieldVisibility('poiHours', hours);
    this.setPoiFieldVisibility('poiRating', rating);
    this.setPoiFieldVisibility('poiPrice', price);
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
   * Uses LRU cache to avoid redundant translations
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
        return properties;
      }

      // Check cache first (use POI ID or name as key)
      const cacheKey = properties.id || fieldsToTranslate.name;
      if (this.translationCache.has(cacheKey)) {
        // Move to end (LRU: mark as recently used)
        const cached = this.translationCache.get(cacheKey);
        this.translationCache.delete(cacheKey);
        this.translationCache.set(cacheKey, cached);
        return { ...properties, ...cached };
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
          errorLogger.warn('POI Translation', 'Empty response from translation service', {
            poiName: properties.title || properties.name
          });
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

        // Store in cache with LRU eviction
        const cacheKey = properties.id || fieldsToTranslate.name;

        // Evict oldest entry if cache is full
        if (this.translationCache.size >= this.MAX_TRANSLATION_CACHE_SIZE) {
          const firstKey = this.translationCache.keys().next().value;
          this.translationCache.delete(firstKey);
        }

        // Store only the translated fields (not the full properties object)
        this.translationCache.set(cacheKey, {
          name: translated.name,
          title: translated.title,
          address: translated.address,
          summary: translated.summary,
          time: translated.time,
          price: translated.price,
          rank: translated.rank
        });

        return translated;
      } finally {
        // Always restore the conversation history
        this.claudeClient.conversationHistory = savedHistory;
      }

    } catch (error) {
      errorLogger.log('POI Translation', error, { poiName: properties.title || properties.name });
      // Return original properties if translation fails
      return properties;
    }
  }

  /**
   * Show POI details modal with null safety and comprehensive error handling
   */
  async showPoiModal(properties) {
    try {
      // Validate properties
      if (!properties || typeof properties !== 'object') {
        errorLogger.warn('POI Modal', 'Invalid properties provided to showPoiModal', { properties });
        return;
      }

      // Get modal with null check
      const modal = safeGetElement('poiModal');
      if (!modal) {
        errorLogger.warn('POI Modal', 'POI modal element not found in DOM');
        return;
      }

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

      if (nameKey) {
        let lookupKey = null;

        // Try exact match first
        if (this.poiDataStore.has(nameKey)) {
          lookupKey = nameKey;
          fullData = this.poiDataStore.get(nameKey);
        }

        // If not found and name has English in parentheses, try without it
        if (!fullData && nameKey.includes('(')) {
          const japaneseOnly = nameKey.replace(/\s*\([^)]*\)\s*$/, '').trim();
          if (this.poiDataStore.has(japaneseOnly)) {
            lookupKey = japaneseOnly;
            fullData = this.poiDataStore.get(japaneseOnly);
          }
        }

        if (fullData && lookupKey) {
          // LRU: Move accessed item to end by deleting and re-adding
          this.poiDataStore.delete(lookupKey);
          this.poiDataStore.set(lookupKey, fullData);

          // Merge full data with properties (full data takes precedence)
          properties = { ...properties, ...fullData };
        }
      }

      // Update POI modal labels based on current language
      this.updatePoiModalLabels();

      // Translate to English if language is set to English
      if (this.i18n.isEnglish()) {
        try {
          properties = await this.translatePoiData(properties);
        } catch (error) {
          errorLogger.warn('POI Modal', 'Translation failed, using original data', {
            poiName: properties.title || properties.name,
            error: error.message
          });
          // Continue with original properties if translation fails
        }
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
      // Sanitize all external POI data as defense in depth (even though textContent is safe)
      const description = this.sanitizeExternalData(properties.summary || '');
      const phone = this.sanitizeExternalData(properties.tel || '');
      const hours = this.sanitizeExternalData(properties.time || '');
      const rating = this.sanitizeExternalData(properties.rank || '');
      const price = this.sanitizeExternalData(properties.price || '');
      const address = this.sanitizeExternalData(properties.address || '');
      name = this.sanitizeExternalData(name);

      // Populate modal fields using centralized method
      this.populatePoiFields({
        name,
        address,
        phone,
        hours,
        rating,
        price
      });

      // Handle photo with error handling
      const photoDiv = document.getElementById('poiPhoto');
      const photoImg = document.getElementById('poiPhotoImg');
      if (properties.photo) {
        // Validate photo URL before using
        const isValidUrl = this.validatePhotoUrl(properties.photo);

        if (isValidUrl) {
          // Reset any previous error handlers
          photoImg.onerror = null;
          photoImg.onload = null;

          // Set up error handler before setting src
          photoImg.onerror = () => {
            errorLogger.warn('POI Modal', 'Failed to load photo', {
              poiName: properties.title || properties.name,
              photoUrl: properties.photo
            });
            photoDiv.style.display = 'none';
          };

          // Show photo on successful load
          photoImg.onload = () => {
            photoDiv.style.display = 'block';
          };

          photoImg.src = properties.photo;
        } else {
          errorLogger.warn('POI Modal', 'Invalid photo URL blocked', {
            poiName: properties.title || properties.name,
            photoUrl: properties.photo
          });
          photoDiv.style.display = 'none';
        }
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
    } catch (error) {
      errorLogger.log('POI Modal', error, {
        poiName: properties?.title || properties?.name || 'unknown'
      });

      // Clean up loading overlay on error
      const loadingOverlay = document.getElementById('poiLoadingOverlay');
      if (loadingOverlay) {
        loadingOverlay.remove();
      }

      // Hide modal on error
      const modal = document.getElementById('poiModal');
      if (modal) {
        modal.style.display = 'none';
      }

      // Show user-friendly error message
      this.showError(
        this.i18n.t('errors.error'),
        this.i18n.t('errors.unknown')
      );
    }
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

    // Clean up photo event handlers to prevent memory leaks
    const photoImg = document.getElementById('poiPhotoImg');
    if (photoImg) {
      photoImg.onerror = null;
      photoImg.onload = null;
    }

    document.getElementById('poiModal').style.display = 'none';
  }

  /**
   * Override to add Japan-specific clearing
   * Clears AI conversation, map layers/markers, and Japan-specific data
   */
  async onClearConversation() {
    // Clear AI conversation history and update token counter
    await super.onClearConversation();

    // Clear all POI searches and layers from map
    await this.clearAllSearches();

    // Clear map markers, routes, and star markers
    if (this.mapController) {
      this.mapController.clearAllMarkers();
      this.mapController.clearAllRoutes();
      this.mapController.clearStarMarkers(); // Clear recommended POI stars
    }

    // Clear Japan-specific data stores
    this.poiDataStore.clear();
    this.translationCache.clear();
  }

  /**
   * Get search history tools for Claude
   * Returns tool definitions for managing POI search history
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
      },
      {
        name: 'get_poi_summary',
        description: 'Get a lightweight summary list of stored POIs (across all searches). Returns: id, name, category, genre, rating, price, time, coordinates, source. The "source" field indicates "rurubu" (tourism POIs with full data) or "searchbox" (infrastructure with basic data). Defaults to top 100 POIs sorted by rating. Use filters (category, min_rating, search_text, open_after) to narrow results. If total_available > count in response, use filters instead of increasing limit to avoid token overflow.',
        input_schema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Filter by category: eat, see, play, buy, cafe, onsen, nightlife, other. If null, returns all categories.',
              enum: ['eat', 'see', 'play', 'buy', 'cafe', 'onsen', 'nightlife', 'other']
            },
            min_rating: {
              type: 'number',
              description: 'Minimum rating filter (0-5). Only return POIs with rating >= this value.'
            },
            search_text: {
              type: 'string',
              description: 'Text search query. Searches in POI name, genre, and address. Case-insensitive partial matching.'
            },
            open_after: {
              type: 'string',
              description: 'Filter POIs open after this time (e.g., "21:00" for 9pm). Uses best-effort parsing of time strings. Handles formats like "9:00-21:00", "24時間営業", etc. POIs with unparseable time strings are included (to be safe).',
              pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
            },
            sort_by: {
              type: 'string',
              description: 'Sort results by: "rating" (highest first) or "name" (alphabetical)',
              enum: ['rating', 'name'],
              default: 'rating'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return. Default: 100, Max: 200. Use filters (category, min_rating, search_text) to narrow results instead of requesting all POIs.',
              default: 100,
              maximum: 200
            }
          },
          required: []
        }
      },
      {
        name: 'get_poi_details',
        description: 'Get FULL details for specific POIs by their IDs. Returns tel, address, summary, photos, hours, price, coordinates - everything. Use this AFTER get_poi_summary to get complete information for POIs you want to mention or recommend. Only fetches POIs you explicitly request by ID.',
        input_schema: {
          type: 'object',
          properties: {
            ids: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of POI IDs to fetch details for (e.g., ["12345", "67890"]). Get these IDs from get_poi_summary results.'
            }
          },
          required: ['ids']
        }
      }
    ];
  }

  /**
   * Execute search history tools
   * Handles all POI search history management operations
   */
  async executeSearchHistoryTool(toolName, args) {
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
          await this.showSearchResults(args.search_id);
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
          await this.clearAllSearches();
          return {
            content: [{
              type: 'text',
              text: 'All searches have been cleared from history and map'
            }]
          };
        }

        case 'get_poi_summary': {
          const summary = this.getPOISummary(args);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(summary, null, 2)
            }]
          };
        }

        case 'get_poi_details': {
          const details = this.getPOIDetails(args.ids);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(details, null, 2)
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
   * Override cleanup to add Japan-specific cleanup
   */
  async cleanup() {
    // Call parent cleanup
    await super.cleanup();

    // Japan-specific cleanup
    if (this.rurubuMCP) {
      await this.rurubuMCP.cleanup();
    }

    if (this.mapViewUpdateTimer) {
      clearTimeout(this.mapViewUpdateTimer);
    }
  }
}

// Initialize application
window.app = new JapanDayTripApp();
window.app.initialize();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.app) {
    window.app.cleanup();
  }
});
