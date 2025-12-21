/**
 * Internationalization (i18n) Module
 * Provides bilingual support for English and Japanese
 */

export class I18n {
  constructor(defaultLang = 'en') {
    this.currentLang = defaultLang;
    this.translations = {
      en: {
        // Header
        title: '🇯🇵 AI Travel Agent',
        subtitle: 'Discover places to eat, shop, play, and explore across Japan',

        // Language toggle
        langToggle: '日本語',

        // Input
        inputPlaceholder: 'Ask me about places in Japan... (e.g., "Find restaurants in Shibuya")',
        sendButton: 'Send',

        // Categories
        categories: {
          eat: '🍽️ Restaurants',
          buy: '🛍️ Shopping',
          enjoy: '🎪 Entertainment',
          see: '👁️ Sightseeing'
        },

        // Map controls
        clearMap: 'Clear Map',
        clearChat: 'Clear Chat',
        recenter: 'Recenter',

        // Status messages
        status: {
          initializing: 'Initializing...',
          loading: 'Loading...',
          processing: 'Processing your request...',
          searching: 'Searching for places...',
          callingMapbox: 'Querying Mapbox services...',
          callingRurubu: 'Searching Rurubu database...',
          visualizing: 'Updating map...',
          ready: 'Ready',
          error: 'Error occurred'
        },

        // System messages
        system: {
          welcome: `👋 Hello! I'm your Japan travel assistant powered by Claude and Mapbox, with POI data from Rurubu.

I can help you:
• Find restaurants, shops, and attractions across Japan
• Discover hidden gems and popular spots
• Plan day trips and create itineraries
• Get directions and routes between locations
• Show areas reachable within a certain time or distance
• Show everything on an interactive map

Try asking:
• "Find restaurants in Shibuya"
• "Show me temples in Kyoto"
• "What can I do in Harajuku?"
• "Plan a day trip in Asakusa"`,

          cleared: 'Conversation and map cleared',
          mapCleared: 'Map cleared',
          mapRecentered: 'Map recentered to your location',

          configError: `⚠️ Configuration Error

Please update your API keys in config.js:
• Claude API Key: Get from https://console.anthropic.com/
• Mapbox Access Token: Get from https://account.mapbox.com/access-tokens/

See README.md for setup instructions.`,

          initError: 'Failed to initialize application. Please refresh the page.'
        },

        // Errors
        errors: {
          noApiKey: 'API key not configured',
          networkError: 'Network error. Please check your connection.',
          timeout: 'Request timed out',
          unknown: 'An unknown error occurred'
        },

        // POI Modal labels
        poi: {
          address: 'Address:',
          phone: 'Phone:',
          hours: 'Hours:',
          rating: 'Rating:',
          price: 'Price:'
        }
      },

      ja: {
        // Header
        title: '🇯🇵 AI旅行エージェント',
        subtitle: '日本全国の食べる・買う・遊ぶ・見るスポットを発見',

        // Language toggle
        langToggle: 'English',

        // Input
        inputPlaceholder: '日本の場所について聞いてください...（例：「渋谷のレストランを探して」）',
        sendButton: '送信',

        // Categories
        categories: {
          eat: '🍽️ 食べる',
          buy: '🛍️ 買う',
          enjoy: '🎪  遊ぶ',
          see: '👁️ 見る'
        },

        // Map controls
        clearMap: '地図をクリア',
        clearChat: 'チャットをクリア',
        recenter: '現在地',

        // Status messages
        status: {
          initializing: '初期化中...',
          loading: '読み込み中...',
          processing: 'リクエストを処理中...',
          searching: '場所を検索中...',
          callingMapbox: 'Mapboxサービスにクエリ中...',
          callingRurubu: 'るるぶデータベースを検索中...',
          visualizing: '地図を更新中...',
          ready: '準備完了',
          error: 'エラーが発生しました'
        },

        // System messages
        system: {
          welcome: `👋 こんにちは！Claude、Mapbox、るるぶデータを使った日本旅行アシスタントです。

できること:
• 日本全国のレストラン、お店、観光地を探す
• 隠れた名所や人気スポットを発見
• 日帰り旅行やツアーを計画
• 場所間のルートや道順を取得
• 一定時間や距離内で到達可能なエリアを表示
• すべてをインタラクティブマップに表示

試しに聞いてみてください:
• 「渋谷のレストランを探して」
• 「京都のお寺を見せて」
• 「原宿で何ができる？」
• 「浅草の日帰りプランを作って」`,

          cleared: '会話と地図をクリアしました',
          mapCleared: '地図をクリアしました',
          mapRecentered: '地図を現在地に戻しました',

          configError: `⚠️ 設定エラー

config.jsでAPIキーを更新してください:
• Claude APIキー: https://console.anthropic.com/ から取得
• Mapboxアクセストークン: https://account.mapbox.com/access-tokens/ から取得

詳細はREADME.mdをご覧ください。`,

          initError: 'アプリケーションの初期化に失敗しました。ページを更新してください。'
        },

        // Errors
        errors: {
          noApiKey: 'APIキーが設定されていません',
          networkError: 'ネットワークエラー。接続を確認してください。',
          timeout: 'リクエストがタイムアウトしました',
          unknown: '不明なエラーが発生しました'
        },

        // POI Modal labels
        poi: {
          address: '住所：',
          phone: '電話：',
          hours: '営業時間：',
          rating: 'おすすめ：',
          price: '料金：'
        }
      }
    };
  }

  /**
   * Get translation for a key
   * @param {string} key - Translation key (e.g., 'title' or 'categories.eat')
   * @returns {string} Translated text
   */
  t(key) {
    const keys = key.split('.');
    let value = this.translations[this.currentLang];

    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        console.warn(`Translation key not found: ${key} (${this.currentLang})`);
        return key;
      }
    }

    return value || key;
  }

  /**
   * Set current language
   * @param {string} lang - Language code ('en' or 'ja')
   */
  setLanguage(lang) {
    if (!this.translations[lang]) {
      console.warn(`Language not supported: ${lang}`);
      return;
    }

    this.currentLang = lang;
    console.log(`Language set to: ${lang}`);
  }

  /**
   * Toggle between English and Japanese
   */
  toggleLanguage() {
    this.currentLang = this.currentLang === 'en' ? 'ja' : 'en';
    return this.currentLang;
  }

  /**
   * Get current language
   */
  getCurrentLanguage() {
    return this.currentLang;
  }

  /**
   * Check if current language is Japanese
   */
  isJapanese() {
    return this.currentLang === 'ja';
  }

  /**
   * Check if current language is English
   */
  isEnglish() {
    return this.currentLang === 'en';
  }
}
