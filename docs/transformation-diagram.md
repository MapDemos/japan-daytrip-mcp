# Visual Transformation: Search Engine → Human Travel Agent

## Current Flow (Search Engine Mode)

```
USER: "Show me temples in Kyoto"
  ↓
CLAUDE: [Immediate Action]
  ├─ search_rurubu_pois(category="see", location="Kyoto", limit=100)
  ├─ search_rurubu_pois(category="eat", location="Kyoto", limit=100)
  └─ search_rurubu_pois(category="cafe", location="Kyoto", limit=100)
  ↓
RESULTS: 300+ POIs found
  ↓
CLAUDE: get_poi_summary() → All 300 POIs
  ↓
CLAUDE: [Mechanical Ranking]
  └─ Sort by rating (5.0 > 4.9 > 4.8 > ...)
  ↓
RESPONSE: "I found 47 temples in Kyoto:
  1. ⭐⭐⭐⭐⭐ Temple A (5.0 stars)
  2. ⭐⭐⭐⭐⭐ Temple B (4.9 stars)
  3. ⭐⭐⭐⭐⭐ Temple C (4.8 stars)
  [... 44 more ...]"
  ↓
USER: [Overwhelmed] 😵

PROBLEMS:
❌ No understanding of user preferences
❌ Searches everything blindly (temples + restaurants + cafes)
❌ Returns massive result sets (100+ POIs per search)
❌ Mechanical ranking (rating only)
❌ No curation or narrative
❌ No explanation or reasoning
❌ Overwhelming user experience
```

---

## New Flow (Human Travel Agent Mode)

```
USER: "Show me temples in Kyoto"
  ↓
CLAUDE: [Discovery Phase] 🎯
  "I'd love to help you explore Kyoto's temple heritage!
   There are hundreds of temples, each with different character.

   Tell me:
   - Are you drawn to Zen gardens, or grand architecture?
   - Prefer quiet contemplative spaces or lively pilgrimage sites?
   - Any particular area of Kyoto?

   This helps me recommend temples you'll truly connect with."
  ↓
USER: "Love Zen gardens, prefer quiet spaces, staying near Gion"
  ↓
CLAUDE: [Hypothesis Phase] 💡
  "Perfect - Zen gardens in quieter settings near Gion.
   I'm thinking east side temples with contemplative gardens,
   away from tour bus crowds. Let me check what's available..."
  ↓
CLAUDE: [Targeted Search] 🔍
  └─ search_rurubu_pois(
       category="see",
       location="Kyoto Higashiyama-ku",
       sgenre="131",  // Temples/shrines genre code
       limit=15       // Focused results
     )
  ↓
RESULTS: 15 relevant POIs found
  ↓
CLAUDE: [Review Details] 📋
  └─ get_poi_summary() → 15 POIs with details
  ↓
CLAUDE: [Curation Phase] ✨
  Read all 15 POI descriptions
  ├─ Filter: Match "Zen garden" + "quiet"
  ├─ Evaluate: Story, uniqueness, practical factors
  ├─ Select: 3 best fits (not just highest-rated)
  └─ Prepare: Reasoning for each pick
  ↓
CLAUDE: [Starring] ⭐
  └─ highlight_recommended_pois([
       {id: "12345", name: "銀閣寺", coordinates: [...]},
       {id: "67890", name: "法然院", coordinates: [...]},
       {id: "54321", name: "詩仙堂", coordinates: [...]}
     ])
  ↓
RESPONSE: [Narrative Presentation] 📖
  "I found several beautiful options. These 3 match your
   preference for Zen gardens and quiet spaces:

   1. **銀閣寺** (Ginkaku-ji) - ¥500, 8:30-17:00
      Why I picked this: The approach walk through bamboo
      groves sets a meditative tone before you enter. The
      dry sand garden (designed for moonlight viewing) is
      pure Zen philosophy. Morning visits are nearly empty.

   2. **法然院** - Free, 9:00-16:00
      Why I picked this: Hidden gem most tourists miss.
      Tiny thatched gate temple with raked sand garden
      that changes with seasons. Profoundly peaceful.

   3. **詩仙堂** - ¥500, 9:00-17:00
      Why I picked this: Combines garden with poetry.
      Bamboo fountains create natural rhythm. Built by
      a scholar, so intellectual quietness.

   All three are walkable from Gion (20-30 min).
   Want me to plot a walking route?"
  ↓
USER: [Satisfied] 😊 "Perfect! Show me the route."

BENEFITS:
✅ Understands user preferences first
✅ Targeted search (15 POIs, not 300)
✅ Thoughtful curation (3 picks, not 47)
✅ Narrative explanations with reasoning
✅ Personal insights and local knowledge
✅ Manageable, not overwhelming
✅ Natural conversation flow
```

