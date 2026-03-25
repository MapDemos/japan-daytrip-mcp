/**
 * Japan Tourism Demo - Translations
 * English and Japanese translations for the Japan tourism demo
 */

export const JAPAN_TRANSLATIONS = {
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
      callingTools: 'Searching Rurubu database...',
      callingRurubu: 'Searching Rurubu database...', // Deprecated: use callingTools
      visualizing: 'Updating map...',
      optimizing: 'Optimizing conversation history...',
      ready: 'Ready',
      error: 'Error occurred'
    },

    // Thinking overlay
    thinking: {
      overlayTitle: '🤔 Searching...'
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

    // Errors (framework uses 'error.' prefix)
    error: {
      noApiKey: 'API key not configured',
      networkError: 'Network error. Please check your connection.',
      timeout: 'Request timed out',
      unknown: 'An unknown error occurred',
      inputTooLongTitle: 'Input Too Long',
      inputTooLongMessage: 'Please limit your message to {max} characters.',
      rateLimitTitle: 'Too Fast',
      rateLimitMessage: 'Please wait a moment before sending another message.',
      tokenOverflowTitle: 'Too Much Information',
      tokenOverflowMessage: 'There is too much information for Claude to process. Please clear the chat and start a new conversation.',
      processingTitle: 'Error',
      processingMessage: 'An error occurred while processing your request.',
      configTitle: 'Configuration Error',
      configMessage: 'Please check your configuration settings.',
      initializationTitle: 'Initialization Error',
      initializationMessage: 'Failed to initialize application. Please refresh the page.',
      speechRecognitionTitle: 'Speech Recognition Error',
      speechRecognitionMessage: 'Failed to recognize speech. Please try again.',
      microphonePermissionMessage: 'Microphone access denied. Please allow microphone access in your browser settings.',
      noSpeechMessage: 'No speech detected. Please try again.'
    },

    // Legacy errors (for backward compatibility)
    errors: {
      noApiKey: 'API key not configured',
      networkError: 'Network error. Please check your connection.',
      timeout: 'Request timed out',
      unknown: 'An unknown error occurred',
      inputTooLong: 'Input Too Long',
      inputTooLongMessage: 'Please limit your message to {limit} characters. Current length: {current}',
      rateLimitError: 'Too Fast',
      rateLimitMessage: 'Please wait a moment before sending another message.',
      error: 'Error',
      tooMuchInfo: 'Too Much Information',
      tooMuchInfoMessage: 'There is too much information for Claude to process. Please clear the chat and start a new conversation.',
      clearChatButton: 'Clear Chat',
      speechRecognitionTitle: 'Speech Recognition Error',
      speechRecognitionMessage: 'Failed to recognize speech. Please try again.',
      microphonePermissionMessage: 'Microphone access denied. Please allow microphone access in your browser settings.',
      noSpeechMessage: 'No speech detected. Please try again.'
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
    langToggle: '한국어',

    // Input
    inputPlaceholder: '日本の場所について聞いてください...（例：「渋谷のレストランを探して」）',
    sendButton: '送信',

    // Categories
    categories: {
      eat: '🍽️ 食べる',
      buy: '🛍️ 買う',
      enjoy: '🎪 遊ぶ',
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
      callingTools: 'るるぶデータベースを検索中...',
      callingRurubu: 'るるぶデータベースを検索中...', // Deprecated: use callingTools
      visualizing: '地図を更新中...',
      optimizing: '会話履歴を最適化中...',
      ready: '準備完了',
      error: 'エラーが発生しました'
    },

    // Thinking overlay
    thinking: {
      overlayTitle: '🤔 検索中...'
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

    // Errors (framework uses 'error.' prefix)
    error: {
      noApiKey: 'APIキーが設定されていません',
      networkError: 'ネットワークエラー。接続を確認してください。',
      timeout: 'リクエストがタイムアウトしました',
      unknown: '不明なエラーが発生しました',
      inputTooLongTitle: '入力が長すぎます',
      inputTooLongMessage: 'メッセージは{max}文字以内にしてください。',
      rateLimitTitle: '送信が早すぎます',
      rateLimitMessage: '少し待ってから再度送信してください。',
      tokenOverflowTitle: '情報が多すぎます',
      tokenOverflowMessage: 'Claudeが処理できる情報量を超えています。チャットをクリアして新しい会話を始めてください。',
      processingTitle: 'エラー',
      processingMessage: 'リクエストの処理中にエラーが発生しました。',
      configTitle: '設定エラー',
      configMessage: '設定を確認してください。',
      initializationTitle: '初期化エラー',
      initializationMessage: 'アプリケーションの初期化に失敗しました。ページを更新してください。',
      speechRecognitionTitle: '音声認識エラー',
      speechRecognitionMessage: '音声認識に失敗しました。もう一度お試しください。',
      microphonePermissionMessage: 'マイクへのアクセスが拒否されました。ブラウザ設定でマイクアクセスを許可してください。',
      noSpeechMessage: '音声が検出されませんでした。もう一度お試しください。'
    },

    // Legacy errors (for backward compatibility)
    errors: {
      noApiKey: 'APIキーが設定されていません',
      networkError: 'ネットワークエラー。接続を確認してください。',
      timeout: 'リクエストがタイムアウトしました',
      unknown: '不明なエラーが発生しました',
      inputTooLong: '入力が長すぎます',
      inputTooLongMessage: 'メッセージは{limit}文字以内にしてください。現在の長さ：{current}文字',
      rateLimitError: '送信が早すぎます',
      rateLimitMessage: '少し待ってから再度送信してください。',
      error: 'エラー',
      tooMuchInfo: '情報が多すぎます',
      tooMuchInfoMessage: 'Claudeが処理できる情報量を超えています。チャットをクリアして新しい会話を始めてください。',
      clearChatButton: 'チャットをクリア',
      speechRecognitionTitle: '音声認識エラー',
      speechRecognitionMessage: '音声認識に失敗しました。もう一度お試しください。',
      microphonePermissionMessage: 'マイクへのアクセスが拒否されました。ブラウザ設定でマイクアクセスを許可してください。',
      noSpeechMessage: '音声が検出されませんでした。もう一度お試しください。'
    },

    // POI Modal labels
    poi: {
      address: '住所：',
      phone: '電話：',
      hours: '営業時間：',
      rating: 'おすすめ：',
      price: '料金：'
    }
  },

  ko: {
    // Header
    title: '🇯🇵 AI 여행 가이드',
    subtitle: '일본 전역의 맛집, 쇼핑, 관광 명소를 발견하세요',

    // Language toggle
    langToggle: 'English',

    // Input
    inputPlaceholder: '일본의 장소에 대해 물어보세요... (예: "시부야의 레스토랑 찾아줘")',
    sendButton: '전송',

    // Categories
    categories: {
      eat: '🍽️ 음식점',
      buy: '🛍️ 쇼핑',
      enjoy: '🎪  엔터테인먼트',
      see: '👁️ 관광'
    },

    // Map controls
    clearMap: '지도 지우기',
    clearChat: '채팅 지우기',
    recenter: '현재 위치',

    // Status messages
    status: {
      initializing: '초기화 중...',
      loading: '로딩 중...',
      processing: '요청 처리 중...',
      searching: '장소 검색 중...',
      callingMapbox: 'Mapbox 서비스 조회 중...',
      callingTools: 'Rurubu 데이터베이스 검색 중...',
      callingRurubu: 'Rurubu 데이터베이스 검색 중...', // Deprecated: use callingTools
      visualizing: '지도 업데이트 중...',
      optimizing: '대화 기록 최적화 중...',
      ready: '준비 완료',
      error: '오류 발생'
    },

    // Thinking overlay
    thinking: {
      overlayTitle: '🤔 검색 중...'
    },

    // System messages
    system: {
      welcome: `👋 안녕하세요! Claude, Mapbox, Rurubu 데이터를 활용한 일본 여행 가이드입니다.

가능한 기능:
• 일본 전역의 레스토랑, 상점, 관광지 검색
• 숨겨진 명소와 인기 장소 발견
• 당일 여행 및 일정 계획
• 장소 간 경로 및 길찾기
• 특정 시간이나 거리 내 도달 가능한 지역 표시
• 인터랙티브 지도에 모든 정보 표시

이렇게 물어보세요:
• "시부야의 레스토랑 찾아줘"
• "교토의 사찰 보여줘"
• "하라주쿠에서 뭘 할 수 있어?"
• "아사쿠사 당일 여행 계획 짜줘"`,

      cleared: '대화 및 지도를 지웠습니다',
      mapCleared: '지도를 지웠습니다',
      mapRecentered: '지도를 현재 위치로 이동했습니다',

      configError: `⚠️ 설정 오류

config.js에서 API 키를 업데이트하세요:
• Claude API 키: https://console.anthropic.com/ 에서 발급
• Mapbox 액세스 토큰: https://account.mapbox.com/access-tokens/ 에서 발급

자세한 내용은 README.md를 참조하세요.`,

      initError: '애플리케이션 초기화에 실패했습니다. 페이지를 새로고침하세요.'
    },

    // Errors (framework uses 'error.' prefix)
    error: {
      noApiKey: 'API 키가 설정되지 않았습니다',
      networkError: '네트워크 오류. 연결을 확인하세요.',
      timeout: '요청 시간이 초과되었습니다',
      unknown: '알 수 없는 오류가 발생했습니다',
      inputTooLongTitle: '입력이 너무 깁니다',
      inputTooLongMessage: '메시지는 {max}자 이내로 작성해주세요.',
      rateLimitTitle: '전송이 너무 빠릅니다',
      rateLimitMessage: '잠시 후 다시 시도해주세요.',
      tokenOverflowTitle: '정보가 너무 많습니다',
      tokenOverflowMessage: 'Claude가 처리할 수 있는 정보량을 초과했습니다. 채팅을 지우고 새로운 대화를 시작하세요.',
      processingTitle: '오류',
      processingMessage: '요청 처리 중 오류가 발생했습니다.',
      configTitle: '설정 오류',
      configMessage: '설정을 확인하세요.',
      initializationTitle: '초기화 오류',
      initializationMessage: '애플리케이션 초기화에 실패했습니다. 페이지를 새로고침하세요.',
      speechRecognitionTitle: '음성 인식 오류',
      speechRecognitionMessage: '음성 인식에 실패했습니다. 다시 시도해주세요.',
      microphonePermissionMessage: '마이크 액세스가 거부되었습니다. 브라우저 설정에서 마이크 액세스를 허용해주세요.',
      noSpeechMessage: '음성이 감지되지 않았습니다. 다시 시도해주세요.'
    },

    // Legacy errors (for backward compatibility)
    errors: {
      noApiKey: 'API 키가 설정되지 않았습니다',
      networkError: '네트워크 오류. 연결을 확인하세요.',
      timeout: '요청 시간이 초과되었습니다',
      unknown: '알 수 없는 오류가 발생했습니다',
      inputTooLong: '입력이 너무 깁니다',
      inputTooLongMessage: '메시지는 {limit}자 이내로 작성해주세요. 현재 길이: {current}자',
      rateLimitError: '전송이 너무 빠릅니다',
      rateLimitMessage: '잠시 후 다시 시도해주세요.',
      error: '오류',
      tooMuchInfo: '정보가 너무 많습니다',
      tooMuchInfoMessage: 'Claude가 처리할 수 있는 정보량을 초과했습니다. 채팅을 지우고 새로운 대화를 시작하세요.',
      clearChatButton: '채팅 지우기',
      speechRecognitionTitle: '음성 인식 오류',
      speechRecognitionMessage: '음성 인식에 실패했습니다. 다시 시도해주세요.',
      microphonePermissionMessage: '마이크 액세스가 거부되었습니다. 브라우저 설정에서 마이크 액세스를 허용해주세요.',
      noSpeechMessage: '음성이 감지되지 않았습니다. 다시 시도해주세요.'
    },

    // POI Modal labels
    poi: {
      address: '주소:',
      phone: '전화:',
      hours: '영업시간:',
      rating: '평점:',
      price: '가격:'
    }
  }
};
