/**
 * Rurubu MCP Client
 * Virtual MCP server for Rurubu API (Japan Tourism POIs)
 *
 * Provides MCP-style interface for searching Japanese points of interest
 * via the Rurubu API with JIS (Japanese Industrial Standard) code support
 */

import { geocodeLocation, extractJapaneseNames } from '@mapdemos/ai-framework/map';

export class RurubuMCPClient {
  constructor(config, app = null) {
    this.config = config;  // Store config for Mapbox access token
    this.app = app;  // Reference to main app for addSearchToHistory
    this.appId = config.RURUBU_APP_ID;
    this.endpoint = config.RURUBU_ENDPOINT;
    this.imageBaseUrl = config.RURUBU_IMAGE_BASE_URL;
    this.jisData = null;

    // Get base path for deployed environment (e.g., /japan-daytrip-mcp/)
    this.basePath = import.meta.env?.BASE_URL || '/';

    // Category mapping: user-friendly names to Rurubu lgenre codes
    this.categoryMap = {
      see: '1',        // 見る - Sightseeing / Tourism
      play: '2',       // 遊ぶ - Play / Entertainment / Activities
      eat: '3',        // 食べる - Restaurants / Dining
      cafe: '4',       // 喫茶・甘味 - Cafes / Sweets / Tea houses
      nightlife: '5',  // ナイトスポット - Night Spots / Bars / Clubs
      buy: '6',        // 買う - Shopping
      onsen: '7',      // 温泉他 - Hot Springs / Onsen / Spas
      other: '9'       // その他 - Other
    };

    // Genre and filter data (loaded from CSVs)
    this.lgenreMap = null;  // Large genre lookup
    this.mgenreMap = null;  // Medium genre lookup
    this.sgenreMap = null;  // Small genre lookup
    this.socCodes = null;   // SOC filter codes
  }

  /**
   * Initialize the client by loading JIS code data and CSV specifications
   */
  async initialize() {
    try {
      // Load JIS code data
      const jisResponse = await fetch(`${this.basePath}data/jis.json`);
      if (!jisResponse.ok) {
        throw new Error(`Failed to load JIS data: ${jisResponse.statusText}`);
      }
      this.jisData = await jisResponse.json();

      // Load genre and filter CSV data
      await Promise.all([
        this.loadGenreData(),
        this.loadSOCData()
      ]);

      return true;
    } catch (error) {
      console.error('Failed to initialize Rurubu MCP client:', error);
      throw new Error(`Rurubu MCP initialization failed: ${error.message}`);
    }
  }

