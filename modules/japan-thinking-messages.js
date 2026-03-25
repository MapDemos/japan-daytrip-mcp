/**
 * Japan Tourism Thinking Messages
 * Domain-specific thinking messages for Japan tourism demo
 *
 * Extends DefaultMessageProvider with Japan-specific:
 * - Locations (Tokyo, Kyoto, Osaka, etc.)
 * - Categories (temples, shrines, onsen, etc.)
 * - Rich contextual messages for Japan travel
 */

export class JapanThinkingMessages {
  /**
   * Extract location from question
   * Maps English/Japanese location names
   */
  extractLocation(question) {
    const locations = {
      // English and romanji
      'tokyo': 'Tokyo',
      'shibuya': 'Shibuya',
      'shinjuku': 'Shinjuku',
      'asakusa': 'Asakusa',
      'harajuku': 'Harajuku',
      'ginza': 'Ginza',
      'akihabara': 'Akihabara',
      'roppongi': 'Roppongi',
      'kyoto': 'Kyoto',
      'osaka': 'Osaka',
      'yokohama': 'Yokohama',
      'nara': 'Nara',
      'kobe': 'Kobe',
      'hiroshima': 'Hiroshima',
      'fukuoka': 'Fukuoka',
      'sapporo': 'Sapporo',
      'nagoya': 'Nagoya',
      // Japanese
      '東京': 'Tokyo',
      '渋谷': 'Shibuya',
      '新宿': 'Shinjuku',
      '浅草': 'Asakusa',
      '原宿': 'Harajuku',
      '銀座': 'Ginza',
      '秋葉原': 'Akihabara',
      '六本木': 'Roppongi',
      '京都': 'Kyoto',
      '大阪': 'Osaka',
      '横浜': 'Yokohama',
      '奈良': 'Nara',
      '神戸': 'Kobe',
      '広島': 'Hiroshima',
      '福岡': 'Fukuoka',
      '札幌': 'Sapporo',
      '名古屋': 'Nagoya',
      // Korean
      '도쿄': 'Tokyo',
      '시부야': 'Shibuya',
      '신주쿠': 'Shinjuku',
      '아사쿠사': 'Asakusa',
      '하라주쿠': 'Harajuku',
      '긴자': 'Ginza',
      '아키하바라': 'Akihabara',
      '롯폰기': 'Roppongi',
      '교토': 'Kyoto',
      '오사카': 'Osaka',
      '요코하마': 'Yokohama',
      '나라': 'Nara',
      '고베': 'Kobe',
      '히로시마': 'Hiroshima',
      '후쿠오카': 'Fukuoka',
      '삿포로': 'Sapporo',
      '나고야': 'Nagoya'
    };

    for (const [key, value] of Object.entries(locations)) {
      if (question.includes(key)) {
        return value;
      }
    }

    return null;
  }

  /**
   * Extract category from question
   * Japan-specific categories (temples, shrines, onsen, etc.)
   */
  extractCategory(question) {
    if (question.match(/restaurant|food|eat|dining|sushi|ramen|cuisine|レストラン|食事|飲食|寿司|ラーメン|料理|食べ物|레스토랑|음식점|식당|맛집|초밥|라멘|요리/)) {
      return 'restaurants and dining options';
    }
    if (question.match(/shop|shopping|store|buy|mall|ショッピング|買い物|店|ストア|モール|쇼핑|가게|상점|매장|몰/)) {
      return 'shopping destinations';
    }
    if (question.match(/temple|shrine|historic|traditional|cultural|museum|寺|神社|歴史|伝統|文化|博物館|美術館|사원|신사|역사|전통|문화|박물관|미술관/)) {
      return 'cultural and historical sites';
    }
    if (question.match(/park|garden|nature|outdoor|公園|庭園|自然|アウトドア|屋外|공원|정원|자연|야외|아웃도어/)) {
      return 'parks and outdoor spaces';
    }
    if (question.match(/entertainment|fun|activity|enjoy|エンターテイメント|娯楽|アクティビティ|遊び|楽しむ|엔터테인먼트|오락|액티비티|즐기다|놀이/)) {
      return 'entertainment venues';
    }
    if (question.match(/hotel|accommodation|stay|ホテル|宿泊|泊まる|호텔|숙박|묵다/)) {
      return 'accommodation options';
    }
    if (question.match(/cafe|coffee|カフェ|コーヒー|喫茶|카페|커피/)) {
      return 'cafes and coffee shops';
    }

    return 'points of interest';
  }