---

## Comparison Table

| Aspect | Search Engine Mode | Human Travel Agent Mode |
|--------|-------------------|------------------------|
| **First Response** | Immediate search | Questions to understand |
| **Search Strategy** | Exhaustive (multiple parallel) | Targeted (single focused) |
| **Search Limit** | 100 POIs per search | 10-15 POIs per search |
| **Total POIs Found** | 100-300 | 10-30 |
| **POIs Shown** | All results (30-50) | Curated subset (3-5) |
| **Selection Criteria** | Rating only | Fit + variety + story + practical |
| **Explanation** | Generic ("highly rated") | Personal ("I picked this because...") |
| **Genre Codes** | Rarely used | Frequently used (after get_genre_codes) |
| **User Experience** | Overwhelming | Manageable |
| **Personalization** | None | High |
| **Conversation** | One-shot Q&A | Multi-turn dialogue |

---

## Multi-Phase Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    HUMAN TRAVEL AGENT WORKFLOW               │
└─────────────────────────────────────────────────────────────┘

PHASE 1: DISCOVERY 🎯
┌─────────────────────────────────────────┐
│ User asks vague/broad question          │
│ "Show me temples in Kyoto"              │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ Claude asks clarifying questions        │
│ - What interests you? (Zen vs grand)    │
│ - Travel style? (quiet vs lively)       │
│ - Constraints? (area, time, budget)     │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ User provides context                   │
│ "Love Zen gardens, quiet, near Gion"    │
└────────────┬────────────────────────────┘
             ↓
PHASE 2: HYPOTHESIS 💡
┌─────────────────────────────────────────┐
│ Claude forms hypothesis (think aloud)   │
│ "I'm thinking east side temples with    │
│  contemplative gardens, away from       │
│  crowds..."                             │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ Claude checks genre codes (if needed)   │
│ get_genre_codes(type="small")           │
│ → Find relevant codes                   │
└────────────┬────────────────────────────┘
             ↓
PHASE 3: TARGETED SEARCH 🔍
┌─────────────────────────────────────────┐
│ Claude searches with intent             │
│ search_rurubu_pois(                     │
│   category="see",                       │
│   location="Kyoto Higashiyama-ku",      │
│   sgenre="131",                         │
│   limit=15                              │
│ )                                       │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ Results: 15 relevant POIs               │
│ Auto-displayed on map                   │
└────────────┬────────────────────────────┘
             ↓
PHASE 4: CURATION ✨
┌─────────────────────────────────────────┐
│ Claude reviews details                  │
│ get_poi_summary() → All POI info        │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ Claude evaluates each POI               │
│ - Matches user preferences?             │
│ - Unique story/character?               │
│ - Practical (location, price, hours)?   │
│ - Variety in selection?                 │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ Claude selects 3-5 best fits            │
│ Not just highest-rated!                 │
│ Narrative cohesion matters              │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ Claude stars selections on map          │
│ highlight_recommended_pois([...])       │
└────────────┬────────────────────────────┘
             ↓
PHASE 5: PRESENTATION 📖
┌─────────────────────────────────────────┐
│ Claude presents with reasoning          │
│ - Brief intro explaining thinking       │
│ - 3-5 recommendations with:             │
│   * Name (Japanese preserved)           │
│   * Why I picked this (specific)        │
│   * Key details (price, hours)          │
│   * Personal insight (story/context)    │
│ - Offer to adjust or add more           │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ User responds                           │
│ - "Perfect!" → Done                     │
│ - "Too touristy" → Refine search        │
│ - "Add lunch" → New search cycle        │
└────────────┬────────────────────────────┘
             ↓
