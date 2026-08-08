# Portfolio Impact Agent Technical Execution Plan

## Goal

Turn Iceberg from a single-trade risk checker into a portfolio-aware pre-trade risk layer.

When a user asks, "I want to buy MSFT with $15k", the agent should not only size MSFT in isolation. It should answer:

- What does the user's portfolio look like before this trade?
- What changes after this proposed trade?
- Does the trade increase single-stock, sector, theme, volatility, or cash risk?
- Should the final recommendation be proceed, starter, reduce, wait, or no trade because of portfolio impact?

This becomes a formal agent skill named `portfolio_impact_analysis`.

## Current State

Already implemented:

- Portfolio screenshot upload via Gemini Vision.
- Parsed holdings are saved into local portfolio state.
- Agent receives `portfolio` in `/api/agent-chat`.
- `runPortfolioContextSkill` fills `accountValue`, `cashAvailable`, and `currentShares`.
- `runMarketResolverSkill` can use a saved holding price as fallback market price.
- Sizing uses account value, cash, current shares, and future single-name exposure.
- Strategy selection can reduce size when a trade creates concentration risk.

Current gap:

- The agent does not deeply analyze the full portfolio before and after the proposed trade.
- Theme exposure, sector exposure, cash depletion, existing top holdings, and trade-level portfolio impact are not first-class inputs to final recommendation.
- The UI does not show a simple "before / after portfolio impact" card.

## Target Agent Workflow

Current workflow:

1. `intent_extraction`
2. `conversation_context`
3. `portfolio_context`
4. `market_resolver`
5. `market_research`
6. `risk_sizing`
7. `behavioral_friction`
8. `strategy_selection`
9. `ai_risk_brief`
10. `final_response`

Target workflow:

1. `intent_extraction`
2. `conversation_context`
3. `portfolio_context`
4. `market_resolver`
5. `market_research`
6. `portfolio_impact_analysis`
7. `risk_sizing`
8. `behavioral_friction`
9. `strategy_selection`
10. `ai_risk_brief`
11. `final_response`

`portfolio_impact_analysis` should run after market data is resolved and before risk sizing, because it needs the trade symbol, price, planned budget, account value, and current holdings.

## New Module

Add:

```text
src/agent-skills/portfolio-impact-analysis.mjs
```

Export:

```js
export function runPortfolioImpactAnalysisSkill({ trade, portfolio, market })
```

Input:

- `trade.symbol`
- `trade.plannedBudget`
- `trade.currentPrice`
- `trade.accountValue`
- `trade.cashAvailable`
- `trade.currentShares`
- `portfolio.cash`
- `portfolio.holdings`
- `market.annualizedVolatility`
- `market.return20d`
- `market.maxDrawdown60d`

Output shape:

```js
{
  symbol: "MSFT",
  before: {
    totalValue: 50000,
    cash: 10000,
    cashWeight: 0.2,
    symbolWeight: 0.04,
    topHolding: { symbol: "NVDA", weight: 0.22 },
    topTheme: { theme: "AI / Semiconductors", weight: 0.36 }
  },
  after: {
    totalValue: 50000,
    cash: 0,
    cashWeight: 0,
    symbolWeight: 0.34,
    topHolding: { symbol: "MSFT", weight: 0.34 },
    topTheme: { theme: "Technology", weight: 0.52 }
  },
  deltas: {
    cashWeightChange: -0.2,
    symbolWeightChange: 0.3,
    topThemeWeightChange: 0.16
  },
  flags: [
    {
      title: "Cash depletion",
      severity: "high",
      detail: "This trade would use nearly all available cash."
    }
  ],
  riskAdjustment: {
    scoreDelta: 18,
    sizeMultiplier: 0.5,
    recommendationBias: "reduce"
  },
  beginnerSummary: "This trade would make MSFT a large position and consume most available cash, so Iceberg should reduce size before considering entry."
}
```

## Portfolio Impact Rules

