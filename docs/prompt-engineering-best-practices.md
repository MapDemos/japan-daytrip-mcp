# Prompt Engineering Best Practices for Conversational AI Agents

## Context: Japan Travel Planning Application

This document captures prompt engineering principles, patterns, and anti-patterns learned from transforming a search-engine-like assistant into a human-like travel agent.

---

## Core Principles

### 1. Identity Before Instructions

**Bad (Tool-First):**
```
You have access to search_pois tool. Use it to find places.
When user asks for restaurants, call search_pois(category="eat").
```

**Good (Identity-First):**
```
You are Kenji, a Japan travel expert with 15 years of local experience.
You believe every traveler deserves personalized recommendations, not generic lists.

Your approach: understand the person first, then search with purpose.
```

**Why it works:**
- Identity creates consistent behavioral patterns
- "What would Kenji do?" is clearer than following 50 rules
- Personality emerges naturally from role, not rules

---

### 2. Principles Over Procedures

**Bad (Prescriptive Workflow):**
```
WORKFLOW:
1. Call search_pois with category
2. Call get_poi_details on all results
3. Rank by rating
4. Return top 5
```

**Good (Principle-Based):**
```
CORE PRINCIPLE: Understand before searching

- Gather context about traveler preferences first
- Form hypothesis about what would fit
- Search with specific intent, not broadly
- Curate thoughtfully, explain reasoning
```

**Why it works:**
- Handles edge cases naturally (no rule covers everything)
- Flexible for different situations
- Easier for LLM to internalize behavioral patterns

---

### 3. Show, Don't Tell

**Bad (Abstract Rules):**
```
Be conversational and personalized.
Explain your reasoning clearly.
```

**Good (Concrete Examples):**
```
EXAMPLE:

User: "Show me temples in Kyoto"

❌ BAD: "Let me search temples..." [searches immediately]

✅ GOOD: "I'd love to help! There are hundreds of temples in Kyoto.
         Are you drawn to Zen gardens, or grand architecture?
         This helps me recommend places you'll truly connect with."
```

**Why it works:**
- Examples are unambiguous (rules are often interpreted differently)
- LLMs excel at pattern matching from examples
- Shows desired output format explicitly

---

### 4. Guard Against Unwanted Behavior

**Bad (Only Positive Instructions):**
```
Ask questions to understand user preferences.
```

**Good (Anti-Patterns):**
```
PRINCIPLE: Ask questions first

❌ NEVER: Start searching immediately without context
❌ NEVER: "Let me search temples, restaurants, AND cafes..." (search explosion)
✅ ALWAYS: Ask 2-3 clarifying questions before first search
```

**Why it works:**
- LLMs can interpret "ask questions" as optional
- Explicit anti-patterns create stronger boundaries
- Shows both what to do AND what not to do

---

## Prompt Architecture Patterns

### Pattern 1: Role-Based Agent

```
Structure:
[IDENTITY] → [PHILOSOPHY] → [PRINCIPLES] → [TOOLS] → [CONSTRAINTS]

Example:
You are [role with personality]
Your philosophy: [core beliefs]
Your approach: [behavioral principles]
Available tools: [when and how to use]
Technical notes: [necessary constraints]
```

**Use when:**
- Building conversational agents
- Personality and consistency matter
- Multiple interaction patterns possible

**Token efficiency:** Medium (identity section adds tokens, but reduces need for detailed rules)

---

### Pattern 2: Few-Shot Example-Driven

```
Structure:
[TASK] → [EXAMPLES] → [EDGE CASES] → [TOOLS]

Example:
Your task: Curate travel recommendations

Example 1 (good): [full interaction]
Example 2 (bad): [what not to do]
Edge case: [specific scenario]
Available tools: [...]
```

**Use when:**
- Task is well-defined but complex
- Output format matters
- Need consistency across sessions

**Token efficiency:** Low (examples consume many tokens, but ensure accuracy)

---

### Pattern 3: Chain-of-Thought Prompting

```
Structure:
[TASK] → [THINKING PROCESS] → [TOOLS] → [OUTPUT FORMAT]

Example:
Before responding, think through:
1. What does the user really want?
2. What information do I need to gather?
3. What hypothesis can I form?
4. What's the minimal search needed?
5. How do I curate results?
```