PHASE 6: REFINEMENT 🔄 (Optional)
┌─────────────────────────────────────────┐
│ Claude adjusts based on feedback        │
│ - Different style → New hypothesis      │
│ - Different area → New location         │
│ - More options → Show additional POIs   │
│ - Add category → New search             │
└─────────────────────────────────────────┘

EXCEPTIONS:
- Very specific requests can skip Phase 1 (Discovery)
- Infrastructure queries (hospitals, stations) skip all phases
  and go directly to search_location tool
```

---

## Tool Usage Pattern Comparison

### OLD PATTERN: Parallel Search Explosion

```
User: "Plan a day in Kamakura"
  ↓
Claude: [Searches everything in parallel]
  ├─ search_rurubu_pois(category="see", limit=100)     → 100 POIs
  ├─ search_rurubu_pois(category="play", limit=100)    → 100 POIs
  ├─ search_rurubu_pois(category="eat", limit=100)     → 100 POIs
  ├─ search_rurubu_pois(category="cafe", limit=100)    → 100 POIs
  └─ search_rurubu_pois(category="buy", limit=100)     → 100 POIs
  ↓
TOTAL: 500 POIs searched
  ↓
Claude: [Shows all results]
  "I found:
   - 37 sightseeing spots
   - 42 activities
   - 156 restaurants
   - 89 cafes
   - 176 shops

   Here are the top 50..."
  ↓
USER: [Overwhelmed] 😵
```

### NEW PATTERN: Sequential Targeted Search

```
User: "Plan a day in Kamakura with kids (age 8, 10)"
  ↓
Claude: [Discovery]
  "Active kids or prefer easier pace?"
  ↓
User: "Very active, love trying new things"
  ↓
Claude: [Hypothesis]
  "For active, adventurous kids, I'm thinking hands-on
   experiences. Let me check what's available..."
  ↓
Claude: [Search 1: Activities]
  ├─ get_genre_codes(type="small")  → Find activity codes
  └─ search_rurubu_pois(
       category="play",
       location="Kamakura",
       sgenre="204",  // Farm/hands-on experiences
       limit=15
     )
  ↓
RESULTS: 15 relevant activities
  ↓
Claude: [Curates 2-3 activities, presents]
  "Great hands-on options:
   1. Pottery workshop
   2. Beach activities
   3. Temple treasure hunt"
  ↓
User: "Love it! Add lunch recommendations"
  ↓
Claude: [Search 2: Lunch]
  └─ search_rurubu_pois(
       category="eat",
       location="Kamakura",
       limit=15
     )
  ↓
RESULTS: 15 restaurants
  ↓
Claude: [Curates 2 lunch spots]
  "For lunch between activities:
   1. Soba-making workshop (hands-on!)
   2. Beach-side seafood"
  ↓
USER: [Satisfied] 😊

TOTAL: 30 POIs searched (94% reduction)
       4-5 POIs recommended (clear, manageable)
```

---

## Behavioral Decision Tree

```
                    USER QUERY
                        ↓
        ┌───────────────┴───────────────┐
        ↓                               ↓
   VAGUE REQUEST                  SPECIFIC REQUEST
   "Show me temples"              "Ramen in Shibuya <¥1000"
        ↓                               ↓
   ASK QUESTIONS                   CAN SKIP DISCOVERY
   (Discovery Phase)               (Hypothesis Phase)
        ↓                               ↓
   USER RESPONDS                   FORM HYPOTHESIS
        ↓                               ↓
   ┌────┴────┐                     ┌────┴────┐
   ↓         ↓                     ↓         ↓
CLEAR     UNCLEAR              COMMON    UNUSUAL
GENRE     GENRE                GENRE     GENRE
   ↓         ↓                     ↓         ↓