Use deterministic rules first. AI can explain the result, but should not own the math.

### Cash Rules

- After-trade cash weight below 3%: high severity.
- After-trade cash weight below 8%: medium severity.
- Planned budget greater than cash available: high severity.

### Single-Name Rules

- After-trade symbol weight above 25%: high severity.
- After-trade symbol weight above 18%: medium severity.
- Symbol weight increase above 10 percentage points in one trade: medium severity.
- If already holding the symbol and adding more: medium severity by default.

### Theme Rules

Need infer or map theme for the new trade.

Phase 1:

- Use existing holding theme if the user already holds the symbol.
- Otherwise infer theme from symbol/name using the existing `inferTheme` logic indirectly, or create an exported helper from `portfolio-advisor.mjs`.

Phase 2:

- Add a lightweight ticker-to-theme map for common beginner tickers:
  - NVDA, AMD, AVGO, SMH -> AI / Semiconductors
  - MSFT, AAPL, GOOGL, META, AMZN -> Mega-cap Technology
  - TSLA -> Consumer Discretionary
  - VTI, VOO, SPY, QQQ -> Broad Market / Index
  - BND, TLT, SGOV -> Bonds / Cash-like

Rules:

- After-trade non-core theme weight above 45%: high severity.
- After-trade non-core theme weight above 35%: medium severity.
- Theme weight increase above 10 percentage points in one trade: medium severity.

### Market Risk Rules

- Market volatility above 55% annualized and symbol weight above 15%: high severity.
- 20-day return above 18% and planned budget above 10% of account: medium severity.
- 60-day drawdown worse than -25% and planned budget above 10% of account: medium severity.

## Integration Changes

### `src/agent-skills/index.mjs`

Add export:

```js
export { runPortfolioImpactAnalysisSkill } from "./portfolio-impact-analysis.mjs";
```

Add skill catalog item:

```js
{
  id: "portfolio_impact_analysis",
  purpose: "Compare the user's portfolio before and after the proposed trade and produce concentration, cash, and theme-risk adjustments."
}
```

### `src/iceberg-agent.mjs`

After market resolution and before `runRiskSizingSkill`:

```js
const portfolioImpact = runPortfolioImpactAnalysisSkill({ trade, portfolio, market });
trace.push({
  step: "portfolio_impact_analysis",
  scoreDelta: portfolioImpact.riskAdjustment.scoreDelta,
  sizeMultiplier: portfolioImpact.riskAdjustment.sizeMultiplier,
  flags: portfolioImpact.flags.map((flag) => flag.title),
});
```

Pass `portfolioImpact` into:

- `runRiskSizingSkill`
- `runStrategySelectionSkill`
- `runFinalResponseSkill`
- response payload as `workflow.portfolioImpact`

### `src/agent-skills/risk-sizing.mjs`

Current risk sizing wraps `analyzeAdvisorTrade`.

Add optional `portfolioImpact` input:

```js
export function runRiskSizingSkill(trade, market, portfolioImpact = null)
```

Apply:

- Increase report `riskScore` by `portfolioImpact.riskAdjustment.scoreDelta`.
- Reduce `suggestedShares` and `suggestedDollars` by `sizeMultiplier`.
- Preserve original sizing in `prePortfolioImpactSizing` for transparency.
- Add portfolio impact flags into `report.flags`.

Rule:

- Never allow portfolio impact to increase size. It can only leave size unchanged or reduce it.

### `src/agent-skills/strategy-selection.mjs`

Add `portfolioImpact` input.

Strategy overrides:

- If any high severity portfolio flag exists: prefer `reduce` or `wait`.
- If after-trade single-name weight > 25%: `wait`.
- If cash depletion high and trade is not a broad index ETF: `reduce`.
- If theme crowding high: `reduce`.

Add rationale lines:

- "After this trade, MSFT would become X% of the portfolio."
- "Cash would fall from X% to Y%."
- "Technology exposure would rise to X%."

