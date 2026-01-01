# Summary: Transforming Claude from Search Engine to Human Travel Agent

## Executive Summary

**Problem:** Claude behaves like a search engine - searches everything, shows all results, picks top-rated places mechanically without understanding the user.

**Solution:** Re-architect system prompt to prioritize identity, principles, and conversational discovery over technical tool instructions.

**Expected Impact:**
- 80% reduction in unnecessary searches
- 90% reduction in POIs shown (30+ → 3-5 curated picks)
- Significantly improved personalization and user satisfaction
- More natural, question-asking conversation flow

**Risk:** Low (prompt change only, easy rollback)
**Timeline:** 7-10 days from testing to stable release
**Effort:** Medium (1 file change, extensive testing required)

---

## Key Deliverables Created

### 1. `/docs/new-system-prompt-draft.md`
**What:** Comprehensive design document explaining the new prompt architecture
**Key sections:**
- Part 1: Identity & Role (WHO Claude is)
- Part 2: Discovery Phase (asking questions first)
- Part 3: Hypothesis-Driven Search (think before searching)
- Part 4: Curation & Presentation (quality over quantity)
- Part 5: Multi-Phase Conversations (natural flow)
- Part 6: Tool Usage Guidelines (technical details)
- Part 7: Technical Constraints (data formats)
- Part 8: Response Examples (concrete demonstrations)

**Use for:** Understanding the philosophy and design decisions

---

### 2. `/docs/implementation-prompt.js`
**What:** Production-ready code to replace buildSystemPrompt() method
**Location to modify:** `/modules/claude-client.js` lines 42-272
**Key changes:**
- Identity-first introduction with personality
- Discovery principles before tool instructions
- Anti-pattern guards (what NOT to do)
- Concrete examples of desired behavior
- Streamlined technical constraints

**Use for:** Direct implementation (copy-paste ready)

---

### 3. `/docs/prompt-migration-guide.md`
**What:** Step-by-step migration plan with testing strategy
**Key sections:**
- Before/After comparison (with metrics)
- 4 key behavioral changes explained
- Technical changes to tool usage
- 4-phase migration plan (Backup → Implement → Test → Refine)
- Rollback plan and troubleshooting
- Success criteria and metrics

**Use for:** Planning and executing the deployment

---

### 4. `/docs/prompt-engineering-best-practices.md`
**What:** Comprehensive guide to prompt engineering principles
**Key sections:**
- Core principles (Identity Before Instructions, etc.)
- Prompt architecture patterns (Role-Based, Few-Shot, etc.)
- Conversation state management approaches
- Multi-phase conversation design
- Tool usage optimization patterns
- Token optimization techniques
- Testing & evaluation framework
- Common pitfalls & solutions
- Production checklist
- Continuous improvement process

**Use for:** Long-term prompt maintenance and future improvements

---

## Quick Start: Implementation in 5 Steps

### Step 1: Backup Current State (5 minutes)
```bash
cd /Users/kenjishima/Work/VS/MapboxDemos/japan-daytrip-mcp

# Backup current implementation
cp modules/claude-client.js modules/claude-client.js.backup

# Create git branch for testing
git checkout -b feature/human-travel-agent-prompt
```

### Step 2: Implement New Prompt (15 minutes)
1. Open `/modules/claude-client.js`
2. Locate `buildSystemPrompt()` method (lines 42-272)
3. Replace entire method content with code from `/docs/implementation-prompt.js`
4. Keep all existing logic for location/map context (already included in new code)
5. Save file

### Step 3: Test Locally (2-3 hours)
Run these test scenarios and verify behavior:

**Discovery Test:**
```
Input: "Show me temples in Kyoto"
Expected: Asks 2-3 questions before searching
✓ Pass if: Questions asked > 0
```

**Hypothesis Test:**
```
Input: "I love pottery, hands-on experiences"
Expected: States hypothesis, calls get_genre_codes, targeted search
✓ Pass if: Search limit < 20, used genre codes
```

