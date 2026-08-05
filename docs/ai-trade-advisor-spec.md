# Iceberg AI Trade Advisor Spec

## Product Shift

Iceberg is moving from a pure behavioral friction app toward an AI pre-trade risk advisor.

The user wants to enter a stock ticker and have Iceberg estimate whether the trade fits the user's portfolio, risk budget, and protection plan.

This is a stronger product, but it also creates more compliance risk. The safest product framing is:

Iceberg is a personal risk officer. It evaluates whether a proposed trade fits the user's own rules and assumptions.

## User Input

The advisor flow should collect:

- Stock ticker
- Buy or sell direction
- Investment horizon
- Account value
- Available cash
- Current shares owned
- Planned trade budget
- Maximum account risk per trade
- Estimated win probability
- Estimated upside
- Estimated downside
- Stop-loss distance
- Take-profit distance
- Kelly fraction

The default UX should not expose this list as a long form. Beginners should start from a conversation, and the app should infer what it can, ask for missing information, then show the advanced assumptions only as an optional inspection panel.

Later versions should add:

- Average cost
- Existing portfolio concentration
- Options positions
- Tax lots
- Holding period
- User thesis
- User emotional state
- Existing hedges

## AI and Data Workflow

1. User enters ticker and portfolio details.
2. Market data provider fetches recent price history.
3. Market snapshot calculates recent returns, volatility, drawdown, range, and trend.
4. Advisor engine combines market snapshot with user risk settings.
5. Kelly sizing estimates a theoretical position size.
6. Fractional Kelly reduces the size for retail safety.
7. Protection engine suggests stop, target, entry staging, and position cap.
8. Final report explains whether the trade should be avoided, reduced, or considered with rules.

## Kelly Formula

The basic Kelly formula is:

```text
f* = (bp - q) / b
```

Where:

- `f*` is the theoretical fraction of capital to risk.
- `b` is payoff ratio, upside divided by downside.
- `p` is estimated probability of winning.
- `q` is probability of losing, or `1 - p`.

Iceberg should not use full Kelly for retail users. The product should use fractional Kelly by default:

```text
recommended fraction = full Kelly * 0.25
```

The final suggested size should be the smallest of:

- Planned budget
- Available cash
- Risk budget based on stop-loss distance
- Fractional Kelly dollar cap

The default Kelly fraction should be 25 percent of full Kelly. Users may adjust the fraction, but the UI should keep the default conservative.

## Protection Output

The report should show:

- Suggested maximum shares
- Suggested maximum dollars
- Full Kelly percentage
- Fractional Kelly percentage
- Stop-loss price
- Take-profit price
- Bull/base/bear scenario
- Concentration warning
- Volatility warning
- Staged entry plan

## Compliance Boundary

The product must be careful with wording.

Allowed:

- "Avoid for now."
- "Only small size with protection."
- "Consider with rules."
- "This estimate does not fit your risk budget."
- "This violates your own risk settings."

Avoid:

- "You should buy this stock."
- "This stock is a buy."
- "This will go up."
- "Guaranteed downside protection."

The product can provide decision support, but legal review is required before charging users for personalized securities advice.

## Current Implementation

The current implementation is a browser app with a lightweight Node backend.

Added modules:

- `src/market-data.mjs`
- `src/advisor-engine.mjs`
- `src/openai-risk-agent.mjs`

The market data module attempts to fetch recent daily prices through the backend. If `ALPHA_VANTAGE_API_KEY` is configured, the server uses Alpha Vantage daily prices first. If that fails, it falls back to the no-key public provider. If all live requests fail, the UI can still run using the user's manually entered price.

The advisor engine is deterministic and testable. Hard sizing and risk rules do not depend on AI. The OpenAI-backed risk brief is an explanation layer. If `OPENAI_API_KEY` is not configured or the request fails, the app keeps the local deterministic brief.

API keys must stay on the backend. The frontend calls `/api/market/:symbol` and `/api/ai-risk-brief`.