### `src/agent-skills/final-response.mjs`

Add a new section between market research and risk sizing:

```text
Step 3 - Portfolio impact:
This trade would move MSFT from 4% to 22% of your account and reduce cash from 20% to 5%. That means the correct trade is smaller than your requested amount.
```

Then renumber later steps:

1. Intent extraction
2. Market research
3. Portfolio impact
4. Risk sizing
5. Strategy selection
6. Final response

### `src/app.mjs`

Render a new UI block inside the order review card:

```text
Portfolio Impact
Before: MSFT 4%, cash 20%
After: MSFT 22%, cash 5%
Risk: Theme crowding, cash depletion
```

Keep it beginner-readable. Do not expose too many raw metrics.

## UI Requirements

The UI should remain conversation-first and lightweight.

Add one compact section to `renderOrderReview(result)`:

- Title: `Portfolio impact`
- Three metrics:
  - `Position after`
  - `Cash after`
  - `Main concern`
- One short sentence summary.

Avoid a complex dashboard in the Ask tab. The Portfolio tab can remain the detailed place.

## Tests

Add unit tests:

```text
tests/portfolio-impact-analysis.test.mjs
```

Cases:

1. New MSFT buy consumes too much cash.
2. Adding NVDA when already holding NVDA increases concentration.
3. Buying a broad ETF receives lower portfolio penalty than buying a single stock.
4. High-volatility stock plus high post-trade weight creates high severity flag.
5. No portfolio provided returns neutral impact and does not crash.

Update existing tests:

- `tests/agent-skills.test.mjs`
- `tests/iceberg-agent.test.mjs`
- `tests/persona-regression.test.mjs`

Required assertions:

- Agent trace includes `portfolio_impact_analysis`.
- Workflow steps include portfolio impact.
- Strategy selection changes to reduce/wait when portfolio risk is high.
- Final response mentions portfolio impact in beginner language.

## Implementation Phases

### Phase 1: Deterministic Portfolio Impact Engine

Files:

- `src/agent-skills/portfolio-impact-analysis.mjs`
- `src/agent-skills/index.mjs`
- `tests/portfolio-impact-analysis.test.mjs`

Deliverable:

- Pure function that compares before/after portfolio and outputs flags, size multiplier, score delta, and beginner summary.

### Phase 2: Agent Pipeline Integration

Files:

- `src/iceberg-agent.mjs`
- `src/agent-skills/risk-sizing.mjs`
- `src/agent-skills/strategy-selection.mjs`
- `src/agent-skills/final-response.mjs`
- `tests/iceberg-agent.test.mjs`

Deliverable:

- Every full trade plan includes portfolio impact in trace, workflow, risk sizing, strategy, and final response.

### Phase 3: UI Integration

Files:

- `src/app.mjs`
- `src/styles.css`

Deliverable:

- Order Review card shows a simple portfolio impact section.
- The UI remains readable for beginner traders.

### Phase 4: Screenshot-to-Trade Regression

Files:

- `tests/portfolio-screenshot-agent.test.mjs`
- `tests/persona-regression.test.mjs`

Deliverable:

- Uploaded holdings affect a later trade recommendation.
- Example: user imports a portfolio heavy in NVDA/TSLA, then asks to buy MSFT/NVDA. Agent reduces size because portfolio risk worsens.

## Acceptance Criteria

The feature is complete when:

- A user can upload a portfolio screenshot.
- The parsed portfolio is saved.
- A later chat trade uses that portfolio automatically.
- The final trade plan explicitly includes before/after portfolio impact.
- The sizing recommendation can be reduced because of portfolio impact.
- The strategy recommendation can become reduce/wait because of portfolio impact.
- Tests prove the same trade receives different recommendations with different portfolios.

## Product Principle

The user should feel:

"Iceberg understands my account, not just the ticker."

The agent should never sound like a stock-picking chatbot. It should sound like a calm risk layer that notices when one trade makes the whole account worse.