**Curation Test:**
```
Input: [After search returns 15 results]
Expected: Recommends 3-5 POIs with reasoning
✓ Pass if: Recommended < 7, has "Why I picked this" for each
```

**Memory Test:**
```
Input: "I'm with kids age 8 and 10" → [later] "Show me activities"
Expected: References earlier context
✓ Pass if: Mentions kids/family in response
```

**Search Volume Test:**
```
Input: "Plan a day in Kamakura"
Expected: 1-2 targeted searches, not 5 parallel
✓ Pass if: Total searches < 3
```

### Step 4: A/B Comparison (1-2 days)
Create comparison table:

| Metric | Old Prompt | New Prompt | Goal |
|--------|-----------|------------|------|
| Questions before search | 0-1 | ? | 2-4 |
| Searches per conversation | 3-5 | ? | 1-2 |
| POIs found per search | 100-300 | ? | 10-30 |
| POIs recommended | 10-30 | ? | 3-5 |
| Has reasoning? | Rare | ? | Always |

Test with 20 diverse queries (see test cases below)

### Step 5: Deploy & Monitor (Ongoing)
```bash
# If tests pass
git add modules/claude-client.js
git commit -m "Transform Claude into human-like travel agent

- Replace tool-first prompt with identity-first design
- Add discovery phase (ask questions before searching)
- Add hypothesis-driven search (targeted, not exhaustive)
- Add curation with reasoning (3-5 POIs, not 30+)
- Reduce search limits (10-15, not 100)

Expected impact: 80% fewer searches, 90% fewer POIs shown,
significantly improved personalization"

git push origin feature/human-travel-agent-prompt

# Create PR, review, merge to main
```

**Monitor for 1 week:**
- Track conversation patterns
- Collect user feedback
- Watch for edge case failures
- Measure satisfaction metrics

---

## Test Cases (Copy-Paste Ready)

### Basic Discovery
```
1. "Show me temples in Kyoto"
2. "Find restaurants in Tokyo"
3. "What's good in Osaka?"
4. "Plan a day trip in Kamakura"
5. "I want to see Mt. Fuji"
```

### Specific Requests (Can Skip Discovery)
```
6. "Ramen shops in Shibuya under ¥1000"
7. "Temples with Zen gardens in Kyoto Higashiyama-ku"
8. "Family-friendly activities in Yokohama"
```

### Genre-Specific (Should Use get_genre_codes)
```
9. "Pottery workshops near me"
10. "Cycling tours in the countryside"
11. "Farm experiences for kids"
12. "Massage and spa places"
```

### Multi-Turn Conversations
```
13. "Show me cafes" → [After results] → "Too expensive, cheaper options?"
14. "I love culture" → [Asks questions] → "Temples and gardens" → [Results]
15. "Plan a day in Nara" → [Shows itinerary] → "Add lunch spots"
```

### Edge Cases
```
16. Very vague: "What should I do?"
17. Contradictory: "Luxury budget travel"
18. Impossible: "Temples in Shibuya" (Shibuya has few temples)
19. Infrastructure: "Find hospitals near Tokyo Station" (should use search_location)
20. Follow-up: "Show me more like #2" (reference previous recommendation)
```

---

## Success Metrics Dashboard

Track these weekly:

### Behavioral Metrics (from logs)
| Metric | Target | Week 1 | Week 2 | Week 3 |
|--------|--------|--------|--------|--------|
| Questions asked per conversation | 2-4 | - | - | - |
| Searches per conversation | 1-2 | - | - | - |
| POIs found per search | 10-30 | - | - | - |
| POIs recommended per response | 3-5 | - | - | - |
| get_genre_codes usage | 20%+ | - | - | - |

### Performance Metrics (from monitoring)
| Metric | Target | Week 1 | Week 2 | Week 3 |
|--------|--------|--------|--------|--------|
| Avg response time | <3s | - | - | - |
| Avg tokens per response | <2000 | - | - | - |
| Tool calls per conversation | <5 | - | - | - |
| Error rate | <5% | - | - | - |