**Use when:**
- Multi-step reasoning required
- Planning before execution is critical
- Transparent thinking benefits user trust

**Token efficiency:** Medium (thinking steps add tokens, but reduce tool call waste)

---

### Pattern 4: Constitutional AI

```
Structure:
[PRINCIPLES] → [CONSTRAINTS] → [SELF-CORRECTION]

Example:
Core principles:
- Understand before searching
- Quality over quantity

Constraints:
- Never recommend without context
- Maximum 5 POIs per response

Self-check before responding:
✓ Did I ask clarifying questions?
✓ Did I explain my reasoning?
✓ Are recommendations personalized?
```

**Use when:**
- Safety and alignment critical
- Need self-monitoring behavior
- Multiple quality criteria

**Token efficiency:** High (rules are concise, behavior is reliable)

---

## Conversation State Management

### Approach 1: Implicit Memory (Recommended)

```
DON'T:
Maintain explicit state: traveler_profile = {party: 4, interests: [...]}

DO:
Trust conversation history and reference naturally:
"You mentioned traveling with kids, so..."
"Earlier you said budget is tight, so I focused on..."
"Since you loved that pottery workshop, want to explore more crafts?"
```

**Pros:**
- Natural, human-like
- No state synchronization issues
- Leverages LLM's strength (context understanding)

**Cons:**
- Limited by context window
- Can forget in very long conversations
- Relies on conversation history quality

---

### Approach 2: Explicit State (Not Recommended)

```
DON'T:
[Maintain state]
{
  "user_profile": {
    "party_size": 4,
    "interests": ["culture", "food"],
    "budget": "moderate"
  }
}

[Update state every turn]
```

**Pros:**
- Structured data
- Easy to query
- Persists across sessions

**Cons:**
- Feels mechanical ("updating your profile...")
- State management complexity
- Synchronization errors
- Increases token usage significantly

---

### Approach 3: Hybrid (Situational)

```
Use explicit state ONLY for:
- Critical safety info (allergies, accessibility needs)
- Complex multi-day itineraries
- Cross-session persistence requirements

Use implicit memory for:
- Preferences and interests
- Conversation flow
- Contextual understanding
```

---

## Multi-Phase Conversation Design

### Anti-Pattern: Rigid Phase Markers

```
❌ BAD:
PHASE 1: DISCOVERY
- Ask questions
- Gather preferences

PHASE 2: SEARCH
- Execute searches
- Get results

PHASE 3: PRESENTATION
- Show recommendations
```

**Problems:**
- Feels robotic ("Now entering Phase 2...")
- Can't skip phases when appropriate
- Doesn't handle interruptions well

---

### Best Practice: Principle-Based Flow

```
✅ GOOD:
PRINCIPLES:
1. Understand before searching
2. Think before acting
3. Curate before presenting
4. Offer to adjust

These naturally create phases without rigid structure:
- Vague request → Understand (questions)
- Specific request → Can skip to search
- After search → Always curate
- After presentation → Always offer to adjust
```

**Advantages:**
- Natural conversation flow
- Handles exceptions gracefully
- User controls pacing
- Feels human, not scripted

---

## Tool Usage Optimization

### Pattern 1: Lazy Tool Calling

```
PRINCIPLE: Call tools only when necessary

❌ BAD: Always call search tool immediately
✅ GOOD: Call tool only after understanding what to search for

Implementation:
"Before searching, I need to understand..."
[Gathers context]
"Based on that, let me search for..."
[Calls tool with specific parameters]
```

**Benefits:**
- Reduces unnecessary API calls
- Improves response quality
- Lower costs
- Faster responses (when tools not needed)

---

### Pattern 2: Targeted vs Exhaustive Search

```
❌ BAD (Exhaustive):
"Let me search everything..."
search(category="see", limit=100)
search(category="eat", limit=100)
search(category="cafe", limit=100)
[Returns 300 POIs]

✅ GOOD (Targeted):
"For culture lovers, I'm thinking temples with gardens..."
search(category="see", sgenre="131", limit=15)
[Returns 15 focused POIs]
```

