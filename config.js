/**
 * Configuration for Japan Day Trip MCP Demo
 *
 * IMPORTANT: Replace the placeholder values with your actual API keys
 *
 * To get API keys:
 * - Claude API: https://console.anthropic.com/
 * - Mapbox Token: https://account.mapbox.com/access-tokens/
 */

export const CONFIG = {
  // ============================================
  // API KEYS - REPLACE THESE WITH YOUR OWN
  // ============================================

  // Mapbox Access Token (required for map)
  // Get yours at: https://account.mapbox.com/access-tokens/
  MAPBOX_ACCESS_TOKEN: 'pk.eyJ1Ijoia2Vuamktc2hpbWEiLCJhIjoiY2xpd2RwaHhzMGJoYjNlbnduYjJmMm5xNyJ9.Zi2lDBa9rXEAj6KyhLrINA',

  // ============================================
  // RURUBU API (Japan Tourism POIs)
  // ============================================

  // Rurubu API configuration (public API)
  RURUBU_APP_ID: 'n2xNzqos7NirxGBJ',
  RURUBU_ENDPOINT: 'https://www.j-jti.com/appif/sight',
  RURUBU_IMAGE_BASE_URL: 'https://www.j-jti.com/Storage/Image/Product/SightImage/M/',

  // ============================================
  // AI PROVIDER SETTINGS
  // ============================================

  // AI provider: 'claude' or 'gemini'
  AI_PROVIDER: 'claude',

  // ============================================
  // CLAUDE SETTINGS
  // ============================================

  // AI API proxy endpoint (Lambda supports both Claude & Gemini)
  CLAUDE_API_PROXY: 'https://okqfpyxf4oe6htegrlcgrwdssa0yoxcr.lambda-url.us-east-1.on.aws/',

  // Claude model to use
  CLAUDE_MODEL: 'claude-haiku-4-5-20251001',

  // ============================================
  // GEMINI SETTINGS
  // ============================================

  // Gemini model to use
  GEMINI_MODEL: 'gemini-3-flash-preview',

  // ============================================
  // SHARED AI SETTINGS
  // ============================================

  // Maximum tokens for AI responses
  MAX_TOKENS: 4096,

  // Temperature for response generation (0-1)
  TEMPERATURE: 0.7,

  // ============================================
  // MAP SETTINGS
  // ============================================

  // Default map center (Tokyo, Japan)
  DEFAULT_MAP_CENTER: [139.7671, 35.6812],

  // Default map zoom level
  DEFAULT_MAP_ZOOM: 11,

  // Map style
  MAP_STYLE: 'mapbox://styles/mapbox/streets-v12',

  // ============================================
  // APPLICATION SETTINGS
  // ============================================

  // Maximum results per category search
  MAX_RESULTS_PER_CATEGORY: 50,

  // Maximum chat history to display
  MAX_CHAT_HISTORY: 50,

  // Default language ('en' or 'ja')
  DEFAULT_LANGUAGE: 'ja',

  // Enable debug logging
  DEBUG: true,
};

/**
 * Validate configuration
 * @returns {boolean} True if config is valid
 */
export function validateConfig() {
  const errors = [];

  // Check Mapbox access token
  if (!CONFIG.MAPBOX_ACCESS_TOKEN || CONFIG.MAPBOX_ACCESS_TOKEN.startsWith('YOUR_')) {
    errors.push('❌ Mapbox access token not set');
  }

  // Check Lambda proxy endpoint
  if (!CONFIG.CLAUDE_API_PROXY) {
    errors.push('❌ Claude API proxy endpoint not set');
  }

  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(error => console.error(error));
    console.error('\n📝 Please update config.js:');
    console.error('   - Mapbox Token: https://account.mapbox.com/access-tokens/');
    console.error('   - Lambda Proxy: Configure CLAUDE_API_PROXY endpoint');
    return false;
  }

  if (CONFIG.DEBUG) {
    console.log('✓ Configuration validated successfully');
  }

  return true;
}