SEARCH    GET_GENRE            SEARCH    GET_GENRE
DIRECTLY  CODES FIRST          DIRECTLY  CODES FIRST
   ↓         ↓                     ↓         ↓
   └────┬────┘                     └────┬────┘
        ↓                               ↓
   TARGETED SEARCH                 TARGETED SEARCH
   (limit=10-15)                   (limit=10-15)
        ↓                               ↓
   GET_POI_SUMMARY                 GET_POI_SUMMARY
        ↓                               ↓
   CURATE 3-5 POIS                 CURATE 3-5 POIS
        ↓                               ↓
   HIGHLIGHT_POIS                  HIGHLIGHT_POIS
        ↓                               ↓
   PRESENT WITH                    PRESENT WITH
   REASONING                       REASONING
        ↓                               ↓
        └───────────────┬───────────────┘
                        ↓
                   USER FEEDBACK
                        ↓
        ┌───────────────┼───────────────┐
        ↓               ↓               ↓
   SATISFIED       ADJUST          ADD MORE
   (Done)          (Refine)        (New Search)
```

---

## Token Usage Comparison

### Current Prompt Structure (230 lines, ~5000 tokens)
```
┌────────────────────────────────────────┐
│ Map context: 50 tokens                 │
├────────────────────────────────────────┤
│ Data format: 400 tokens                │
├────────────────────────────────────────┤
│ Tool strategy: 800 tokens              │
├────────────────────────────────────────┤
│ Tool selection: 600 tokens             │
├────────────────────────────────────────┤
│ Core rules: 2500 tokens (!!!)          │
├────────────────────────────────────────┤
│ Itinerary workflow: 200 tokens         │
├────────────────────────────────────────┤
│ Response style: 150 tokens             │
├────────────────────────────────────────┤
│ Location handling: 300 tokens          │
└────────────────────────────────────────┘
TOTAL: ~5000 tokens
90% technical, 10% behavioral
```

### New Prompt Structure (similar lines, ~4500 tokens)
```
┌────────────────────────────────────────┐
│ Map context: 50 tokens                 │
├────────────────────────────────────────┤
│ Identity & role: 400 tokens (NEW!)     │
├────────────────────────────────────────┤
│ Core principles: 600 tokens (NEW!)     │
├────────────────────────────────────────┤
│ Anti-patterns: 200 tokens (NEW!)       │
├────────────────────────────────────────┤
│ Tool guidelines: 1500 tokens           │
├────────────────────────────────────────┤
│ Examples: 800 tokens (NEW!)            │
├────────────────────────────────────────┤
│ Technical constraints: 500 tokens      │
├────────────────────────────────────────┤
│ Workflow summary: 150 tokens           │
├────────────────────────────────────────┤
│ Language handling: 150 tokens          │
├────────────────────────────────────────┤
│ Data format: 150 tokens (compressed)   │
└────────────────────────────────────────┘
TOTAL: ~4500 tokens (10% reduction)
60% behavioral, 40% technical
```

**Key Improvements:**
- 10% token reduction through consolidation
- 6x increase in behavioral guidance (400 → 2400 tokens)
- More concrete examples (0 → 800 tokens)
- Clearer anti-patterns (implicit → 200 tokens)
- Streamlined technical details (3500 → 1800 tokens)

---

## Success Metrics Visualization

```
BEHAVIORAL METRICS (Target: ↑ Increase)

Questions Asked Per Conversation:
Before: █ 0-1
After:  ████ 2-4 (✓ 300% increase)

User Follow-Up Rate:
Before: ███ 30%
After:  ██████ 60% (✓ 100% increase)

"Felt Personalized" Score (/5):
Before: ███ 3.2
After:  ████ 4.3 (✓ 34% increase)

───────────────────────────────────────

EFFICIENCY METRICS (Target: ↓ Decrease)

Searches Per Conversation:
Before: █████ 3-5
After:  ██ 1-2 (✓ 60% reduction)

POIs Found Per Search:
Before: ██████████ 100-300
After:  ██ 10-30 (✓ 85% reduction)

POIs Shown Per Response:
Before: ████████ 10-30
After:  ██ 3-5 (✓ 70% reduction)

───────────────────────────────────────

QUALITY METRICS (Target: ↑ Increase)

Has "Why I Picked This" Reasoning:
Before: █ 10%
After:  ██████████ 100% (✓ 10x increase)

Genre Code Usage:
Before: █ 5%
After:  ████ 20%+ (✓ 4x increase)

Narrative Cohesion Score (/5):
Before: ██ 2.1
After:  ████ 4.2 (✓ 2x increase)
```

---

**Visual Summary:** From mechanical search engine to thoughtful travel consultant through identity-first, principle-based prompt engineering.
