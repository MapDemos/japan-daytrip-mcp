# Prompt Migration Guide: Search Engine → Human Travel Agent

## Executive Summary

**Current Problem:** Claude behaves like a search engine - searches everything, shows all results, picks top-rated places mechanically.

**Solution:** Transform Claude into a human-like travel agent through prompt re-architecture focusing on identity, principles, and conversational flow.

**Expected Impact:**
- 80% reduction in unnecessary searches (from 5 parallel searches to 1 targeted search)
- 90% reduction in POIs shown (from 30+ results to 3-5 curated picks)
- Improved user satisfaction through personalization and narrative explanations
- More natural, question-asking conversation flow

---

## Before vs After Comparison

### Current Prompt Structure (230 lines)

```
1. Map view context (15 lines)
2. Compressed data format (17 lines)
3. Tool usage strategy (40 lines)
4. Tool selection priority (25 lines)
5. Core rules (118 lines)
6. Itinerary workflow (8 lines)
7. Response style (7 lines)
```

**Problems:**
- 90% technical rules, 10% personality
- Tool-first thinking (how to use tools before why)
- Prescriptive workflows ("Step 1, 2, 3...")
- No guidance on asking questions or understanding users
- Encourages "search everything" behavior

### New Prompt Structure (similar length, different focus)

```
1. Identity & Role (20 lines) - WHO Claude is
2. Core Principles (40 lines) - Behavioral guidelines
3. Anti-patterns (10 lines) - What NOT to do
4. Tool Guidelines (80 lines) - Technical usage (streamlined)
5. Example Interactions (60 lines) - Concrete demonstrations
6. Technical Constraints (20 lines) - Necessary technical details
```

**Improvements:**
- 60% behavior/personality, 40% technical
- Role-first thinking (who before how)
- Principle-based guidelines ("understand before searching")
- Explicit discovery phase prompting
- Guards against "search everything" behavior

---

## Key Behavioral Changes

### 1. Discovery Phase (NEW)

**Before:**
```
User: "Show me temples in Kyoto"
Claude: "Let me search for temples in Kyoto..."
[Immediately calls search_rurubu_pois(category="see", location="Kyoto", limit=100)]
```

**After:**
```
User: "Show me temples in Kyoto"
Claude: "I'd love to help! There are hundreds of temples in Kyoto, each with
        different character. Tell me:
        - Are you drawn to Zen gardens, or grand architecture?
        - Prefer quiet spaces or lively pilgrimage sites?
        - Any particular area?"
[Waits for user response before searching]
```

**Implementation:** Added "UNDERSTAND BEFORE SEARCHING" principle at top of prompt.

---

### 2. Hypothesis-Driven Search (NEW)

**Before:**
```
User: "Plan a day in Kamakura"
Claude: [Searches 3 categories in parallel]
- search_rurubu_pois(category="see", location="Kamakura", limit=100)
- search_rurubu_pois(category="eat", location="Kamakura", limit=100)
- search_rurubu_pois(category="cafe", location="Kamakura", limit=100)
[Returns 300+ POIs total]
```

**After:**
```
User: "Plan a day in Kamakura with active kids"
Claude: "For families with energetic kids, I'm thinking interactive experiences
        over temples. Let me check what hands-on activities are available..."
[Single targeted search]
- get_genre_codes(type="small") → finds pottery/farm codes
- search_rurubu_pois(sgenre="202", location="Kamakura", limit=15)
[Returns 15 focused POIs]
```

**Implementation:** Added "THINK BEFORE SEARCHING" principle with examples.

---

### 3. Curation Over Quantity (NEW)

**Before:**
```
Claude: "I found 47 temples in Kyoto:
1. ⭐⭐⭐⭐⭐ Temple A (5.0 stars)
2. ⭐⭐⭐⭐⭐ Temple B (4.9 stars)
3. ⭐⭐⭐⭐⭐ Temple C (4.8 stars)
[Lists all 47 mechanically by rating]
```

**After:**
```
Claude: "I found several beautiful options. These 3 match your preference for
        Zen gardens and quiet spaces:

1. **銀閣寺** - ¥500
   Why I picked this: The dry sand garden designed for moonlight viewing is pure
   Zen philosophy. Morning visits (before 10am) are nearly empty.

2. **法然院** - Free
   Why I picked this: Hidden gem most tourists miss. Tiny thatched gate with
   raked sand garden that changes with seasons. Profoundly peaceful.

3. **詩仙堂** - ¥500
   Why I picked this: Combines garden with poetry. Bamboo fountains create
   natural rhythm. Built by a scholar, so intellectual quietness.

Want me to plot a walking route, or prefer different style?"
```

