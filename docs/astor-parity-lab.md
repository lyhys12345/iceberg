# Astor Parity Lab

Iceberg should study Astor's public product surface without copying its brand, proprietary workflows, visual design, or advisory claims. The goal is feature literacy: understand what a broad AI investment advisor covers, then sharpen Iceberg around the pre-trade risk layer.

## Public Features To Track

- AI investment advisor chat with portfolio context.
- Connected or manually entered financial accounts.
- Portfolio risk, performance, diversification, and benchmark context.
- Personalized financial plan.
- Daily market recap tied to holdings.
- Stock research and monitoring.
- What To Sell / trim candidates.
- Tickers For You / personalized watchlist ideas.
- Demo mode and beginner-friendly onboarding.

## Iceberg Translation

- Portfolio tab: manual account entry, holdings parsing, risk profile, time horizon, cash, and monthly contribution.
- Portfolio Pulse: plain-language summary of what currently drives risk.
- Financial Plan: next calm moves before adding risk.
- What To Sell: trim candidates based on concentration and theme crowding.
- Tickers For You: research watchlist ideas based on portfolio gaps, framed as education instead of personalized investment advice.
- Stock Research: ticker dossier that combines live market snapshot, volatility, drawdown, and current holding context.
- Ask integration: saved portfolio defaults fill account value, cash, and current shares when a user asks about a ticker.

## Differentiation Hypothesis

Astor is the broad AI advisor: it helps users understand their whole financial picture and make investment decisions.

Iceberg should be the trade firewall: it sits immediately before action and answers, "Should I place this order, how much, and what protection must exist first?"

That means Iceberg should prioritize:

- Friction before execution.
- Kelly-based sizing and cash-aware limits.
- Concentration and correlation gates.
- Downside-first scenario analysis.
- Clear "do nothing" recommendations.
- Simple beginner language over advisor-like completeness.

## Current Implementation

The first parity layer is implemented in `src/portfolio-advisor.mjs` and exposed through the new Portfolio tab in `index.html`. It is deterministic and testable, with no brokerage connection yet. Brokerage linking, real recurring reports, and regulatory positioning remain future work.