  /**
   * Parse CSV text to array of objects
   */
  parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    // Remove BOM if present and get headers
    const headers = lines[0].replace(/^\uFEFF/, '').split(',');
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',');
      const row = {};
      headers.forEach((header, index) => {
        row[header.trim()] = values[index]?.trim() || '';
      });
      data.push(row);
    }

    return data;
  }

  /**
   * Load genre master data from CSVs
   */
  async loadGenreData() {
    try {
      // Load Large Genre master
      const lgenreResponse = await fetch(`${this.basePath}data/LGenre_master.csv`);
      const lgenreText = await lgenreResponse.text();
      const lgenreData = this.parseCSV(lgenreText);
      this.lgenreMap = new Map(lgenreData.map(row => [row.SightLargeGenreCD, row.SightLargeGenreName]));

      // Load Medium Genre master
      const mgenreResponse = await fetch(`${this.basePath}data/MGenre_master.csv`);
      const mgenreText = await mgenreResponse.text();
      const mgenreData = this.parseCSV(mgenreText);
      this.mgenreMap = new Map(mgenreData.map(row => [row.SightMiddleGenreCD, {
        name: row.SightMiddleGenreName,
        largeGenre: row.SightLargeGenreCD
      }]));

      // Load Small Genre master
      const sgenreResponse = await fetch(`${this.basePath}data/SGenre_master.csv`);
      const sgenreText = await sgenreResponse.text();
      const sgenreData = this.parseCSV(sgenreText);
      this.sgenreMap = new Map(sgenreData.map(row => [row.SightGenreCD, {
        name: row.SightGenreName,
        mediumGenre: row.SightMiddleGenreCD
      }]));

    } catch (error) {
      console.warn('Failed to load genre data:', error.message);
      // Non-fatal - continue without genre enhancements
    }
  }

  /**
   * Load SOC (Special Object Code) filter data
   */
  async loadSOCData() {
    try {
      const socResponse = await fetch(`${this.basePath}data/levelcodes.csv`);
      const socText = await socResponse.text();
      const socData = this.parseCSV(socText);

      // Build SOC lookup by parameter name
      this.socCodes = new Map();
      socData.forEach(row => {
        const paramName = row['リクエスト時パラメーター名'];
        if (paramName && paramName.startsWith('SOC')) {
          if (!this.socCodes.has(paramName)) {
            this.socCodes.set(paramName, {
              code: row['特徴コード'],
              name: row['特徴コード名称'],
              levels: []
            });
          }
          this.socCodes.get(paramName).levels.push({
            code: row['特徴レベルコード'],
            name: row['特徴レベルコード名称']
          });
        }
      });

    } catch (error) {
      console.warn('Failed to load SOC data:', error.message);
      // Non-fatal - continue without SOC filter enhancements
    }
  }

  /**
   * List available tools (MCP-style)
   */
  listTools() {
    return [
      {
        name: 'search_rurubu_pois',
        description: 'Search for Japanese points of interest (POIs) by category and location. Automatically fetches ALL matching results via pagination (not limited to 100). Returns detailed information including photos, prices, and hours. Categories: see (sightseeing), play (entertainment/activities), eat (restaurants), cafe (cafes/sweets), nightlife (bars/clubs), buy (shopping), onsen (hot springs/spas), other. Locations can be city names in English or Japanese. Supports advanced genre and filter parameters for precise searches. NOTE: Results are stored in memory but NOT automatically displayed on map (prevents clutter). Use highlight_recommended_pois to show your curated picks (3-5 POIs). If user asks to see all results, use show_search_results tool.',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['see', 'play', 'eat', 'cafe', 'nightlife', 'buy', 'onsen', 'other'],
              description: 'Category of POI to search for: see (sightseeing/tourism), play (entertainment/activities), eat (restaurants/dining), cafe (cafes/sweets/tea houses), nightlife (bars/clubs/night spots), buy (shopping), onsen (hot springs/spas), other (miscellaneous)'
            },
            location: {
              type: 'string',
              description: 'Location name in English or Japanese (e.g., "Shibuya", "Tokyo", "Kyoto", "渋谷")'
            },
            jis_code: {
              type: 'string',
              description: 'Optional: Direct 5-digit JIS municipality code. If not provided, will be looked up from location name.'
            },
            limit: {
              type: 'number',
              default: 100,
              description: 'Results per page (1-100). The search will automatically fetch all pages to return ALL matching POIs.'
            },
            lgenre: {
              type: 'string',
              description: 'Optional: Large genre code for more specific searches. All codes: 1=See/Sightseeing, 2=Play/Entertainment, 3=Eat/Dining, 4=Cafe/Sweets, 5=Nightlife/Bars, 6=Shop, 7=Hot Springs/Onsen, 9=Other'
            },
            mgenre: {
              type: 'string',
              description: 'Optional: Medium genre code for precise filtering (26 codes). Common: 11=Temples/Shrines, 20=Theme Parks, 30=Japanese Food, 36=Noodles, 37=Foreign Cuisine, 40=Cafes/Sweets, 50=Izakaya/Bars, 60=Shopping, 71=Day Trip Onsen. Use get_genre_codes tool for complete list.'
            },
            sgenre: {
              type: 'string',
              description: 'Optional: Small genre code for specific POI types (134 codes). Common: 131=Temples/Shrines, 301=Sushi, 361=Ramen, 400=Cafe, 142=Gardens, 201=Theme Parks, 322=Italian, 510=Izakaya, 202=Pottery, 204=Farm/Fishing, 261=Hiking. For other genres, use get_genre_codes tool first.'
            },
            filters: {
              type: 'object',
              description: 'Optional: Advanced filters using SOC codes. Examples: {SOC2: "0"} for kids-friendly, {SOC9: "0"} for weather-proof, {SOC13: "1"} for lunch budget ¥1000-3000',
              additionalProperties: {
                type: 'string'
              }
            }
          },
          required: ['category', 'location']
        }
      },
      {
        name: 'get_jis_code',
        description: 'Convert a location name (city or ward) to JIS municipality code(s). JIS codes are 5-digit codes used to identify municipalities in Japan. Supports English and Japanese input.',
        inputSchema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City or ward name in English or Japanese (e.g., "Shibuya", "Tokyo", "渋谷区")'
            }
          },
          required: ['location']
        }
      },
      {
        name: 'get_genre_codes',
        description: 'Get complete lists of available genre codes for Rurubu POI searches. Returns all large, medium, and small genre codes with their Japanese names. Useful when you need specific genre codes beyond the popular examples shown in search_rurubu_pois parameters.',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['large', 'medium', 'small', 'all'],
              description: 'Type of genre codes to retrieve: "large" (lgenre, 8 codes), "medium" (mgenre, 26 codes), "small" (sgenre, 134 codes), or "all" (complete reference)'
            }
          },
          required: ['type']
        }
      }
    ];
  }

  /**
   * Execute a tool (MCP-style)
   * @param {string} toolName - Name of the tool to execute
   * @param {object} args - Tool arguments
   */
  async executeTool(toolName, args) {
    try {
      switch (toolName) {
        case 'search_rurubu_pois':
          return await this.searchPOIs(args);
        case 'get_jis_code':
          return this.getJISCode(args);
        case 'get_genre_codes':
          return this.getGenreCodes(args);
        default:
          throw new Error(`Unknown Rurubu tool: ${toolName}`);
      }
    } catch (error) {
      console.error(`[Rurubu MCP] Tool execution error:`, error);
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
   * Search JIS data for matching municipalities (extracted from getJISCode)
   */
  searchJISData(location) {
    return this.jisData.filter(entry => {
      if (!entry.city) return false;

      // Use startsWith for more precise matching to avoid false positives
      // e.g., "京都" should not match "東京" (Tokyo contains "京")
      const cityMatch =
        entry.city.startsWith(location) ||
        entry.city_kana.startsWith(location) ||
        entry.city === location ||
        entry.city_kana === location;

      const prefMatch =
        entry.prefecture.startsWith(location) ||
        entry.prefecture_kana.startsWith(location) ||
        entry.prefecture === location ||
        entry.prefecture_kana === location;

      return cityMatch || prefMatch;
    });
  }

  /**
   * Get JIS code(s) from location name with Mapbox Geocoding fallback
   */
  async getJISCode({ location }) {
    if (!this.jisData) {
      throw new Error('JIS data not loaded. Call initialize() first.');
    }


    // STEP 1: Try direct search first (for Japanese input or cached values)
    let results = this.searchJISData(location);

    if (results.length > 0) {
    }

    // STEP 2: If no results, use Mapbox Geocoding to normalize
    if (results.length === 0) {

      const geocodedData = await geocodeLocation(location, this.config.MAPBOX_ACCESS_TOKEN);

      if (geocodedData) {
        // Extract Japanese names from geocoding result
        const japaneseNames = extractJapaneseNames(geocodedData);

        // Try searching with each extracted name
        for (const name of japaneseNames) {
          results = this.searchJISData(name);
          if (results.length > 0) {
            break;
          }
        }

        // If still no results, log what we tried
        if (results.length === 0) {
          console.warn(`[Rurubu] No JIS codes found even after trying:`, japaneseNames);
        }
      } else {
        console.warn(`[Rurubu] Geocoding returned no results`);
      }
    }

    // STEP 3: Return error if no results found
    if (results.length === 0) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            location: location,
            message: `No JIS code found for location: ${location}. Tried geocoding but couldn't find a matching municipality.`,
            suggestions: [
              'Try using the full Japanese name (e.g., 渋谷区, 新宿区)',
              'Use the ward name with -ku: "Shibuya-ku"',
              'Try the prefecture name: "Tokyo", "Osaka", "Kyoto"'
            ]
          })
        }]
      };
    }

    // Extract 5-digit JIS codes (exclude codes ending in 0, which are prefectures)
    const jisCodes = results
      .map(r => r.code.substring(0, 5))
      .filter(code => !code.endsWith('0'))
      .filter((code, index, self) => self.indexOf(code) === index); // Unique codes

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          location: location,
          codes: jisCodes,
          primary: jisCodes[0],
          count: jisCodes.length,
          municipalities: results.slice(0, 5).map(r => ({
            code: r.code.substring(0, 5),
            name: `${r.prefecture}${r.city}`,
            kana: `${r.prefecture_kana}${r.city_kana}`
          }))
        }, null, 2)
      }]
    };
  }

  /**
   * Get genre codes with Japanese names for reference
   */
  getGenreCodes({ type }) {
    if (!this.lgenreMap || !this.mgenreMap || !this.sgenreMap) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Genre data not loaded. Genre codes are available but names may not be loaded.',
            note: 'You can still use genre codes directly - they are documented in the search_rurubu_pois tool parameters.'
          })
        }],
        isError: true
      };
    }

    let result = {};

    if (type === 'large' || type === 'all') {
      result.large_genres = Array.from(this.lgenreMap.entries()).map(([code, name]) => ({
        code,
        name,
        name_en: this.translateGenre(name, 'large')
      }));
    }

    if (type === 'medium' || type === 'all') {
      result.medium_genres = Array.from(this.mgenreMap.entries()).map(([code, data]) => ({
        code,
        name: data.name,
        name_en: this.translateGenre(data.name, 'medium'),
        large_genre: data.largeGenre
      }));
    }

    if (type === 'small' || type === 'all') {
      result.small_genres = Array.from(this.sgenreMap.entries()).map(([code, data]) => ({
        code,
        name: data.name,
        name_en: this.translateGenre(data.name, 'small'),
        medium_genre: data.mediumGenre
      }));
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result) // No formatting - save tokens
      }]
    };
  }

  /**
   * Simple genre name translation helper
   */
  translateGenre(japaneseName, type) {
    // Basic translations for common genres (can be expanded)
    const translations = {
      '見る': 'See/Sightseeing',
      '遊ぶ': 'Play/Entertainment',
      '食べる': 'Eat/Dining',
      '喫茶・甘味': 'Cafe/Sweets',
      'ナイトスポット': 'Nightlife',
      '買う': 'Shop/Shopping',
      '温泉他': 'Hot Springs/Onsen',
      'その他': 'Other',
      '自然': 'Nature',
      '社寺・教会': 'Temples/Shrines/Churches',
      '建物・史跡': 'Buildings/Historic Sites',
      '動植物園・公園': 'Zoos/Gardens/Parks',
      '美術館・博物館': 'Museums/Art Museums'
    };

    return translations[japaneseName] || japaneseName;
  }

  /**
   * Search POIs via Rurubu API with automatic pagination to fetch all results
   */
  async searchPOIs({ category, location, jis_code, limit = 100, lgenre, mgenre, sgenre, filters = {} }) {
    // Validate category
    if (!this.categoryMap[category]) {
      throw new Error(`Invalid category: ${category}. Must be one of: see, play, eat, cafe, nightlife, buy, onsen, other`);
    }

    // Use AI-provided lgenre if specified, otherwise use category mapping
    const finalLgenre = lgenre || this.categoryMap[category];

    // Get JIS code(s) if not provided
    let jisCodes = [];
    if (!jis_code) {
      const jisResult = await this.getJISCode({ location });
      const jisData = JSON.parse(jisResult.content[0].text);

      if (!jisData.success) {
        return jisResult; // Return the error
      }

      // Use ALL JIS codes for comprehensive coverage
      jisCodes = jisData.codes || [jisData.primary];
    } else {
      jisCodes = [jis_code];
    }

    // Ensure limit is within bounds (per page)
    limit = Math.min(Math.max(limit, 1), 100);

    try {
      // Search all JIS codes in parallel
      const searchPromises = jisCodes.map(code => {
        return this.searchSingleJISCode({
          jis_code: code,
          category,
          location,
          finalLgenre,
          limit,
          mgenre,
          sgenre,
          filters
        });
      });

      const results = await Promise.all(searchPromises);

      // Aggregate all features from all searches
      const allFeatures = [];
      let totalPages = 0;

      results.forEach(result => {
        allFeatures.push(...result.features);
        totalPages += result.pages;
      });

      // Deduplicate by POI ID (if available)
      const uniqueFeatures = this.deduplicateFeatures(allFeatures);

      // Sort by rank/rating (highest first)
      uniqueFeatures.sort((a, b) => {
        const rankA = a.properties?.rank || a.properties?.rating || 0;
        const rankB = b.properties?.rank || b.properties?.rating || 0;
        return rankB - rankA; // Descending order (highest rank first)
      });

      // Build final GeoJSON with all features (no cap)
      const finalGeoJSON = {
        type: 'FeatureCollection',
        features: uniqueFeatures
      };

      // Add search to history and get search ID
      const searchId = await this.app.storeSearchData(finalGeoJSON, {
        category: category,
        location: location,
        jis_code: jisCodes[0], // Primary JIS code
        pages: totalPages
      });

      // Prepare result with search ID
      const result = {
        search_id: searchId, // Include search ID so Claude can reference it later
        category: category,
        location: location,
        jis_codes: jisCodes,
        count: uniqueFeatures.length,
        pages: totalPages,
        geojson: finalGeoJSON
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result) // No formatting - save tokens
        }]
      };

    } catch (error) {
      throw new Error(`Failed to fetch POIs: ${error.message}`);
    }
  }

  /**
   * Search a single JIS code with pagination and robust error handling
   * Helper method for parallel searches
   */
  async searchSingleJISCode({ jis_code, category, location, finalLgenre, limit, mgenre, sgenre, filters }) {
    const TIMEOUT_MS = 20000; // 20 second timeout per request
    const MAX_PAGES = 10; // Cap pagination to prevent infinite loops
    const MAX_RETRIES = 3; // Max retries per page

    // STEP 1: Fetch first page to get total page count
    const firstPageData = await this.fetchPage({
      jis_code,
      finalLgenre,
      limit,
      mgenre,
      sgenre,
      filters,
      pageNo: 1,
      TIMEOUT_MS,
      MAX_RETRIES
    });

    if (!firstPageData) {
      console.warn(`[Rurubu MCP] Failed to fetch first page for JIS ${jis_code}`);
      return { features: [], pages: 0, failedPages: 1 };
    }

    const allFeatures = [];
    let totalPages = 1;

    // Extract features from first page
    const firstPageGeoJSON = this.convertToGeoJSON(firstPageData, category);
    if (firstPageGeoJSON?.features?.length > 0) {
      allFeatures.push(...firstPageGeoJSON.features);
    }

    // Get total pages from API response
    if (firstPageData[0]?.TotalPages) {
      totalPages = Math.min(firstPageData[0].TotalPages, MAX_PAGES);
    }

    // STEP 2: Fetch remaining pages in parallel if there are more pages
    if (totalPages > 1) {
      const pageNumbers = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

      const pagePromises = pageNumbers.map(pageNo =>
        this.fetchPage({
          jis_code,
          finalLgenre,
          limit,
          mgenre,
          sgenre,
          filters,
          pageNo,
          TIMEOUT_MS,
          MAX_RETRIES
        })
      );

      const pageResults = await Promise.allSettled(pagePromises);

      let successCount = 0;
      let failedCount = 0;

      pageResults.forEach((result, index) => {
        const pageNo = pageNumbers[index];
        if (result.status === 'fulfilled' && result.value) {
          const geojson = this.convertToGeoJSON(result.value, category);
          if (geojson?.features?.length > 0) {
            allFeatures.push(...geojson.features);
            successCount++;
          }
        } else {
          failedCount++;
        }
      });
    }

    return {
      features: allFeatures,
      pages: totalPages,
      failedPages: totalPages - 1 - (allFeatures.length > 0 ? 1 : 0)
    };
  }

  /**
   * Fetch a single page with retry logic
   */
  async fetchPage({ jis_code, finalLgenre, limit, mgenre, sgenre, filters, pageNo, TIMEOUT_MS, MAX_RETRIES }) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Build API URL with base parameters
        const params = new URLSearchParams({
          appid: this.appId,
          jis: jis_code,
          lgenre: finalLgenre,
          pagecount: limit.toString(),
          pageno: pageNo.toString(),
          responsetype: 'json'
        });

        // Add optional parameters
        if (mgenre) params.append('mgenre', mgenre);
        if (sgenre) params.append('sgenre', sgenre);

        // Add SOC filters
        if (filters && typeof filters === 'object') {
          for (const [key, value] of Object.entries(filters)) {
            if (key.startsWith('SOC') && value !== undefined && value !== null) {
              params.append(key, value.toString());
            }
          }
        }

        const url = `${this.endpoint}?${params.toString()}`;

        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 429 && attempt < MAX_RETRIES) {
            console.warn(`[Rurubu MCP] Rate limit hit for page ${pageNo}, retry ${attempt}/${MAX_RETRIES}`);
            await this.sleep(2000 * attempt); // Exponential backoff
            continue;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Validate response structure
        if (!data || !Array.isArray(data) || data.length === 0) {
          return null;
        }

        return data;

      } catch (error) {
        if (attempt === MAX_RETRIES) {
          console.error(`[Rurubu MCP] Failed to fetch page ${pageNo} after ${MAX_RETRIES} attempts:`, error.message);
          return null;
        }
        await this.sleep(1000 * attempt);
      }
    }
    return null;
  }

  /**
   * Helper method to sleep for a given duration
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Deduplicate features by POI ID
   */
  deduplicateFeatures(features) {
    const seen = new Set();
    return features.filter(feature => {
      const id = feature.properties?.id || feature.properties?.name;
      if (!id || seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }

  /**
   * Convert Rurubu API response to GeoJSON format
   */
  convertToGeoJSON(data, category) {
    if (!data || !data[0] || !data[0].SightList) {
      return {
        type: 'FeatureCollection',
        features: []
      };
    }

    const sightList = data[0].SightList;

    // Filter and map to GeoJSON features
    const features = sightList
      .filter(item => {
        // Must have coordinates
        return item.LongitudeW10 && item.LatitudeW10;
      })
      .map(item => {
        // Extract genre codes from GenreList
        let lgenreCode = null;
        let mgenreCode = null;
        let sgenreCode = null;
        let sgenreName = null;

        if (item.GenreList && item.GenreList.length > 0) {
          const genre = item.GenreList[0];
          lgenreCode = genre.LGenre?.Code || null;
          mgenreCode = genre.MGenre?.Code || null;
          sgenreCode = genre.Genre?.Code || null;
          sgenreName = genre.Genre?.Name || null;
        }

        const properties = {
          // Basic info
          id: item.SightID,
          name: item.Title,
          kana: item.Kana || '',
          address: item.Address || '',
          category: category,

          // Genre codes
          lgenre: lgenreCode,
          mgenre: mgenreCode,
          sgenre: sgenreCode,
          sgenreName: sgenreName,

          // Details
          summary: item.Summary || '',
          time: item.Time || '',
          tel: item.Tel || '',
          price: item.Price || '',
          rank: item.Rank ? String(item.Rank).replace(/おすすめ度/g, '').trim().replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) : 0,

          // Photos
          photo: null,
          photos: []
        };

        // Add photo URLs
        if (item.PhotoList && item.PhotoList.length > 0) {
          properties.photo = this.imageBaseUrl + item.PhotoList[0].URL;
          properties.photos = item.PhotoList.map(p => this.imageBaseUrl + p.URL);
        }

        return {
          type: 'Feature',
          properties: properties,
          geometry: {
            type: 'Point',
            coordinates: [
              Number(item.LongitudeW10),
              Number(item.LatitudeW10)
            ]
          }
        };
      });

    return {
      type: 'FeatureCollection',
      features: features
    };
  }

  /**
   * Get tool definition by name
   */
  getToolDefinition(toolName) {
    return this.listTools().find(tool => tool.name === toolName);
  }

  /**
   * Get all tools formatted for Claude API
   */
  getToolsForClaude() {
    return this.listTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    }));
  }
}
