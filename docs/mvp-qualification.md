# Iceberg MVP Qualification Checklist

## MVP Definition

Iceberg is considered a qualified early MVP when a real user can:

1. Enter a ticker and portfolio context.
2. Pull or enter current market price.
3. Generate a pre-trade risk plan.
4. Understand recommended size, downside, upside, and protection.
5. Save the plan before placing the trade.
6. Review prior decisions later.
7. Export their data.

The MVP does not need brokerage execution, paid accounts, or a live LLM to be useful. Those come after the workflow proves that users will actually run Iceberg before trading.

## What Is Now Implemented

- Advisor flow for ticker, portfolio, risk assumptions, and trade horizon.
- Beginner-friendly conversational flow that can ask for missing information.
- Simplified default navigation: Ask, History, Settings, Classic.
- Kelly and fractional Kelly sizing.
- Suggested shares and dollar size.
- Bull, base, bear, and stop-loss scenarios.
- Stop-loss, take-profit, position cap, volatility buffer, and staged entry plan.
- Local market-data provider with a Node server proxy route.
- Manual price fallback when live market data is unavailable.
- Advisor plan persistence.
- Combined history for advisor plans and discipline checks.
- JSON and CSV export.
- Local user risk assumption persistence.
- Adjustable Kelly fraction with conservative 25 percent default.
- Local AI risk brief preview for behavioral and sizing interpretation.
- Clean first-run advisor state with explicit "Load example" behavior.
- Lightweight first-run risk profile panel.
- Browser smoke test coverage by manual Playwright check.
- Unit tests for risk engine, advisor engine, and market data parsing.

## Product Gaps Before First User Testing

### 1. Full Guided Onboarding

The app now avoids a misleading prefilled ticker and shows a lightweight setup panel. A fuller setup wizard can come before public beta.

Acceptance criteria:

- App detects first run and opens a setup panel.
- User can set account value, cash, max risk percentage, default stop-loss, and preferred fractional Kelly level.
- App explains each risk assumption before the first generated plan.

### 2. Real Market Data Provider

The current local proxy is enough for a demo, but production should not depend on public no-key data.

Acceptance criteria:

- Backend has a market data adapter interface.
- Provider errors are visible and non-destructive.
- Report clearly shows data source and timestamp.
- Stale data is flagged.

### 3. AI Explanation Layer

The deterministic sizing model should remain the source of truth. AI should explain trade risk and identify missing assumptions.

Acceptance criteria:

- AI output is structured JSON.
- AI cannot directly override hard risk limits.
- Unsafe recommendation wording is filtered.
- App works if AI is unavailable.

### 4. Risk Model Controls

Users should understand and adjust the assumptions behind Kelly sizing.

Acceptance criteria:

- UI explains win probability, upside, downside, stop-loss, and fractional Kelly in plain language.
- Full Kelly is never used as default recommended size.
- Users can switch between quarter Kelly and half Kelly after a warning.

### 5. Compliance Review

Before charging money, Iceberg needs legal review because personalized trade sizing and "avoid/consider" language can look like investment advice.

Acceptance criteria:

- Copy avoids guaranteed outcomes.
- App states that outputs are estimates based on user assumptions.
- Terms and privacy policy exist.
- Product does not claim to predict market direction.

## Next Build Order

1. Add guided first-run onboarding.
2. Add explainers/tooltips for Kelly and downside assumptions.
3. Add stale-data warnings.
4. Add AI explanation mock layer.
5. Add backend API boundary for OpenAI.
6. Add deployable hosting setup.