**Implementation:** Added "CURATE THOUGHTFULLY" principle with curation criteria.

---

### 4. Conversational Memory (IMPROVED)

**Before:**
```
[No explicit guidance on remembering context]
```

**After:**
```
YOU: "You mentioned budget is tight earlier, so I focused on free/cheap options..."
YOU: "Since you loved that pottery workshop, want to explore more craft experiences?"
YOU: "Earlier you said traveling with kids - these spots are all family-friendly..."
```

**Implementation:** Added examples showing conversational callbacks and context building.

---

## Technical Changes

### Tool Usage Adjustments

**1. Search Limits**

Before:
```javascript
search_rurubu_pois(category="eat", location="Tokyo", limit=100)
// Encourages getting everything
```

After:
```javascript
search_rurubu_pois(category="eat", location="Tokyo", limit=10-15)
// Encourages focused, manageable results
```

**2. Genre Code Discovery**

Before:
```
[No guidance on when to use get_genre_codes]
[Users ask "pottery" but Claude doesn't know the code]
```

After:
```
EXPLICIT WORKFLOW:
User asks for specific genre → get_genre_codes(type="small") → find exact code
Example: "pottery workshops" → get_genre_codes → code 202 → search
```

**3. Parallel vs Sequential**

Before:
```javascript
// Multiple parallel searches encouraged
await Promise.all([
  search_rurubu_pois(category="see", ...),
  search_rurubu_pois(category="eat", ...),
  search_rurubu_pois(category="cafe", ...)
])
```

After:
```javascript
// Sequential, purposeful searches encouraged
// "Let me first check activities..."
await search_rurubu_pois(sgenre="202", location="...", limit=15)
// [User reviews results]
// "Want me to add lunch options?"
await search_rurubu_pois(category="eat", location="...", limit=10)
```

---

## Migration Steps

### Phase 1: Backup & Test (Day 1)

1. **Backup current prompt:**
   ```bash
   cp modules/claude-client.js modules/claude-client.js.backup
   ```

2. **Create A/B test framework:**
   - Add config flag: `USE_NEW_PROMPT: true/false`
   - Test with 10-20 sample queries
   - Compare behavior side-by-side

3. **Success metrics:**
   - Questions asked before first search (should be >80%)
   - Average searches per conversation (should decrease 50-70%)
   - POIs recommended vs found (should be 3-5 out of 10-15, not 30 out of 100)

### Phase 2: Implementation (Day 2)

1. **Replace buildSystemPrompt() method:**
   - File: `modules/claude-client.js`
   - Lines: 42-272
   - Replace with: `docs/implementation-prompt.js`

2. **Keep all existing logic:**
   - Location context building (lines 47-57) - KEEP
   - Map view context (lines 59-82) - KEEP
   - Language detection (lines 44-45) - KEEP
   - All tool execution code - KEEP (no changes)

3. **Only change: prompt text content**

### Phase 3: Testing (Day 3-4)

**Test Scenarios:**

1. **Discovery Test:**
   ```
   Input: "Show me temples in Kyoto"
   Expected: Asks questions before searching
   Measure: Did it ask >1 question? (YES = pass)
   ```

2. **Hypothesis Test:**
   ```
   Input: "I love pottery and hands-on activities"
   Expected: "I'm thinking pottery workshops..." → get_genre_codes → targeted search
   Measure: Used genre codes? Limited to <20 POIs? (YES = pass)
   ```

3. **Curation Test:**
   ```
   Input: [After search returns 15 results]
   Expected: Picks 3-5, explains reasoning for each
   Measure: Recommended <6 POIs? Has "Why I picked" for each? (YES = pass)
   ```

4. **Memory Test:**
   ```
   Input: "I'm traveling with kids" → [later] "Show me activities"
   Expected: "Since you're with kids, I'm thinking..."
   Measure: Referenced earlier context? (YES = pass)
   ```

5. **Search Volume Test:**
   ```
   Input: "Plan a day trip in Kamakura"
   Expected: 1-2 targeted searches, not 5 parallel searches
   Measure: Search count <3? (YES = pass)
   ```

### Phase 4: Refinement (Day 5-7)

**Monitor these metrics:**

1. **Conversation patterns:**
   - Questions asked per conversation (target: 2-4)
   - Searches executed per conversation (target: 1-3)
   - POIs displayed vs recommended (target: 10-15 vs 3-5)

2. **User feedback:**
   - "Too many questions" → Reduce discovery prompting
   - "Not enough options" → Increase from 3-5 to 5-7 recommendations
   - "Too generic" → Strengthen reasoning examples