### User Satisfaction (from feedback)
| Metric | Target | Week 1 | Week 2 | Week 3 |
|--------|--------|--------|--------|--------|
| Follow-up rate | >50% | - | - | - |
| Positive sentiment | >70% | - | - | - |
| "Felt personalized" score | >4/5 | - | - | - |
| "Too many POIs" complaints | <10% | - | - | - |

---

## Rollback Plan

If metrics don't meet targets after 1 week:

### Option 1: Full Rollback (if major issues)
```bash
git revert <commit-hash>
# Or restore from backup
cp modules/claude-client.js.backup modules/claude-client.js
```

### Option 2: Hybrid Approach (if mixed results)
Keep what works, adjust what doesn't:
- **Keep:** Discovery questions, hypothesis statements
- **Adjust:** Reduce question count (2-3 → 1-2)
- **Revert:** Search limits (10-15 → 15-25)
- **Tune:** Curation count (3-5 → 5-7)

### Option 3: Gradual Transition (if needs refinement)
Week-by-week rollout:
- Week 1: Add discovery questions only
- Week 2: Add hypothesis-driven search
- Week 3: Reduce search limits
- Week 4: Strengthen curation requirements

---

## Common Issues & Quick Fixes

### Issue: Claude still searches immediately
**Fix:** Strengthen anti-pattern section:
```
CRITICAL: NEVER search without asking questions first
ONLY exception: Extremely specific requests (e.g., "ramen in Shibuya under ¥1000")
```

### Issue: Claude asks too many questions
**Fix:** Add practical limit:
```
Ask 2-3 essential questions maximum (not a full interview)
If user seems impatient, proceed with best guess
```

### Issue: Claude still returns 100 POIs
**Fix:** Update tool definition in `rurubu-mcp-client.js`:
```javascript
limit: {
  type: 'number',
  default: 15, // Changed from 100
  description: 'Recommended: 10-15 for focused, manageable results'
}
```

### Issue: No reasoning in recommendations
**Fix:** Make reasoning format mandatory:
```
REQUIRED FORMAT:
**[Name]** - ¥[price]
Why I picked this: [Must explain reasoning here]

Never list POIs without "Why I picked this" explanation.
```

---

## Long-Term Roadmap

### Phase 1 (Weeks 1-2): Stabilization
- Deploy new prompt
- Fix immediate issues
- Tune parameters based on data
- Document learnings

### Phase 2 (Weeks 3-4): Optimization
- Optimize token usage (if needed)
- Add missing edge case handling
- Improve example quality
- Refine curation criteria

### Phase 3 (Month 2): Enhancement
- Add advanced features:
  - Multi-day itinerary planning
  - Budget optimization
  - Accessibility considerations
  - Seasonal recommendations
- A/B test enhancements
- Measure incremental improvements

### Phase 4 (Month 3+): Personalization
- Track user preferences across sessions
- Build genre preference models
- Implement recommendation refinement learning
- Add collaborative filtering

---

## Decision Framework

When deciding whether to deploy:

**Deploy if:**
- ✓ 5/5 basic discovery tests pass
- ✓ 4/5 specific request tests pass
- ✓ 3/5 genre-specific tests pass
- ✓ 4/5 multi-turn tests pass
- ✓ No critical failures in edge cases
- ✓ Token usage reasonable (<2500/response avg)
- ✓ Response time acceptable (<4s avg)

**Don't deploy if:**
- ✗ Fails >40% of test cases
- ✗ Critical functionality broken (starring, search, etc.)
- ✗ Token usage excessive (>4000/response)
- ✗ Response time too slow (>6s avg)
- ✗ Frequent hallucinations or errors

**Need more testing if:**
- Mixed results (50-60% pass rate)
- Performance borderline
- User feedback unclear
- Edge cases uncertain

---

## Key Contacts & Resources

**Implementation Files:**
- `/modules/claude-client.js` - Main file to modify (lines 42-272)
- `/modules/rurubu-mcp-client.js` - Tool definitions (may need limit adjustments)

**Documentation:**
- `/docs/new-system-prompt-draft.md` - Complete design
- `/docs/implementation-prompt.js` - Production code
- `/docs/prompt-migration-guide.md` - Deployment plan
- `/docs/prompt-engineering-best-practices.md` - Long-term guide

