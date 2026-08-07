# Iceberg Agent Skill Architecture

Iceberg's AI layer should behave like a pre-trade risk desk, not a single chat prompt. The product now uses a skill chain: each skill owns one job, produces structured output, and can fall back safely when live AI or market data is unavailable.

## Skill Chain

1. `intent_extraction`
   - Classifies the message as greeting, identity, help, or trade.
   - Extracts only explicit trade facts: ticker, side, account value, cash, planned budget, current price, current shares, horizon, and thesis.
   - Uses Gemini first when `GEMINI_API_KEY` is configured. Falls back to local parsing.

2. `portfolio_context`
   - Looks at the user's saved portfolio.
   - Fills missing account value, cash, and current shares only when the user did not explicitly provide them.
   - Prevents the agent from asking beginner users for facts Iceberg already knows.

3. `market_resolver`
   - Searches connected market data providers for the latest available price.
   - Falls back to the saved portfolio price if live data fails.
   - Asks for a current price only when no reliable source exists.

4. `market_research`
   - Converts raw market data into a beginner-readable timing read.
   - Summarizes price, trend, recent returns, volatility, drawdown, stale-data risk, and chase risk.
   - Allows Iceberg to answer "is now a good time?" with facts before asking for missing sizing inputs.

5. `pre_trade_risk_check`
   - Runs deterministic sizing, Kelly estimate, exposure, downside, concentration, and decision logic.
   - Produces the structured risk report used by the UI and AI brief.

6. `risk_sizing`
   - Extracts the actual size recommendation from the deterministic report.
   - Summarizes suggested dollars, shares, stop risk, Kelly cap, cash cap, and future exposure.

7. `behavioral_friction`
   - Detects FOMO, revenge trading, margin/leverage language, and oversized trades.
   - Adds slowdowns or hard stops before the trade reaches execution.

8. `trade_protection_strategy`
   - Converts the risk report into an entry plan, stop guidance, target logic, and strategy stack.
   - Makes the recommendation actionable instead of only saying "risky" or "safe."

9. `ai_risk_brief`
   - Uses Gemini/OpenAI/local fallback to explain the structured report in beginner-friendly language.
   - The AI is a translator and coach; the deterministic risk engine remains the source of truth.

10. `final_response`
   - Composes the user-facing risk memo from intent, market research, risk sizing, strategy, friction, and AI brief.
   - Keeps the answer in decision-friction language: wait, reduce, or consider with rules.

## Product Principle

The app should increase trading friction without overwhelming beginners. The agent should ask for the minimum missing facts, automatically search for market context, and present one clear decision: avoid, reduce, wait, or proceed with a smaller protected trade.

## Future Skills

- `news_catalyst_scan`: summarize recent company news and earnings risk.
- `options_protection`: estimate protective puts, collars, and covered calls.
- `tax_liquidity_check`: flag wash-sale, short-term gain, and liquidity constraints.
- `broker_order_guard`: convert the recommendation into a pre-order checklist before sending to a broker.
- `post_trade_journal`: save the plan and compare future behavior against the original thesis.