  /**
   * Generate Japan-specific thinking messages
   * Much richer than default, with cultural context
   */
  generateMessages({ question, location, category, action, isJapanese }) {
    const messages = [];

    // Detect Korean language (Hangul characters: \uAC00-\uD7AF)
    const isKorean = /[\uAC00-\uD7AF]/.test(question);

    // Base thinking messages (10 variations)
    if (isKorean) {
      messages.push('🤔 생각하는 중...');
      messages.push('💭 검토 중...');
      messages.push('🧠 처리 중...');
      messages.push('📖 요청 분석 중...');
      messages.push('🔍 쿼리 이해 중...');
      messages.push('💡 계획 작성 중...');
      messages.push('⚙️ 검색 초기화 중...');
      messages.push('🎯 세부사항에 집중 중...');
      messages.push('📋 요청 파싱 중...');
      messages.push('🔎 쿼리 조사 중...');
    } else if (isJapanese) {
      messages.push('🤔 考え中...');
      messages.push('💭 検討中...');
      messages.push('🧠 処理中...');
      messages.push('📖 リクエストを分析中...');
      messages.push('🔍 クエリを理解中...');
      messages.push('💡 プランを作成中...');
      messages.push('⚙️ 検索を初期化中...');
      messages.push('🎯 詳細に集中中...');
      messages.push('📋 リクエストを解析中...');
      messages.push('🔎 クエリを調査中...');
    } else {
      messages.push('🤔 thinking...');
      messages.push('💭 pondering...');
      messages.push('🧠 processing...');
      messages.push('📖 analyzing your request...');
      messages.push('🔍 understanding query...');
      messages.push('💡 formulating plan...');
      messages.push('⚙️ initializing search...');
      messages.push('🎯 focusing on details...');
      messages.push('📋 parsing request...');
      messages.push('🔎 examining query...');
    }

    // Location-specific messages (15+ variations)
    if (location) {
      if (isKorean) {
        messages.push(`🗺️ ${location} 탐색 중...`);
        messages.push(`🔍 ${location} 지역 검색 중...`);
        messages.push(`📍 ${location}의 명소 찾는 중...`);
        messages.push(`🌏 ${location} 안내 중...`);
        messages.push(`🧭 ${location} 확인 중...`);
        messages.push(`🗾 ${location} 지역 조사 중...`);
        messages.push(`🏙️ ${location} 구역 스캔 중...`);
        messages.push(`🎌 ${location} 주변 탐색 중...`);
        messages.push(`🚶 ${location} 산책 중...`);
        messages.push(`👀 ${location} 둘러보는 중...`);
        messages.push(`🔦 ${location} 조사 중...`);
        messages.push(`🗼 ${location}의 명소 발견 중...`);
        messages.push(`🌆 ${location}의 스팟 열람 중...`);
        messages.push(`🏯 ${location}의 보물 발굴 중...`);
        messages.push(`📸 ${location}의 옵션 확인 중...`);
      } else if (isJapanese) {
        messages.push(`🗺️ ${location}を探索中...`);
        messages.push(`🔍 ${location}エリアを検索中...`);
        messages.push(`📍 ${location}のスポットを検索中...`);
        messages.push(`🌏 ${location}を案内中...`);
        messages.push(`🧭 ${location}を確認中...`);
        messages.push(`🗾 ${location}地域を調査中...`);
        messages.push(`🏙️ ${location}地区をスキャン中...`);
        messages.push(`🎌 ${location}の近隣を探索中...`);
        messages.push(`🚶 ${location}を散策中...`);
        messages.push(`👀 ${location}を見回し中...`);
        messages.push(`🔦 ${location}を調査中...`);
        messages.push(`🗼 ${location}の名所を発見中...`);
        messages.push(`🌆 ${location}のスポットを閲覧中...`);
        messages.push(`🏯 ${location}の宝を発掘中...`);
        messages.push(`📸 ${location}のオプションを確認中...`);
      } else {
        messages.push(`🗺️ exploring ${location}...`);
        messages.push(`🔍 searching ${location} area...`);
        messages.push(`📍 locating spots in ${location}...`);
        messages.push(`🌏 navigating ${location}...`);
        messages.push(`🧭 orienting to ${location}...`);
        messages.push(`🗾 surveying ${location} region...`);
        messages.push(`🏙️ scanning ${location} district...`);
        messages.push(`🎌 exploring ${location} neighborhoods...`);
        messages.push(`🚶 walking through ${location}...`);
        messages.push(`👀 looking around ${location}...`);
        messages.push(`🔦 investigating ${location}...`);
        messages.push(`🗼 discovering ${location} gems...`);
        messages.push(`🌆 browsing ${location} spots...`);
        messages.push(`🏯 uncovering ${location} treasures...`);
        messages.push(`📸 reviewing ${location} options...`);
      }
    }

    // Category-specific messages (50+ variations for Japan tourism)
    if (category === 'restaurants and dining options') {
      if (isKorean) {
        messages.push('🍜 음식점 탐색 중...');
        messages.push('🍱 식사 장소 검색 중...');
        messages.push('🍽️ 레스토랑 열람 중...');
        messages.push('⭐ 평점 확인 중...');
        messages.push('🔥 인기 음식점 찾는 중...');
        messages.push('🥢 맛집 발견 중...');
        messages.push('🍲 메뉴 확인 중...');
        messages.push('👨‍🍳 셰프 추천 찾는 중...');
        messages.push('📝 리뷰 읽는 중...');
        messages.push('🌟 평가 분석 중...');
        messages.push('🍣 요리 종류 탐색 중...');
        messages.push('🥘 특선 요리 확인 중...');
        messages.push('💰 가격 비교 중...');
        messages.push('⏰ 영업시간 확인 중...');
        messages.push('🚶 도보 거리 계산 중...');
        messages.push('🗣️ 고객 피드백 분석 중...');
        messages.push('🏆 최고 추천 찾는 중...');
        messages.push('📊 옵션 순위 매기는 중...');
        messages.push('🎌 정통 음식점 찾는 중...');
        messages.push('✨ 숨은 명소 탐색 중...');
      } else if (isJapanese) {
        messages.push('🍜 飲食店を探索中...');
        messages.push('🍱 食事会場を検索中...');
        messages.push('🍽️ レストランを閲覧中...');
        messages.push('⭐ 評価を確認中...');
        messages.push('🔥 人気店を検索中...');
        messages.push('🥢 飲食店を発見中...');
        messages.push('🍲 メニューを確認中...');
        messages.push('👨‍🍳 シェフのおすすめを検索中...');
        messages.push('📝 レビューを読み込み中...');
        messages.push('🌟 評価を評価中...');
        messages.push('🍣 料理の種類を探索中...');
        messages.push('🥘 名物料理を確認中...');
        messages.push('💰 価格を比較中...');
        messages.push('⏰ 営業時間を確認中...');
        messages.push('🚶 徒歩距離を計算中...');
        messages.push('🗣️ お客様のフィードバックを分析中...');
        messages.push('🏆 トップピックを特定中...');
        messages.push('📊 オプションをランク付け中...');
        messages.push('🎌 本格的な店を検索中...');
        messages.push('✨ 隠れた名店を探索中...');
      } else {
        messages.push('🍜 hunting for food spots...');
        messages.push('🍱 searching dining venues...');
        messages.push('🍽️ browsing restaurants...');
        messages.push('⭐ checking ratings...');
        messages.push('🔥 finding popular places...');
        messages.push('🥢 discovering eateries...');
        messages.push('🍲 scanning menu options...');
        messages.push('👨‍🍳 finding chef recommendations...');
        messages.push('📝 reading reviews...');
        messages.push('🌟 evaluating ratings...');
        messages.push('🍣 exploring cuisine types...');
        messages.push('🥘 checking specialties...');
        messages.push('💰 comparing prices...');
        messages.push('⏰ verifying hours...');
        messages.push('🚶 calculating walking distances...');
        messages.push('🗣️ analyzing customer feedback...');
        messages.push('🏆 identifying top picks...');
        messages.push('📊 ranking options...');
        messages.push('🎌 finding authentic spots...');
        messages.push('✨ seeking hidden gems...');
      }
    } else if (category === 'shopping destinations') {
      if (isKorean) {
        messages.push('🛍️ 쇼핑 스팟 열람 중...');
        messages.push('🏬 상점 스캔 중...');
        messages.push('✨ 트렌디한 가게 찾는 중...');
        messages.push('👜 부티크 발견 중...');
        messages.push('🎁 선물 가게 찾는 중...');
        messages.push('🛒 시장 탐색 중...');
        messages.push('💎 독특한 제품 찾는 중...');
        messages.push('🏪 소매 지역 확인 중...');
        messages.push('🎨 장인 가게 찾는 중...');
        messages.push('👗 패션 지구 열람 중...');
        messages.push('📱 전자제품 찾는 중...');
        messages.push('🎭 기념품 가게 발견 중...');
        messages.push('🌸 전문 매장 탐색 중...');
        messages.push('💫 할인 상품 찾는 중...');
        messages.push('🏷️ 옵션 비교 중...');
      } else if (isJapanese) {
        messages.push('🛍️ ショッピングスポットを閲覧中...');
        messages.push('🏬 店舗をスキャン中...');
        messages.push('✨ トレンディな店を検索中...');
        messages.push('👜 ブティックを発見中...');
        messages.push('🎁 ギフトショップを検索中...');
        messages.push('🛒 マーケットを探索中...');
        messages.push('💎 ユニークな商品を探索中...');
        messages.push('🏪 小売エリアを確認中...');
        messages.push('🎨 職人の店を検索中...');
        messages.push('👗 ファッション地区を閲覧中...');
        messages.push('📱 電化製品を検索中...');
        messages.push('🎭 お土産店を発見中...');
        messages.push('🌸 専門店を探索中...');
        messages.push('💫 お買い得品を探索中...');
        messages.push('🏷️ オプションを比較中...');
      } else {
        messages.push('🛍️ browsing shopping spots...');
        messages.push('🏬 scanning stores...');
        messages.push('✨ finding trendy shops...');
        messages.push('👜 discovering boutiques...');
        messages.push('🎁 locating gift shops...');
        messages.push('🛒 exploring markets...');
        messages.push('💎 seeking unique finds...');
        messages.push('🏪 checking retail areas...');
        messages.push('🎨 finding artisan shops...');
        messages.push('👗 browsing fashion districts...');
        messages.push('📱 locating electronics...');
        messages.push('🎭 discovering souvenir shops...');
        messages.push('🌸 exploring specialty stores...');
        messages.push('💫 hunting for deals...');
        messages.push('🏷️ comparing options...');
      }
    } else if (category === 'cultural and historical sites') {
      if (isKorean) {
        messages.push('⛩️ 문화 유산 발견 중...');
        messages.push('🏛️ 역사적 명소 탐색 중...');
        messages.push('🏯 사원 찾는 중...');
        messages.push('⛩️ 신사 찾는 중...');
        messages.push('🎎 유산지 발굴 중...');
        messages.push('📜 역사 확인 중...');
        messages.push('🗿 기념물 찾는 중...');
        messages.push('🏺 박물관 발견 중...');
        messages.push('🎨 미술관 탐색 중...');
        messages.push('🌸 전통 명소 찾는 중...');
        messages.push('🎋 문화 센터 찾는 중...');
        messages.push('🏮 역사 지구 찾는 중...');
        messages.push('📖 중요성 조사 중...');
        messages.push('🗾 유산 탐색 중...');
        messages.push('⛰️ 성지 찾는 중...');
      } else if (isJapanese) {
        messages.push('⛩️ 文化遺産を発見中...');
        messages.push('🏛️ 歴史的スポットを探索中...');
        messages.push('🏯 寺院を検索中...');
        messages.push('⛩️ 神社を検索中...');
        messages.push('🎎 遺産を発掘中...');
        messages.push('📜 歴史を確認中...');
        messages.push('🗿 モニュメントを検索中...');
        messages.push('🏺 博物館を発見中...');
        messages.push('🎨 美術館を探索中...');
        messages.push('🌸 伝統的なスポットを探索中...');
        messages.push('🎋 文化センターを検索中...');
        messages.push('🏮 歴史地区を検索中...');
        messages.push('📖 重要性を調査中...');
        messages.push('🗾 遺産を探索中...');
        messages.push('⛰️ 聖地を検索中...');
      } else {
        messages.push('⛩️ discovering cultural sites...');
        messages.push('🏛️ exploring historical spots...');
        messages.push('🏯 finding temples...');
        messages.push('⛩️ locating shrines...');
        messages.push('🎎 uncovering heritage sites...');
        messages.push('📜 reviewing history...');
        messages.push('🗿 finding monuments...');
        messages.push('🏺 discovering museums...');
        messages.push('🎨 exploring art galleries...');
        messages.push('🌸 seeking traditional spots...');
        messages.push('🎋 finding cultural centers...');
        messages.push('🏮 locating historic districts...');
        messages.push('📖 researching significance...');
        messages.push('🗾 exploring heritage...');
        messages.push('⛰️ finding sacred sites...');
      }
    } else if (category === 'parks and outdoor spaces') {
      if (isKorean) {
        messages.push('🌳 자연 명소 찾는 중...');
        messages.push('🌸 야외 지역 탐색 중...');
        messages.push('🏞️ 공원 발견 중...');
        messages.push('🌲 정원 찾는 중...');
        messages.push('🌺 녹지 찾는 중...');
        messages.push('🦋 경치 좋은 곳 찾는 중...');
        messages.push('🌅 전망대 탐색 중...');
        messages.push('🏔️ 자연 산책로 발견 중...');
        messages.push('🌊 해안가 찾는 중...');
        messages.push('🌄 평화로운 지역 찾는 중...');
        messages.push('🍂 계절 아름다움 탐색 중...');
        messages.push('🦢 고요한 장소 찾는 중...');
        messages.push('🎋 대나무 숲 발견 중...');
        messages.push('🌷 꽃 정원 찾는 중...');
        messages.push('🌿 선 정원 찾는 중...');
      } else if (isJapanese) {
        messages.push('🌳 自然スポットを検索中...');
        messages.push('🌸 屋外エリアを探索中...');
        messages.push('🏞️ 公園を発見中...');
        messages.push('🌲 庭園を検索中...');
        messages.push('🌺 緑地を探索中...');
        messages.push('🦋 景色の良いスポットを検索中...');
        messages.push('🌅 展望台を探索中...');
        messages.push('🏔️ 自然歩道を発見中...');
        messages.push('🌊 ウォーターフロントを検索中...');
        messages.push('🌄 静かなエリアを検索中...');
        messages.push('🍂 季節の美しさを探索中...');
        messages.push('🦢 静かなスポットを探索中...');
        messages.push('🎋 竹林を発見中...');
        messages.push('🌷 花園を検索中...');
        messages.push('🌿 禅庭園を検索中...');
      } else {
        messages.push('🌳 finding nature spots...');
        messages.push('🌸 exploring outdoor areas...');
        messages.push('🏞️ discovering parks...');
        messages.push('🌲 locating gardens...');
        messages.push('🌺 seeking green spaces...');
        messages.push('🦋 finding scenic spots...');
        messages.push('🌅 exploring viewpoints...');
        messages.push('🏔️ discovering nature trails...');
        messages.push('🌊 locating waterfront...');
        messages.push('🌄 finding peaceful areas...');
        messages.push('🍂 exploring seasonal beauty...');
        messages.push('🦢 seeking tranquil spots...');
        messages.push('🎋 discovering bamboo groves...');
        messages.push('🌷 locating flower gardens...');
        messages.push('🌿 finding zen gardens...');
      }
    } else if (category === 'entertainment venues') {
      if (isKorean) {
        messages.push('🎮 엔터테인먼트 검색 중...');
        messages.push('🎪 재미있는 활동 찾는 중...');
        messages.push('🎭 공연장 찾는 중...');
        messages.push('🎬 관광 명소 발견 중...');
        messages.push('🎨 체험 탐색 중...');
        messages.push('🎯 액티비티 찾는 중...');
        messages.push('🎡 놀이시설 찾는 중...');
        messages.push('🎤 공연 찾는 중...');
        messages.push('🎸 나이트라이프 발견 중...');
        messages.push('🎲 게임 스팟 찾는 중...');
        messages.push('🎳 여가 옵션 탐색 중...');
        messages.push('🎪 체험 찾는 중...');
        messages.push('🎭 쇼 열람 중...');
        messages.push('🎨 창작 공간 찾는 중...');
        messages.push('🎵 음악 공연장 찾는 중...');
      } else if (isJapanese) {
        messages.push('🎮 エンターテイメントを検索中...');
        messages.push('🎪 楽しいアクティビティを検索中...');
        messages.push('🎭 会場を検索中...');
        messages.push('🎬 アトラクションを発見中...');
        messages.push('🎨 体験を探索中...');
        messages.push('🎯 アクティビティを検索中...');
        messages.push('🎡 アミューズメントを探索中...');
        messages.push('🎤 エンターテイメントを検索中...');
        messages.push('🎸 ナイトライフを発見中...');
        messages.push('🎲 ゲームスポットを検索中...');
        messages.push('🎳 レジャーオプションを探索中...');
        messages.push('🎪 体験を探索中...');
        messages.push('🎭 ショーを閲覧中...');
        messages.push('🎨 クリエイティブスペースを検索中...');
        messages.push('🎵 音楽会場を検索中...');
      } else {
        messages.push('🎮 searching entertainment...');
        messages.push('🎪 finding fun activities...');
        messages.push('🎭 locating venues...');
        messages.push('🎬 discovering attractions...');
        messages.push('🎨 exploring experiences...');
        messages.push('🎯 finding activities...');
        messages.push('🎡 seeking amusement...');
        messages.push('🎤 locating entertainment...');
        messages.push('🎸 discovering nightlife...');
        messages.push('🎲 finding gaming spots...');
        messages.push('🎳 exploring leisure options...');
        messages.push('🎪 seeking experiences...');
        messages.push('🎭 browsing shows...');
        messages.push('🎨 finding creative spaces...');
        messages.push('🎵 locating music venues...');
      }
    } else if (category === 'cafes and coffee shops') {
      if (isKorean) {
        messages.push('☕ 커피 스팟 찾는 중...');
        messages.push('🍰 아늑한 카페 찾는 중...');
        messages.push('🥐 베이커리 카페 발견 중...');
        messages.push('🫖 찻집 찾는 중...');
        messages.push('☕ 스페셜티 커피 찾는 중...');
        messages.push('🧁 디저트 카페 열람 중...');
        messages.push('📚 독서 카페 찾는 중...');
        messages.push('🎨 장인 카페 탐색 중...');
        messages.push('🌿 조용한 공간 찾는 중...');
        messages.push('💻 작업 공간 찾는 중...');
        messages.push('🍵 티 스팟 발견 중...');
        messages.push('🥞 브런치 카페 찾는 중...');
        messages.push('☕ 로스터리 탐색 중...');
        messages.push('🏮 분위기 좋은 카페 찾는 중...');
        messages.push('✨ 인스타그램 핫플 찾는 중...');
      } else if (isJapanese) {
        messages.push('☕ コーヒースポットを探索中...');
        messages.push('🍰 居心地の良いカフェを検索中...');
        messages.push('🥐 ベーカリーカフェを発見中...');
        messages.push('🫖 茶室を検索中...');
        messages.push('☕ スペシャルティコーヒーを探索中...');
        messages.push('🧁 デザートカフェを閲覧中...');
        messages.push('📚 読書カフェを検索中...');
        messages.push('🎨 職人カフェを探索中...');
        messages.push('🌿 静かな空間を検索中...');
        messages.push('💻 ワークスペースを検索中...');
        messages.push('🍵 ティースポットを発見中...');
        messages.push('🥞 ブランチカフェを探索中...');
        messages.push('☕ ロースターを探索中...');
        messages.push('🏮 雰囲気の良いカフェを検索中...');
        messages.push('✨ インスタ映えスポットを探索中...');
      } else {
        messages.push('☕ hunting for coffee spots...');
        messages.push('🍰 finding cozy cafes...');
        messages.push('🥐 discovering bakery cafes...');
        messages.push('🫖 locating tea houses...');
        messages.push('☕ seeking specialty coffee...');
        messages.push('🧁 browsing dessert cafes...');
        messages.push('📚 finding reading cafes...');
        messages.push('🎨 exploring artisan cafes...');
        messages.push('🌿 locating quiet spaces...');
        messages.push('💻 finding workspaces...');
        messages.push('🍵 discovering tea spots...');
        messages.push('🥞 seeking brunch cafes...');
        messages.push('☕ exploring roasters...');
        messages.push('🏮 finding atmospheric cafes...');
        messages.push('✨ seeking Instagram spots...');
      }
    } else {
      if (isKorean) {
        messages.push('📍 장소 검색 중...');
        messages.push('✨ 옵션 수집 중...');
        messages.push('🔍 가능성 탐색 중...');
        messages.push('🗺️ 장소 매핑 중...');
        messages.push('🎯 매칭 찾는 중...');
        messages.push('📌 스팟 특정 중...');
        messages.push('🌟 장소 발견 중...');
        messages.push('🔎 데이터베이스 스캔 중...');
        messages.push('📊 옵션 분석 중...');
        messages.push('🎨 선택 큐레이션 중...');
      } else if (isJapanese) {
        messages.push('📍 場所を検索中...');
        messages.push('✨ オプションを収集中...');
        messages.push('🔍 可能性を探索中...');
        messages.push('🗺️ 会場をマッピング中...');
        messages.push('🎯 マッチを検索中...');
        messages.push('📌 スポットを特定中...');
        messages.push('🌟 場所を発見中...');
        messages.push('🔎 データベースをスキャン中...');
        messages.push('📊 オプションを分析中...');
        messages.push('🎨 セレクションをキュレート中...');
      } else {
        messages.push('📍 searching locations...');
        messages.push('✨ gathering options...');
        messages.push('🔍 exploring possibilities...');
        messages.push('🗺️ mapping venues...');
        messages.push('🎯 finding matches...');
        messages.push('📌 pinpointing spots...');
        messages.push('🌟 discovering places...');
        messages.push('🔎 scanning database...');
        messages.push('📊 analyzing options...');
        messages.push('🎨 curating selections...');
      }
    }

    // Action-specific messages (10 variations)
    if (action === 'plan') {
      if (isKorean) {
        messages.push('🗓️ 여행 일정 계획 중...');
        messages.push('🚃 경로 계산 중...');
        messages.push('⏱️ 시간 예상 중...');
        messages.push('🗺️ 여정 지도 작성 중...');
        messages.push('📋 일정 정리 중...');
        messages.push('🎯 경로 최적화 중...');
        messages.push('🚶 도보 계획 중...');
        messages.push('⛩️ 경유지 정렬 중...');
        messages.push('📍 목적지 표시 중...');
        messages.push('🧭 코스 계획 중...');
      } else if (isJapanese) {
        messages.push('🗓️ 旅程を計画中...');
        messages.push('🚃 ルートを計算中...');
        messages.push('⏱️ 時間を見積もり中...');
        messages.push('🗺️ 旅を地図化中...');
        messages.push('📋 スケジュールを整理中...');
        messages.push('🎯 ルートを最適化中...');
        messages.push('🚶 散歩を計画中...');
        messages.push('⛩️ 立ち寄り先を並べ替え中...');
        messages.push('📍 目的地をプロット中...');
        messages.push('🧭 コースを図示中...');
      } else {
        messages.push('🗓️ planning itinerary...');
        messages.push('🚃 calculating routes...');
        messages.push('⏱️ estimating times...');
        messages.push('🗺️ mapping journey...');
        messages.push('📋 organizing schedule...');
        messages.push('🎯 optimizing route...');
        messages.push('🚶 planning walks...');
        messages.push('⛩️ sequencing stops...');
        messages.push('📍 plotting destinations...');
        messages.push('🧭 charting course...');
      }
    }

    // General processing messages (30 variations)
    if (isKorean) {
      messages.push('🔧 데이터 조정 중...');
      messages.push('⚡ 결과 처리 중...');
      messages.push('📊 옵션 평가 중...');
      messages.push('🎯 추천 준비 중...');
      messages.push('📍 지도에 표시 중...');
      messages.push('🔨 제안 작성 중...');
      messages.push('✨ 결과 다듬는 중...');
      messages.push('🎨 조사 결과 정리 중...');
      messages.push('📝 정보 편집 중...');
      messages.push('🔍 세부사항 확인 중...');
      messages.push('⚙️ 데이터 조립 중...');
      messages.push('🎪 옵션 정리 중...');
      messages.push('🧩 퍼즐 조립 중...');
      messages.push('🎭 결과 준비 중...');
      messages.push('🔮 데이터베이스 참조 중...');
      messages.push('📚 항목 확인 중...');
      messages.push('🎯 최적 매칭 찾는 중...');
      messages.push('✅ 선택 검증 중...');
      messages.push('🌟 즐겨찾기 강조 중...');
      messages.push('🏆 최고 선택 중...');
      messages.push('📈 품질별 정렬 중...');
      messages.push('🎨 컬렉션 큐레이션 중...');
      messages.push('💎 보석 발견 중...');
      messages.push('🔬 후보 검사 중...');
      messages.push('🎪 옵션 관리 중...');
      messages.push('🧭 위치 삼각측량 중...');
      messages.push('📐 거리 계산 중...');
      messages.push('🎲 가능성 섞는 중...');
      messages.push('🔄 교차 참조 중...');
      messages.push('✨ 선택 최종화 중...');
    } else if (isJapanese) {
      messages.push('🔧 データを調整中...');
      messages.push('⚡ 結果を処理中...');
      messages.push('📊 オプションを評価中...');
      messages.push('🎯 おすすめを準備中...');
      messages.push('📍 地図にプロット中...');
      messages.push('🔨 提案を作成中...');
      messages.push('✨ 結果を磨き上げ中...');
      messages.push('🎨 調査結果を整理中...');
      messages.push('📝 情報を編集中...');
      messages.push('🔍 詳細を確認中...');
      messages.push('⚙️ データを組み立て中...');
      messages.push('🎪 オプションを整理中...');
      messages.push('🧩 パズルを組み立て中...');
      messages.push('🎭 結果を準備中...');
      messages.push('🔮 データベースを参照中...');
      messages.push('📚 エントリーを確認中...');
      messages.push('🎯 最適なマッチを検索中...');
      messages.push('✅ 選択を検証中...');
      messages.push('🌟 お気に入りを強調中...');
      messages.push('🏆 トップピックを選択中...');
      messages.push('📈 品質別に並べ替え中...');
      messages.push('🎨 コレクションをキュレート中...');
      messages.push('💎 宝石を発見中...');
      messages.push('🔬 候補を検査中...');
      messages.push('🎪 オプションを管理中...');
      messages.push('🧭 位置を三角測量中...');
      messages.push('📐 距離を計算中...');
      messages.push('🎲 可能性をシャッフル中...');
      messages.push('🔄 相互参照中...');
      messages.push('✨ 選択を最終化中...');
    } else {
      messages.push('🔧 tinkering with data...');
      messages.push('⚡ processing results...');
      messages.push('📊 evaluating options...');
      messages.push('🎯 preparing recommendations...');
      messages.push('📍 plotting on map...');
      messages.push('🔨 crafting suggestions...');
      messages.push('✨ polishing results...');
      messages.push('🎨 organizing findings...');
      messages.push('📝 compiling information...');
      messages.push('🔍 verifying details...');
      messages.push('⚙️ assembling data...');
      messages.push('🎪 juggling options...');
      messages.push('🧩 piecing together...');
      messages.push('🎭 staging results...');
      messages.push('🔮 consulting database...');
      messages.push('📚 reviewing entries...');
      messages.push('🎯 targeting best matches...');
      messages.push('✅ validating choices...');
      messages.push('🌟 highlighting favorites...');
      messages.push('🏆 selecting top picks...');
      messages.push('📈 sorting by quality...');
      messages.push('🎨 curating collection...');
      messages.push('💎 finding gems...');
      messages.push('🔬 examining candidates...');
      messages.push('🎪 wrangling options...');
      messages.push('🧭 triangulating positions...');
      messages.push('📐 calculating distances...');
      messages.push('🎲 shuffling possibilities...');
      messages.push('🔄 cross-referencing...');
      messages.push('✨ finalizing selections...');
    }

    return messages;
  }
}