**Related Systems:**
- Claude API: Anthropic Messages API (claude-sonnet-4-5-20250929)
- Rurubu API: Japan POI database with genre codes
- Mapbox: Visualization and geocoding

**Anthropic Resources:**
- https://docs.anthropic.com/claude/docs/prompt-engineering
- https://docs.anthropic.com/claude/docs/tool-use
- https://docs.anthropic.com/claude/docs/extended-thinking

---

## Final Checklist

Before deploying to production:

**Code:**
- [ ] Backup created (`claude-client.js.backup`)
- [ ] New prompt implemented in `buildSystemPrompt()`
- [ ] No syntax errors
- [ ] Git branch created
- [ ] Changes committed with clear message

**Testing:**
- [ ] 20 test cases documented
- [ ] 5 basic tests pass (100%)
- [ ] 3 specific tests pass (75%+)
- [ ] 5 genre tests pass (60%+)
- [ ] 3 multi-turn tests pass (75%+)
- [ ] 4 edge cases handled gracefully (80%+)

**Performance:**
- [ ] Token usage measured (<2000 avg)
- [ ] Response time measured (<3s avg)
- [ ] Tool call count reasonable (<5/conversation)
- [ ] No performance regressions

**Quality:**
- [ ] Personality consistent
- [ ] Questions natural, not robotic
- [ ] Reasoning clear and helpful
- [ ] No hallucinations detected
- [ ] Japanese text preserved correctly

**Documentation:**
- [ ] Implementation documented
- [ ] Test results recorded
- [ ] Known issues noted
- [ ] Rollback plan ready
- [ ] Team briefed

**Monitoring:**
- [ ] Logging enabled
- [ ] Metrics dashboard ready
- [ ] User feedback mechanism active
- [ ] Error tracking configured
- [ ] Review schedule set (weekly)

---

## Next Actions (Priority Order)

1. **[Today]** Review all 4 documentation files created
2. **[Today]** Backup current `claude-client.js`
3. **[Today]** Create feature branch in git
4. **[Tomorrow]** Implement new prompt in development environment
5. **[Tomorrow]** Run 20 test cases, document results
6. **[Day 3]** A/B comparison with old vs new prompt
7. **[Day 4]** Tune parameters based on test results
8. **[Day 5]** Deploy to production (if tests pass)
9. **[Week 1]** Monitor metrics daily, collect user feedback
10. **[Week 2]** Review metrics, make adjustments if needed
11. **[Week 3]** Document learnings, update best practices
12. **[Ongoing]** Monthly review and continuous improvement

---

## Questions to Consider

Before deploying, discuss with team:

1. **Scope:** Deploy to all users, or start with subset (e.g., English only)?
2. **Timing:** Peak usage hours to avoid, or deploy during quiet period?
3. **Monitoring:** Who monitors metrics? How often? Escalation path?
4. **Feedback:** How do users report issues? Where is feedback collected?
5. **Rollback:** Who has authority to rollback? Under what conditions?
6. **Success:** How long until we declare success/failure? (Suggest: 1 week)

---

## Success Definition

We'll consider this deployment successful if after 1 week:

**Must-Have (Critical):**
- ✓ No increase in error rate
- ✓ No significant performance degradation
- ✓ Core functionality working (search, starring, itinerary)
- ✓ Questions asked rate >60%

**Should-Have (Important):**
- ✓ Searches per conversation decreased 40%+
- ✓ POIs shown per response decreased 50%+
- ✓ User follow-up rate increased 20%+
- ✓ Qualitative feedback positive (>70%)

**Nice-to-Have (Aspirational):**
- ✓ "Felt personalized" score >4/5
- ✓ Genre code usage >20%
- ✓ Token usage optimized (decreased or stable)
- ✓ User session time increased (more engagement)

---

**Document Status:** Ready for Implementation
**Last Updated:** 2025-12-31
**Version:** 1.0
**Next Review:** After 1 week of production deployment