3. **Edge cases:**
   - Very specific requests → Discovery can be skipped
   - Users who don't answer questions → Have default path
   - Multi-day itineraries → May need more POIs

**Tuning knobs:**

```javascript
// If too chatty
"Quick question: are you more interested in A or B?"
// vs current
"Tell me about yourself - what kind of traveler are you? ..."

// If recommendations too few
"Pick 3-7 places" // vs current "Pick 3-5 places"

// If searches too limited
limit=15-20 // vs current limit=10-15
```

---

## Rollback Plan

If new prompt performs worse:

1. **Immediate rollback:**
   ```bash
   cp modules/claude-client.js.backup modules/claude-client.js
   git checkout modules/claude-client.js
   ```

2. **Hybrid approach:**
   - Keep discovery principle but reduce question count
   - Keep targeted search but allow 2 parallel searches
   - Keep curation but show 7-10 POIs instead of 3-5

3. **Gradual transition:**
   - Week 1: Add discovery questions only
   - Week 2: Add hypothesis statements
   - Week 3: Reduce search limits
   - Week 4: Strengthen curation requirements

---

## Expected Outcomes

### Quantitative Improvements

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Questions asked | 0-1 | 2-4 | +300% |
| Searches per conversation | 3-5 | 1-2 | -60% |
| POIs found | 100-300 | 10-30 | -85% |
| POIs recommended | 10-30 | 3-5 | -70% |
| Avg response tokens | 500-800 | 600-900 | +15% (more explanation) |
| User follow-up rate | 30% | 60% | +100% (more engagement) |

### Qualitative Improvements

**Before:**
- Feels like Google search with map
- Overwhelming number of results
- No personalization
- Mechanical ranking by stars
- Generic descriptions

**After:**
- Feels like talking to local expert
- Manageable, curated selection
- Personalized to preferences
- Thoughtful selection with reasoning
- Rich context and stories

---

## Troubleshooting

### Problem: Claude still searches immediately

**Diagnosis:** Discovery prompting not strong enough

**Fix:** Strengthen anti-pattern section:
```
CRITICAL: Never search without understanding user preferences first.
EXCEPTION: Only skip discovery if request is extremely specific
(e.g., "ramen shops under ¥1000 in Shibuya with parking")
```

### Problem: Claude asks too many questions

**Diagnosis:** Over-optimized for discovery

**Fix:** Add practical limit:
```
Ask 2-3 essential questions (not a full interview):
- Who's traveling?
- Main interests?
- Any constraints?
Then start searching - don't over-question.
```

### Problem: Claude still returns 100 POIs

**Diagnosis:** Tool definition says limit=100, prompt says limit=10-15

**Fix:** Update tool description in `rurubu-mcp-client.js`:
```javascript
limit: {
  type: 'number',
  default: 15, // Changed from 100
  description: 'Results per page (1-100). Recommended: 10-15 for focused searches.'
}
```

### Problem: Claude doesn't explain reasoning

**Diagnosis:** Curation section too weak

**Fix:** Add mandatory template:
```
REQUIRED FORMAT:
1. **[Japanese Name]** - ¥[price]
   Why I picked this: [2-3 sentences explaining fit]

DO NOT just list POIs - always explain reasoning.
```

### Problem: Claude forgets earlier context

**Diagnosis:** Not a prompt issue - conversation history pruning

**Fix:** This is already handled by conversation history in `claude-client.js`. If issue persists, adjust pruning threshold in config.

---

## Success Criteria

After 1 week of production use, measure:

✅ **Phase 1 Success (Discovery):**
- 70%+ of conversations start with questions before searching
- User responds to questions (not ignoring them)
- Questions feel natural, not interrogative

✅ **Phase 2 Success (Search):**
- Average searches per conversation <3
- Average POIs returned per search <20
- Genre codes used for specific requests

✅ **Phase 3 Success (Curation):**
- Recommendations consistently 3-7 POIs (not 20+)
- Each recommendation has reasoning
- Mix of ratings (not all 5-star)

✅ **Phase 4 Success (User Satisfaction):**
- User follow-up rate >50%
- Positive sentiment in responses
- Users feel "understood" (qualitative feedback)

---

## Next Steps

1. **Review implementation-prompt.js**
2. **Run A/B test with 20 sample queries**
3. **Replace buildSystemPrompt() method**
4. **Test with diverse use cases**
5. **Monitor metrics for 1 week**
6. **Refine based on data**
7. **Document learnings**

**Timeline:** 7-10 days from testing to stable release

**Risk Level:** Low (easy rollback, no code changes beyond prompt)

**Expected Impact:** High (transforms core UX from search engine to advisor)
