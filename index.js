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
import { safeGet, safeGetElement, safeCoordinates, safeArray } from './modules/utils.js';
import { errorLogger } from './modules/error-logger.js';

/**
 * Async error handling wrapper
 * Wraps async functions to provide consistent error handling
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Options for error handling
 * @returns {Function} Wrapped function
 */
function asyncErrorWrapper(fn, options = {}) {
  const {
    context = 'Unknown',
    fallback = null,
    logError = true,
    rethrow = false
  } = options;

  return async function(...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      if (logError) {
        errorLogger.log(context, error, { args });
      }

      if (rethrow) {
        throw error;
      }

      return fallback;
    }
  };
}

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
    // Maps POI name to full feature properties with LRU eviction
    this.poiDataStore = new Map();
    this.MAX_POI_DATA_STORE_SIZE = this.config.MAX_POI_DATA_STORE_SIZE;

    // Search history management
    this.searchHistory = new Map(); // Map<searchId, SearchResult>
    this.searchIdCounter = 0; // Counter for generating unique search IDs
    this.visibleSearchIds = new Set(); // Set of currently visible search IDs

    // User location for context-aware queries
    this.userLocation = null;

    // Debounce timer for map view updates
    this.mapViewUpdateTimer = null;

    // Rate limiting (Token Bucket Algorithm)
    this.lastRequestTime = 0;
    this.MIN_REQUEST_INTERVAL = this.config.REQUEST_RATE_LIMIT_MS;
    this.rateLimitTokens = this.config.RATE_LIMIT_BURST_CAPACITY;
    this.MAX_RATE_LIMIT_TOKENS = this.config.RATE_LIMIT_BURST_CAPACITY;
    this.RATE_LIMIT_REFILL_RATE = this.config.RATE_LIMIT_REFILL_RATE;
    this.lastRefillTime = Date.now();

    // Input validation
    this.MAX_INPUT_LENGTH = this.config.MAX_INPUT_LENGTH;

    // Translation cache
    this.translationCache = new Map();
    this.MAX_TRANSLATION_CACHE_SIZE = this.config.MAX_TRANSLATION_CACHE_SIZE;

    // Request queue for handling race conditions
    this.requestQueue = [];
    this.activeRequest = null;
    this.isClearing = false; // Flag to prevent race conditions during clear

    // Store event handler references for cleanup
    this.eventHandlers = {};
    this.mapEventHandlers = {};

    // AbortController for automatic event cleanup
    this.abortController = new AbortController();
  }

  /**
   * Initialize the application
   */
  async initialize() {
    try {
      // Validate configuration
      if (!validateConfig()) {
        this.showConfigError();
        return;
      }

      // Show welcome message
      this.addSystemMessage(this.i18n.t('system.welcome'));

      // Initialize Rurubu MCP (client-side)
      this.rurubuMCP = new RurubuMCPClient(this.config, this); // Pass app reference
      await this.rurubuMCP.initialize();

      // Initialize Map Controller
      this.mapController = new MapController(this.config, this); // Pass app reference
      await this.mapController.initialize('map');

      // Set initial map language
      this.mapController.setMapLanguage(this.i18n.getCurrentLanguage());

      // Setup POI marker click handler
      this.mapController.onMarkerClick(async (properties) => {
        await this.showPoiModal(properties);
      });

      // Setup map move handler to update Claude's context
      this.mapEventHandlers.moveend = () => {
        this.updateClaudeMapContext();
      };
      this.mapController.map.on('moveend', this.mapEventHandlers.moveend);

      // Initialize AI Client (Claude or Gemini)
      if (this.config.AI_PROVIDER === 'gemini') {
        this.claudeClient = new GeminiClient(
          this.config.GEMINI_API_KEY,
          this.rurubuMCP,
          this.mapController,
          this.i18n,
          this.config
        );
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
      }

      // Setup event listeners
      this.setupEventListeners();

      // Update UI with translations
      this.updateUI();

      // Initialize token counter display
      this.updateTokenCounter();

      // Auto-show user location or Tokyo Station
      await this.showUserLocationAuto();

      // Update Claude with initial map view
      this.updateClaudeMapContext();

      // Setup global error handlers
      this.setupGlobalErrorHandlers();

    } catch (error) {
      errorLogger.log('App Initialization', error, { step: 'initialize' });
      this.showError('Initialization Error', error.message);
      this.addSystemMessage(this.i18n.t('system.initError'));
    }
  }

  /**
   * Setup global error handlers for unhandled errors
   */
  setupGlobalErrorHandlers() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      errorLogger.log('Unhandled Promise Rejection', event.reason, {
        promise: event.promise
      });

      // Prevent default console error
      event.preventDefault();

      // Show user-friendly error for critical failures
      if (event.reason && event.reason.message) {
        const message = event.reason.message;

        // Only show modal for significant errors
        if (message.includes('API') || message.includes('network') || message.includes('fetch')) {
          this.showError(
            'Unexpected Error',
            'An unexpected error occurred. Please try again.'
          );
        }
      }
    });

    // Handle general JavaScript errors
    window.addEventListener('error', (event) => {
      // Skip errors from external scripts (CDN, Mapbox, etc.)
      if (event.filename && (
        event.filename.includes('mapbox') ||
        event.filename.includes('cdn.') ||
        event.filename.includes('unpkg')
      )) {
        return;
      }

      errorLogger.log('Uncaught Error', event.error || event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });

      // Don't show modal for every error, only log it
      console.error('[Global Error Handler]', event.error || event.message);
    });
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Store handler references for cleanup
    this.eventHandlers.sendBtn = () => {
      this.handleUserInput();
    };

    this.eventHandlers.chatInputKeypress = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleUserInput();
      }
    };

    this.eventHandlers.langToggle = () => {
      this.toggleLanguage();
    };

    this.eventHandlers.clearChatBtn = () => {
      this.clearConversation();
    };

    this.eventHandlers.closePoiModal = () => {
      this.hidePoiModal();
    };

    this.eventHandlers.poiModalBackdrop = (e) => {
      if (e.target.id === 'poiModal') {
        this.hidePoiModal();
      }
    };

    this.eventHandlers.closeErrorModal = () => {
      this.hideError();
    };

    this.eventHandlers.errorModalBackdrop = (e) => {
      if (e.target.id === 'errorModal') {
        this.hideError();
      }
    };

    // Attach event listeners with AbortController for automatic cleanup
    const signal = this.abortController.signal;

    document.getElementById('sendBtn').addEventListener('click', this.eventHandlers.sendBtn, { signal });
    document.getElementById('chatInput').addEventListener('keypress', this.eventHandlers.chatInputKeypress, { signal });
    document.getElementById('lang-toggle').addEventListener('click', this.eventHandlers.langToggle, { signal });
    document.getElementById('clearChatBtn').addEventListener('click', this.eventHandlers.clearChatBtn, { signal });
    document.getElementById('closePoiModal').addEventListener('click', this.eventHandlers.closePoiModal, { signal });
    document.getElementById('poiModal').addEventListener('click', this.eventHandlers.poiModalBackdrop, { signal });
    document.getElementById('closeErrorModal').addEventListener('click', this.eventHandlers.closeErrorModal, { signal });
    document.getElementById('errorModal').addEventListener('click', this.eventHandlers.errorModalBackdrop, { signal });
  }

  /**
   * Refill rate limit tokens based on time elapsed (Token Bucket Algorithm)
   */
  refillRateLimitTokens() {
    const now = Date.now();
    const timeSinceRefill = now - this.lastRefillTime;
    const tokensToAdd = Math.floor(timeSinceRefill / this.RATE_LIMIT_REFILL_RATE);

    if (tokensToAdd > 0) {
      this.rateLimitTokens = Math.min(
        this.MAX_RATE_LIMIT_TOKENS,
        this.rateLimitTokens + tokensToAdd
      );
      this.lastRefillTime = now;
    }
  }

  /**
   * Check if request is allowed under rate limit
   * @returns {Object} { allowed: boolean, tokensRemaining: number, retryAfter: number }
   */
  checkRateLimit() {
    this.refillRateLimitTokens();

    if (this.rateLimitTokens >= 1) {
      return { allowed: true, tokensRemaining: this.rateLimitTokens - 1 };
    }

    // Calculate retry time
    const retryAfter = this.RATE_LIMIT_REFILL_RATE;
    return { allowed: false, tokensRemaining: 0, retryAfter };
  }

  /**
   * Handle user input from text field with validation and rate limiting
   */
  async handleUserInput() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    // Basic validation
    if (!message) return;

    // Check if clearing is in progress
    if (this.isClearing) {
      return;
    }

    // Length validation
    if (message.length > this.MAX_INPUT_LENGTH) {
      this.showError(
        this.i18n.t('errors.inputTooLong'),
        this.i18n.t('errors.inputTooLongMessage', {
          limit: this.MAX_INPUT_LENGTH,
          current: message.length
        })
      );
      return;
    }

    // Check if already processing
    if (this.isProcessing) {
      return;
    }

    // Token Bucket Rate Limiting
    const rateLimitCheck = this.checkRateLimit();
    if (!rateLimitCheck.allowed) {
      this.showError(
        this.i18n.t('errors.rateLimitError'),
        this.i18n.t('errors.rateLimitMessage') + ` (Retry in ${Math.ceil(rateLimitCheck.retryAfter / 1000)}s)`
      );
      return;
    }

    // Consume a token
    this.rateLimitTokens = rateLimitCheck.tokensRemaining;

    // Sanitize input
    const sanitized = this.sanitizeUserInput(message);

    // Clear input and update timestamp
    input.value = '';
    this.lastRequestTime = Date.now();

    // Add to queue and process
    this.requestQueue.push(sanitized);

    // Process queue if not already processing
    if (!this.activeRequest) {
      await this.processRequestQueue();
    }
  }

  /**
   * Process request queue sequentially to prevent race conditions
   */
  async processRequestQueue() {
    while (this.requestQueue.length > 0) {
      const message = this.requestQueue.shift();

      try {
        this.activeRequest = this.processUserMessage(message);
        await this.activeRequest;
      } catch (error) {
        errorLogger.log('Request Queue', error, { message: message.substring(0, 50) });

        // Check if it's a Claude API error
        const errorMsg = error?.message || String(error) || '';
        const isClaudeError = errorMsg.includes('400') ||
                             errorMsg.includes('token') ||
                             errorMsg.includes('too large') ||
                             errorMsg.includes('context length') ||
                             errorMsg.includes('invalid_request_error');

        if (isClaudeError) {
          this.addSystemMessage(this.i18n.t('errors.tooMuchInfoMessage'));
          this.showTokenOverflowError();
        } else {
          this.addSystemMessage(`${this.i18n.t('status.error')}: ${errorMsg}`);
        }
      } finally {
        this.activeRequest = null;
      }
    }
  }

  /**
   * Sanitize user input to prevent injection attacks
   * Uses DOMPurify for comprehensive XSS protection
   */
  sanitizeUserInput(input) {
    if (!input) return '';

    // First apply length limit
    let sanitized = input.substring(0, this.MAX_INPUT_LENGTH);

    // Use DOMPurify to strip all HTML/script content while preserving plain text
    // This is more secure than regex-based blacklisting
    if (typeof DOMPurify !== 'undefined') {
      // ALLOWED_TAGS: [] means strip all HTML tags, leaving only text
      sanitized = DOMPurify.sanitize(sanitized, {
        ALLOWED_TAGS: [], // No HTML tags allowed
        ALLOWED_ATTR: [], // No attributes allowed
        KEEP_CONTENT: true, // Preserve text content
        ALLOW_DATA_ATTR: false
      });
    } else {
      // Fallback: more aggressive character filtering
      sanitized = sanitized
        .replace(/[<>]/g, '') // Remove angle brackets
        .replace(/javascript:/gi, '') // Remove javascript protocol
        .replace(/data:/gi, '') // Remove data URIs
        .replace(/vbscript:/gi, '') // Remove vbscript
        .replace(/on\w+\s*=/gi, ''); // Remove event handlers
    }

    return sanitized.trim();
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
      errorLogger.log('Message Processing', error);

      // Check if it's a Claude API error (400, token overflow, etc.)
      const errorMsg = error?.message || String(error) || '';
      const isClaudeError = errorMsg.includes('400') ||
                           errorMsg.includes('token') ||
                           errorMsg.includes('too large') ||
                           errorMsg.includes('context length') ||
                           errorMsg.includes('invalid_request_error');

      if (isClaudeError) {
        // Show user-friendly message and modal
        this.addSystemMessage(this.i18n.t('errors.tooMuchInfoMessage'));
        this.showTokenOverflowError();
      } else {
        this.addSystemMessage(`${this.i18n.t('status.error')}: ${errorMsg}`);
        this.showError('Processing Error', errorMsg);
      }
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

    // Rebuild Claude system prompt with new language
    if (this.claudeClient) {
      this.claudeClient.systemPrompt = this.claudeClient.buildSystemPrompt(
        this.claudeClient.userLocation,
        this.claudeClient.mapView
      );
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
   * Format response text (markdown-like) with XSS protection
   */
  formatResponse(text) {
    if (!text) return '';

    // Convert markdown to HTML
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');

    // Sanitize with DOMPurify to prevent XSS
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(formatted, {
        ALLOWED_TAGS: ['strong', 'em', 'code', 'br', 'p', 'ul', 'ol', 'li', 'span', 'div'],
        ALLOWED_ATTR: ['class'], // Removed 'style' to prevent CSS-based XSS attacks
        ALLOW_DATA_ATTR: false,
        FORBID_ATTR: ['style'], // Explicitly forbid style attribute
        FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed'] // Forbid dangerous tags
      });
    }

    // Fallback if DOMPurify not loaded (shouldn't happen)
    return this.escapeHtml(formatted);
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
    } else if (tokenUsage.percentage >= 50) {
      tokenCounterDiv.classList.add('warning');
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
   * Update Claude's context with current map view
   * Includes reverse geocoding to get human-readable location
   * Debounced to avoid excessive API calls during map movement
   */
  updateClaudeMapContext() {
    if (!this.claudeClient || !this.mapController || !this.mapController.map) {
      errorLogger.warn('Map Context Update', 'Missing dependencies for map context update', {
        hasClaudeClient: !!this.claudeClient,
        hasMapController: !!this.mapController,
        hasMap: !!this.mapController?.map
      });
      return;
    }

    // Clear any pending update
    if (this.mapViewUpdateTimer) {
      clearTimeout(this.mapViewUpdateTimer);
      this.mapViewUpdateTimer = null;
    }

    const debounceMs = this.config.DEBOUNCE_MAP_UPDATE_MS || 500;

    // Debounce: wait for map to stop moving
    this.mapViewUpdateTimer = setTimeout(async () => {
      try {
        const center = this.mapController.map.getCenter();
        const zoom = this.mapController.map.getZoom();
        const bounds = this.mapController.getBounds();

        if (center && zoom && bounds) {
          const mapView = {
            center: { lat: center.lat, lng: center.lng },
            zoom: zoom,
            bounds: bounds
          };

          // Reverse geocode the map center to get human-readable location
          try {
            const geocodeResult = await reverseGeocode(
              center.lng,
              center.lat,
              this.config.MAPBOX_ACCESS_TOKEN
            );

            if (geocodeResult) {
              const props = geocodeResult.properties || {};
              mapView.placeName = props.place_formatted || props.full_address || props.name;
              mapView.name = props.name;
              mapView.address = props.full_address;
            }
          } catch (error) {
            errorLogger.warn('Map Context Update', 'Failed to reverse geocode map center', { error: error.message });
            // Continue without place name if geocoding fails
          }

          this.claudeClient.updateMapView(mapView);
        }
      } catch (error) {
        errorLogger.log('Map Context Update', error);
      } finally {
        this.mapViewUpdateTimer = null; // Clear reference
      }
    }, debounceMs);
  }

  /**
   * Check if coordinates are within Japan's bounding box
   * (Uses the same bounds as the map's maxBounds)
   * @param {number} longitude
   * @param {number} latitude
   * @returns {boolean}
   */
  isLocationInJapan(longitude, latitude) {
    // Japan's bounding box (matches map maxBounds: [[122, 24], [154, 46]])
    // Southwest corner: [122°E, 24°N], Northeast corner: [154°E, 46°N]
    const JAPAN_BOUNDS = {
      west: 122,
      south: 24,
      east: 154,
      north: 46
    };

    return (
      latitude >= JAPAN_BOUNDS.south &&
      latitude <= JAPAN_BOUNDS.north &&
      longitude >= JAPAN_BOUNDS.west &&
      longitude <= JAPAN_BOUNDS.east
    );
  }

  /**
   * Show user location automatically on map load
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
   * Clear conversation with atomic operations to prevent race conditions
   */
  async clearConversation() {
    // Prevent multiple simultaneous clear operations
    if (this.isClearing) {
      console.log('[Debug] Clear already in progress, ignoring duplicate request');
      return;
    }

    // Set flag to prevent new requests during clearing
    this.isClearing = true;

    try {
      // Wait for request queue to drain
      // This ensures we don't clear while requests are being processed
      while (this.requestQueue.length > 0 || this.activeRequest) {
        console.log('[Debug] Waiting for queue to drain:', {
          queueLength: this.requestQueue.length,
          hasActiveRequest: !!this.activeRequest
        });

        if (this.activeRequest) {
          try {
            await this.activeRequest;
          } catch (error) {
            // Ignore errors from the active request we're about to clear anyway
          }
        }

        // Small delay to allow queue processing
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Clear any queued requests (atomically with clearing flag set)
      this.requestQueue = [];
      this.activeRequest = null;

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
    } finally {
      // Always unset the clearing flag
      this.isClearing = false;
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
  async storeRurubuData(geojson, metadata = {}) {
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
      console.error('[DEBUG showSearchResults] Search not found:', searchId);
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
    // Clear all map layers
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

    return locationGroups;
  }

  /**
   * Parse time string and extract closing time
   * Handles common Japanese time formats
   * @param {string} timeStr - Time string like "9:00-21:00" or "24時間営業"
   * @returns {Object|null} {closes_at: "21:00", is_24h: boolean} or null if unparseable
   */
  parseTimeString(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;

    const str = timeStr.trim();

    // Check for 24-hour places
    if (str.includes('24時間') || str.includes('24h') || str.includes('24H')) {
      return { closes_at: '24:00', is_24h: true };
    }

    // Try to extract closing time from common formats
    // Formats: "9:00-21:00", "9:00~21:00", "9時-21時", "11:00~14:00, 17:00~22:00"

    // Match HH:MM-HH:MM or HH:MM~HH:MM
    const match1 = str.match(/(\d{1,2}):(\d{2})\s*[-~～]\s*(\d{1,2}):(\d{2})/g);
    if (match1 && match1.length > 0) {
      // Get the last time range (handles lunch/dinner splits)
      const lastRange = match1[match1.length - 1];
      const parts = lastRange.match(/(\d{1,2}):(\d{2})\s*[-~～]\s*(\d{1,2}):(\d{2})/);
      if (parts && parts.length >= 5 && parts[3] && parts[4]) {
        const closeHour = parts[3].padStart(2, '0');
        const closeMin = parts[4];
        return { closes_at: `${closeHour}:${closeMin}`, is_24h: false };
      }
    }

    // Match Japanese format: "9時-21時"
    const match2 = str.match(/(\d{1,2})時\s*[-~～]\s*(\d{1,2})時/g);
    if (match2 && match2.length > 0) {
      const lastRange = match2[match2.length - 1];
      const parts = lastRange.match(/(\d{1,2})時\s*[-~～]\s*(\d{1,2})時/);
      if (parts && parts.length >= 3 && parts[2]) {
        const closeHour = parts[2].padStart(2, '0');
        return { closes_at: `${closeHour}:00`, is_24h: false };
      }
    }

    // Couldn't parse
    return null;
  }

  /**
   * Check if a place is open after a specific time
   * @param {string} timeStr - Time string from POI
   * @param {string} targetTime - Target time like "21:00"
   * @returns {boolean} True if open after target time (or unknown)
   */
  isOpenAfter(timeStr, targetTime) {
    const parsed = this.parseTimeString(timeStr);
    return this.isOpenAfterParsed(parsed, targetTime);
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
      open_after = null, // NEW: Filter by opening hours (e.g., "21:00")
      sort_by = 'rating', // rating | name
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

        // Log first 3 feature IDs for debugging
        if (idx < 3) {
        }

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
   * Execute a search history tool
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
   * Show token overflow error modal with Clear Chat button
   */
  showTokenOverflowError() {
    const modal = document.getElementById('errorModal');
    const modalBody = document.getElementById('errorMessage');
    const modalHeader = document.querySelector('#errorModal h3');
    const closeButton = document.getElementById('closeErrorModal');

    // Set title and message
    modalHeader.textContent = this.i18n.t('errors.tooMuchInfo');
    modalBody.textContent = this.i18n.t('errors.tooMuchInfoMessage');

    // Hide close button
    closeButton.style.display = 'none';

    // Add Clear Chat button if not already added
    let clearButton = document.getElementById('errorClearChatBtn');
    if (!clearButton) {
      clearButton = document.createElement('button');
      clearButton.id = 'errorClearChatBtn';
      clearButton.className = 'modal-btn';
      clearButton.style.marginTop = '20px';
      clearButton.style.padding = '10px 20px';
      clearButton.style.backgroundColor = '#ff6b35';
      clearButton.style.color = 'white';
      clearButton.style.border = 'none';
      clearButton.style.borderRadius = '8px';
      clearButton.style.cursor = 'pointer';
      clearButton.style.fontSize = '14px';
      clearButton.style.fontWeight = 'bold';

      // Store handler reference for cleanup
      this.eventHandlers.errorClearChatBtn = async () => {
        await this.clearConversation();
        this.hideTokenOverflowError();
      };

      clearButton.addEventListener('click', this.eventHandlers.errorClearChatBtn);

      modalBody.appendChild(clearButton);
    }

    clearButton.textContent = this.i18n.t('errors.clearChatButton');

    // Disable input
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    chatInput.disabled = true;
    sendBtn.disabled = true;
    chatInput.style.opacity = '0.5';
    sendBtn.style.opacity = '0.5';

    modal.style.display = 'flex';
  }

  /**
   * Hide token overflow error modal and re-enable input
   */
  hideTokenOverflowError() {
    const modal = document.getElementById('errorModal');
    const closeButton = document.getElementById('closeErrorModal');

    // Re-enable input
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatInput.style.opacity = '1';
    sendBtn.style.opacity = '1';

    // Show close button again
    closeButton.style.display = 'block';

    modal.style.display = 'none';
  }

  /**
   * Hide error modal
   */
  hideError() {
    document.getElementById('errorModal').style.display = 'none';
  }

  /**
   * Remove all event listeners to prevent memory leaks
   */
  removeEventListeners() {
    // Abort all event listeners registered with AbortController
    // This automatically removes all listeners that were registered with { signal }
    this.abortController.abort();

    // Create a new AbortController for future event listeners
    this.abortController = new AbortController();

    // Remove map event listeners (not using AbortController)
    if (this.mapController && this.mapController.map && this.mapEventHandlers.moveend) {
      this.mapController.map.off('moveend', this.mapEventHandlers.moveend);
    }

    // Clean up photo image event handlers (set via property assignment)
    const photoImg = document.getElementById('poiPhotoImg');
    if (photoImg) {
      photoImg.onerror = null;
      photoImg.onload = null;
    }

    // Clean up dynamically added error modal button handlers
    const errorClearChatBtn = document.getElementById('errorClearChatBtn');
    if (errorClearChatBtn && this.eventHandlers.errorClearChatBtn) {
      errorClearChatBtn.removeEventListener('click', this.eventHandlers.errorClearChatBtn);
    }

    // Clear handler references
    this.eventHandlers = {};
    this.mapEventHandlers = {};
  }

  /**
   * Cleanup method to prevent memory leaks
   * Call when app is being destroyed or page is unloading
   */
  async cleanup() {
    // Remove all event listeners first
    this.removeEventListeners();

    // Clear debounce timer
    if (this.mapViewUpdateTimer) {
      clearTimeout(this.mapViewUpdateTimer);
      this.mapViewUpdateTimer = null;
    }

    // Stop thinking simulator
    if (this.thinkingSimulator) {
      this.thinkingSimulator.stopThinking();
    }

    // Clear all searches and data
    await this.clearAllSearches();

    // Destroy map controller
    if (this.mapController) {
      this.mapController.destroy();
      this.mapController = null;
    }

    // Clear Claude client references
    if (this.claudeClient) {
      this.claudeClient.clearHistory();
      this.claudeClient = null;
    }

    // Clear Rurubu MCP
    this.rurubuMCP = null;

    // Clear caches
    this.translationCache.clear();
    this.poiDataStore.clear();
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new JapanDayTripApp();
  window.app.initialize();
});

// Cleanup on page unload to prevent memory leaks
window.addEventListener('beforeunload', () => {
  if (window.app) {
    window.app.cleanup();
  }
});