**Implementation:**
- Set conservative limits in prompt (10-15, not 100)
- Use specific filters/genres
- Search sequentially with purpose, not parallel
- Explicitly penalize "search everything" behavior

---

### Pattern 3: Pre-Search Planning

```
WORKFLOW:
1. Hypothesis: "I'm thinking..."
2. Tool discovery: get_genre_codes() if needed
3. Targeted search: search with specific parameters
4. Review: get_summary before responding
5. Curate: Pick subset with reasoning

Prompt implementation:
"Before searching, state your hypothesis out loud:
'Based on what you said, I'm thinking [genre] in [location] because...'

Then search with specific intent, not broadly."
```

---

## Curation & Ranking Strategies

### Anti-Pattern: Mechanical Ranking

```
❌ BAD:
1. ⭐⭐⭐⭐⭐ POI A (5.0 stars)
2. ⭐⭐⭐⭐⭐ POI B (4.9 stars)
3. ⭐⭐⭐⭐☆ POI C (4.8 stars)

Problem: Ignores user preferences, context, narrative
```

---

### Best Practice: Narrative Curation

```
✅ GOOD:
Based on your interest in [X], here are 3 places I think you'd love:

1. **[POI Name]** - ¥[price], [hours]
   Why I picked this: [2-3 sentences explaining fit with user preferences]
   Personal insight: [unique detail, story, or local knowledge]

2. **[POI Name]** - ¥[price], [hours]
   Why I picked this: [different reason, showing variety]
   Personal insight: [another angle]

Want me to look for [different style/area/budget]?
```

**Curation criteria (in order):**
1. Relevance to stated interests
2. Variety in experiences
3. Practical factors (location, budget, hours)
4. Uniqueness / story value
5. Rating (considered, but not primary)

---

## Token Optimization Techniques

### 1. Structural Efficiency

**Before (verbose):**
```
RULE 1: When the user asks for recommendations, you should first ask them
questions to understand their preferences before you start searching. This is
very important because every traveler is different and generic recommendations
are not helpful. You should ask about their travel party size, their interests,
their budget constraints, and any other relevant factors.

RULE 2: After you have gathered sufficient information about the user's
preferences, you should then...
```

**After (concise):**
```
PRINCIPLES:

**Understand First**
- Ask about: party, interests, budget, constraints
- Exception: Skip for very specific requests
- Why: Every traveler is unique

**Search with Intent**
- Form hypothesis before searching
- Use specific filters/genres
- Limit results (10-15, not 100)
```

**Savings:** ~60% token reduction while maintaining clarity

---

### 2. Example Optimization

**Don't repeat full examples:**
```
❌ BAD: Repeat full example for each scenario (3000 tokens each × 5 = 15k tokens)
```

**Do use compact examples:**
```
✅ GOOD:
DISCOVERY EXAMPLE: [300 tokens showing pattern]
SEARCH EXAMPLE: [200 tokens showing pattern]
CURATION EXAMPLE: [400 tokens showing pattern]

Total: 900 tokens vs 15,000 tokens (94% reduction)
```

---

### 3. Data Format Optimization

**For compressed data (like POI results):**
```
Use pipe-delimited format:
{t:'p', dict:"cat1|cat2|addr1", f:"id|name|0|lng|lat|rank"}

vs JSON array:
[{id: "...", name: "...", category: "cat1", ...}]

Savings: 60-70% token reduction on large datasets
```

**Implementation in prompt:**
- Explain format once at top
- Reference it in tool descriptions
- Don't repeat format explanation

---

### 4. Progressive Disclosure

```
Basic prompt (always included): ~500 tokens
├─ Identity & principles: 200 tokens
├─ Core tools: 200 tokens
└─ Response format: 100 tokens

Advanced features (conditional): ~300 tokens
├─ Itinerary planning: 100 tokens
├─ Search history: 100 tokens
└─ Edge cases: 100 tokens

Total: 800 tokens vs 1500 tokens all-inclusive
```

**Trigger advanced features only when needed:**
- User asks about itinerary → Include itinerary guidelines
- User asks about history → Include history management

---

## Testing & Evaluation Framework

