/**
 * Rurubu MCP Client
 * Virtual MCP server for Rurubu API (Japan Tourism POIs)
 *
 * Provides MCP-style interface for searching Japanese points of interest
 * via the Rurubu API with JIS (Japanese Industrial Standard) code support
 */

import { geocodeLocation, extractJapaneseNames } from './mapbox-service-utils.js';

export class RurubuMCPClient {
  constructor(config) {
    this.config = config;  // Store config for Mapbox access token
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
        description: 'Search for Japanese points of interest (POIs) by category and location. Automatically fetches ALL matching results via pagination (not limited to 100). Returns detailed information including photos, prices, and hours. Categories: see (sightseeing), play (entertainment/activities), eat (restaurants), cafe (cafes/sweets), nightlife (bars/clubs), buy (shopping), onsen (hot springs/spas), other. Locations can be city names in English or Japanese. Supports advanced genre and filter parameters for precise searches.',
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
              description: 'Optional: Medium genre code for precise category filtering. Available codes: SEE (lgenre=1): 10=Nature, 11=Temples/Shrines/Churches, 12=Buildings/Historic Sites, 13=Zoos/Gardens/Parks, 14=Museums/Art Museums, 19=Other | PLAY (lgenre=2): 20=Theme Parks, 21=Outdoor/Sports, 22=Experience Facilities, 29=Other | EAT (lgenre=3): 30=Japanese Food, 32=Western Food, 36=Noodles, 37=Foreign Cuisine, 38=Flour-based (okonomiyaki/takoyaki), 39=Other | CAFE (lgenre=4): 40=Cafes/Sweets | NIGHTLIFE (lgenre=5): 50=Izakaya/Bars | BUY (lgenre=6): 60=Shopping Buildings, 61=Fashion/Goods, 62=Folk Crafts, 63=Groceries/Alcohol | ONSEN (lgenre=7): 71=Day Trip Onsen, 72=Bathing Facilities, 73=Other Onsen | OTHER (lgenre=9): 91=Other'
            },
            sgenre: {
              type: 'string',
              description: 'Optional: Small genre code for ultra-specific filtering (134 codes available, use get_genre_codes tool for complete list). Popular examples: NATURE: 101=Lakes/Ponds, 102=Capes/Coasts, 103=Rivers/Waterfalls, 104=Mountains, 108=Highlands/Forests, 122=Cherry Blossom Spots, 123=Autumn Foliage Spots | TEMPLES/CULTURE: 131=Temples/Shrines, 132=Historic Buildings, 134=Ruins/Castles, 135=Towers/Observation Decks, 136=Streets/Walking Areas | ATTRACTIONS: 141=Parks, 142=Gardens, 144=Zoos, 145=Aquariums, 146=Combined Zoo/Aquarium, 201=Theme Parks | MUSEUMS: 151=History Museums, 152=Art Museums, 153=Libraries, 154=Memorial Halls | EXPERIENCES: 202=Pottery/Crafts, 203=Cooking, 204=Farm/Fishing, 205=Farm/Orchard Tours, 206=Spa/Massage | OUTDOOR/SPORTS: 211=Tennis, 212=Golf, 221=Beaches, 222=Pools, 223=Fishing, 224=Rafting, 251=Camping/BBQ, 261=Hiking Trails, 262=Cycling | JAPANESE FOOD: 300=Japanese Cuisine, 301=Sushi, 302=Seafood, 303=Chicken, 304=Yakiniku/BBQ, 305=Local Cuisine, 306=Tempura, 307=Tonkatsu, 308=Unagi/Eel | NOODLES: 361=Ramen, 363=Yakisoba, 365=Other Noodles, 368=Soba/Udon | WESTERN/ASIAN: 311=Western Restaurant, 321=French, 322=Italian, 323=Spanish, 324=Thai, 325=Korean, 326=Asian, 330=Chinese, 345=Curry/Indian | OTHER FOOD: 371=Okonomiyaki, 372=Takoyaki, 362=Gyoza | CAFES/SWEETS: 400=Cafe, 410=Cake/Desserts, 420=Tea House | BARS: 510=Izakaya, 511=Beer/Wine, 520=Bar, 530=Club/Live Music | SHOPPING: 600=Department Stores, 610=Fashion, 620=Interior/Goods, 630=Crafts/Pottery, 640=Food/Sake, 650=Sweets, 660=Farm Products | ONSEN: 701=Day-trip Onsen, 702=Bath Facilities. Use get_genre_codes tool to see all 134 codes with Japanese names.'
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

      const cityMatch =
        entry.city.includes(location) ||
        entry.city_kana.includes(location) ||
        location.includes(entry.city);

      const prefMatch =
        entry.prefecture.includes(location) ||
        entry.prefecture_kana.includes(location) ||
        location.includes(entry.prefecture);

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
        text: JSON.stringify(result, null, 2)
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
      console.log(`[Rurubu MCP] Found ${jisCodes.length} JIS codes for ${location}, will search all in parallel`);
    } else {
      jisCodes = [jis_code];
    }

    // Ensure limit is within bounds (per page)
    limit = Math.min(Math.max(limit, 1), 100);

    try {
      // Search all JIS codes in parallel

      const searchPromises = jisCodes.map(code =>
        this.searchSingleJISCode({
          jis_code: code,
          category,
          location,
          finalLgenre,
          limit,
          mgenre,
          sgenre,
          filters
        })
      );

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


      // Build final GeoJSON with all features
      const finalGeoJSON = {
        type: 'FeatureCollection',
        features: uniqueFeatures
      };

      // Prepare result
      const result = {
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
          text: JSON.stringify(result, null, 2)
        }]
      };

    } catch (error) {
      throw new Error(`Failed to fetch POIs: ${error.message}`);
    }
  }

  /**
   * Search a single JIS code with pagination
   * Helper method for parallel searches
   */
  async searchSingleJISCode({ jis_code, category, location, finalLgenre, limit, mgenre, sgenre, filters }) {

    const allFeatures = [];
    let pageNo = 1;
    let totalPages = 1;

    while (pageNo <= totalPages) {
      // Build API URL with base parameters
      const params = new URLSearchParams({
        appid: this.appId,
        jis: jis_code,
        lgenre: finalLgenre,
        pagecount: limit.toString(),
        pageno: pageNo.toString(),
        responsetype: 'json'
      });

      // Add optional medium genre
      if (mgenre) {
        params.append('mgenre', mgenre);
      }

      // Add optional small genre
      if (sgenre) {
        params.append('sgenre', sgenre);
      }

      // Add SOC filters
      for (const [key, value] of Object.entries(filters)) {
        if (key.startsWith('SOC') && value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      }

      const url = `${this.endpoint}?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.warn(`[Rurubu MCP] API error for JIS ${jis_code}: ${response.status}`);
        break; // Skip this JIS code if error
      }

      const data = await response.json();

      // Update total pages from API response
      if (data[0] && data[0].TotalPages) {
        totalPages = data[0].TotalPages;
      }

      // Convert to GeoJSON and collect features
      const geojson = this.convertToGeoJSON(data, category);
      allFeatures.push(...geojson.features);

      pageNo++;
    }


    return {
      features: allFeatures,
      pages: totalPages
    };
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
          rank: item.Rank || 0,

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