### Quantitative Metrics

```javascript
// Test harness
const testCases = [
  {
    name: "Discovery test",
    input: "Show me temples in Kyoto",
    expectedBehavior: {
      questionsAsked: true,
      questionsCount: { min: 1, max: 4 },
      searchedImmediately: false
    }
  },
  {
    name: "Targeted search test",
    input: "[After user provides preferences]",
    expectedBehavior: {
      searchCount: { max: 2 },
      searchLimit: { max: 20 },
      usedGenreCodes: true
    }
  },
  {
    name: "Curation test",
    input: "[After search returns 15 results]",
    expectedBehavior: {
      poisRecommended: { min: 3, max: 7 },
      hasReasoning: true,
      varietyScore: { min: 0.7 } // Not all same category
    }
  }
];
```

---

### Qualitative Evaluation

**User feedback questions:**
1. Did the assistant feel like a helpful expert, or a search engine?
2. Did you feel understood and listened to?
3. Were recommendations personalized to your needs?
4. Was the number of options overwhelming, too few, or just right?
5. Did explanations help you understand why places were recommended?

**Scoring rubric:**
- 5/5: Feels like expert human consultant
- 4/5: Helpful and personalized, minor robotic moments
- 3/5: Functional but feels automated
- 2/5: Generic, overwhelming, or confusing
- 1/5: Unusable, broken, or frustrating

---

### A/B Testing Framework

```javascript
// Configuration
const promptVariants = {
  control: "original-search-engine-prompt",
  variant_a: "human-travel-agent-prompt",
  variant_b: "hybrid-prompt"
};

// Metrics to track
const metrics = {
  // Behavioral
  questionsAskedPerConversation: [],
  searchesPerConversation: [],
  poisReturnedPerSearch: [],
  poisRecommendedPerResponse: [],

  // Performance
  avgResponseTime: [],
  tokenUsagePerResponse: [],
  toolCallsPerConversation: [],

  // User satisfaction
  followUpRate: [], // % of users who continue conversation
  positiveResponseRate: [], // Sentiment analysis
  taskCompletionRate: [] // Did user get what they wanted?
};

// Run test
// Randomly assign users to variants
// Track metrics for 1-2 weeks
// Statistical significance testing (t-test, chi-square)
```

**Decision criteria:**
- Variant must improve ≥2 key metrics by ≥20%
- No regressions in critical metrics (response time, errors)
- Qualitative feedback score ≥4.0/5.0

---

## Common Pitfalls & Solutions

### Pitfall 1: Over-Prompting

**Problem:**
```
Prompt becomes 2000+ lines trying to cover every edge case
Result: Token bloat, slow responses, harder to maintain
```

**Solution:**
```
Keep core prompt <1000 lines
Use principles, not exhaustive rules
Handle edge cases in code, not prompt
Document exceptions separately
```

---

### Pitfall 2: Under-Prompting

**Problem:**
```
Prompt: "You are a helpful travel assistant."
Result: Generic, inconsistent behavior
```

**Solution:**
```
Provide clear identity, principles, and examples
Balance between flexibility and structure
Test thoroughly with diverse inputs
```

---

### Pitfall 3: Tool-First Design

**Problem:**
```
Prompt focuses on HOW to use tools, not WHY
Result: Technically correct but personality-less
```

**Solution:**
```
Start with WHO (identity) and WHY (principles)
Tools are means to an end, not the end
Show examples of tool usage in context of goals
```

---

### Pitfall 4: Ignoring Failure Modes

**Problem:**
```
Prompt assumes happy path only
Result: Poor handling of edge cases, errors, ambiguity
```

**Solution:**
```
Explicitly handle:
- Search returns 0 results → What to do?
- User doesn't answer questions → Default path?
- Ambiguous requests → How to clarify?
- Tool errors → Graceful degradation?
```

---

### Pitfall 5: Static Prompts

**Problem:**
```
Set prompt once, never iterate
Result: Doesn't improve with real-world usage
```

**Solution:**
```
Monitor conversations regularly
Identify failure patterns
Update prompt incrementally
A/B test changes
Document learnings
```

---

## Production Checklist

Before deploying new prompt:

**Functionality:**
- [ ] Core behaviors working (discovery, search, curation)
- [ ] Tool calls execute correctly
- [ ] Error handling graceful
- [ ] Edge cases handled

**Performance:**
- [ ] Token usage acceptable (<2000 tokens/response avg)
- [ ] Response time <3 seconds average
- [ ] Tool call count reasonable (<5 per conversation)

**Quality:**
- [ ] Consistent personality across conversations
- [ ] Appropriate formality level
- [ ] Correct language handling
- [ ] No hallucinations about POI data

**Testing:**
- [ ] 20+ diverse test cases pass
- [ ] A/B test shows improvement
- [ ] User feedback positive (>4.0/5.0)
- [ ] No regressions vs previous version

**Documentation:**
- [ ] Prompt changes documented
- [ ] Rationale explained
- [ ] Metrics tracked
- [ ] Rollback plan ready

**Monitoring:**
- [ ] Conversation logs enabled
- [ ] Error tracking active
- [ ] User feedback mechanism
- [ ] Regular review scheduled (weekly)

---

## Continuous Improvement Process

### Week 1-2: Baseline Collection
- Deploy new prompt
- Collect conversation logs
- Track quantitative metrics
- Gather user feedback

### Week 3: Analysis
- Identify failure patterns
- Find common edge cases
- Analyze user satisfaction
- Compare to success criteria

### Week 4: Iteration
- Draft prompt improvements
- A/B test changes
- Document learnings
- Update best practices

### Repeat: Monthly Review Cycle

**What to monitor:**
1. Conversation patterns (are users engaged?)
2. Tool usage patterns (efficient searches?)
3. Error rates (failures, hallucinations?)
4. User satisfaction (feedback, follow-up rate?)
5. Performance metrics (tokens, latency, costs?)

**When to update prompt:**
- Consistent failure pattern identified (>10% of conversations)
- New features added (new tools, capabilities)
- User feedback suggests confusion
- Performance optimization needed
- Better patterns discovered

**When NOT to update:**
- One-off edge case
- User error (not prompt issue)
- External system failure
- Already working well (don't over-optimize)

---

## Key Takeaways

### Top 10 Principles

1. **Identity Before Instructions** - WHO before HOW
2. **Principles Over Procedures** - Flexible guidelines beat rigid rules
3. **Show, Don't Tell** - Examples > Abstract instructions
4. **Guard Against Anti-Patterns** - Explicit what NOT to do
5. **Trust Conversation History** - Implicit memory > Explicit state
6. **Natural Flow Over Phases** - Conversation, not state machine
7. **Lazy Tool Calling** - Think first, search second
8. **Narrative Curation** - Story matters more than ratings
9. **Test Everything** - Metrics + user feedback
10. **Iterate Continuously** - Prompt engineering is never "done"

### Token Budget Rules

- Core prompt: <800 tokens (identity, principles, key tools)
- Examples: <400 tokens (compact, representative)
- Technical details: <200 tokens (essential only)
- Total target: <1500 tokens (leaves room for conversation)

### Quality Hierarchy

1. **Correctness** - Factually accurate, no hallucinations
2. **Personality** - Consistent, appropriate character
3. **Efficiency** - Minimal tool calls, reasonable tokens
4. **User Experience** - Natural, helpful, engaging
5. **Edge Cases** - Graceful handling of unusual inputs

---

## Resources & Further Reading

**Anthropic Documentation:**
- Claude Prompt Engineering Guide
- Tool Use Best Practices
- Extended Thinking (for complex reasoning)

**Research Papers:**
- "Chain-of-Thought Prompting Elicits Reasoning in LLMs"
- "Constitutional AI: Harmlessness from AI Feedback"
- "ReAct: Synergizing Reasoning and Acting in Language Models"

**Internal Documentation:**
- `/docs/new-system-prompt-draft.md` - Complete new prompt
- `/docs/implementation-prompt.js` - Production-ready implementation
- `/docs/prompt-migration-guide.md` - Migration strategy

---

**Document Version:** 1.0
**Last Updated:** 2025-12-31
**Author:** Prompt Engineering Team
**Status:** Production Guide
