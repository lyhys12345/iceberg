# Iceberg Software Development Roadmap

## Purpose

This document turns the Iceberg product idea into a step-by-step software development plan.

Iceberg is an AI pre-trade risk layer for retail investors and impulsive traders. The product should not recommend whether a trade will make money. It should help users slow down before execution, detect behavioral risk, enforce rules made while calm, and create enough friction to prevent regret-driven trades.

The main engineering principle is simple:

Build the smallest product that can change user behavior before building the most complete trading platform.

## Product Guardrails

Iceberg must stay inside these boundaries:

- Do not provide investment advice or stock recommendations.
- Do not say a user should buy or sell a security.
- Do not claim to predict market direction.
- Do not execute trades in v1.
- Do not connect to brokerage accounts until the core pre-trade workflow proves useful.
- Explain behavioral and rule-based risk instead of market merit.
- Treat user trade history and financial data as sensitive from day one.

Preferred language:

- "This trade violates your rules."
- "This appears behaviorally risky."
- "Cooldown recommended."
- "Define your downside before proceeding."

Avoid language:

- "Buy this."
- "Do not buy this."
- "This stock is good."
- "This trade will lose money."

## Development Strategy

We will build Iceberg in six milestones:

1. Static local MVP
2. Usable browser MVP
3. PWA with persistent user state
4. AI pre-trade risk layer
5. Browser extension friction layer
6. Account system, sync, and paid beta

Each milestone should be shippable, testable, and useful on its own.

## Milestone 1: Static Local MVP

Status: In progress.

Goal: Prove the core user flow without backend, authentication, brokerage integration, or AI API cost.

User story:

As a trader, before I place an order, I can enter my trade idea into Iceberg and receive a behavioral risk report.

Current scope:

- Single-page web app.
- Pre-trade intent form.
- Rule-based risk engine.
- Behavioral risk score.
- Triggered risk findings.
- Cooldown timer for high-risk trades.
- Personal rule settings.
- Local decision journal.
- Pure local storage.

Files:

- `index.html`
- `src/app.mjs`
- `src/risk-engine.mjs`
- `src/styles.css`
- `tests/risk-engine.test.mjs`

Acceptance criteria:

- User can enter symbol, asset type, trade size, account size, max loss, thesis, emotion level, and trade drivers.
- App returns a risk score from 0 to 100.
- App identifies at least these risks: no max loss, loss limit exceeded, account risk too high, weak thesis, high emotion, revenge trading, FOMO, news-driven entry, options friction.
- Hard rule violations cannot be cancelled out by a good written plan.
- High-risk trades trigger a cooldown.
- User can save passed or blocked decisions into the journal.
- Risk engine tests pass.

Validation:

```sh
node tests/risk-engine.test.mjs
```

Manual test script:

1. Open the app.
2. Submit the default demo trade.
3. Confirm the trade is blocked or slowed.
4. Confirm cooldown appears for high-risk trades.
5. Save the decision as blocked.
6. Confirm the journal and sidebar metrics update.
7. Change rules and rerun the same trade.
8. Confirm the report changes based on the new rules.

## Milestone 2: Usable Browser MVP

Goal: Turn the local prototype into a product-like web app that early users can test repeatedly.

Primary tasks:

- Add a clearer onboarding flow.
- Replace demo defaults with an empty first-run state.
- Add sample trades only behind a "load example" button.
- Improve mobile layout for one-handed use.
- Add empty, loading, saved, and error states.
- Add export/import for user rules and journal data.
- Add a weekly review screen.
- Add a "trade avoided" metric.
- Add stronger copy that makes the product feel like a calm trading checkpoint.

Screens:

- Onboarding
- Rules setup
- Pre-trade check
- Risk report
- Cooldown
- Journal
- Weekly review

Acceptance criteria:

- First-time user understands what Iceberg does in less than 30 seconds.
- User can complete a normal pre-trade check in less than 60 seconds.
- User can use the app on mobile width without text overflow or broken layout.
- User can export local journal data as JSON or CSV.
- User can reset local data safely.
- No visible UI copy claims to offer investment advice.

Suggested tests:

- Risk engine unit tests.
- Basic browser smoke test.
- Manual mobile viewport review.
- Manual copy review for compliance-sensitive language.

## Milestone 3: PWA With Persistent User State

Goal: Make Iceberg installable and habit-forming before building a full backend.

Primary tasks:

- Add a web app manifest.
- Add app icon assets.
- Add service worker for offline use.
- Add local IndexedDB storage instead of only localStorage.
- Add versioned data schema.
- Add local migration utilities.
- Add reminder prompts that do not depend on push notifications.
- Add "quick check" mode for fast repeated use.

Data model:

- User rules
- Trade checks
- Risk reports
- Cooldowns
- Journal decisions
- Weekly summaries
- App settings

Acceptance criteria:

- User can install Iceberg as a PWA.
- App works without internet.
- User data persists after closing and reopening the app.
- Data migrations can handle at least one schema version bump.
- User can export all local data.
- User can delete all local data.

Technical recommendation:

- Keep frontend framework-free until complexity requires a framework.
- Introduce TypeScript when data models and state transitions become harder to maintain.
- Consider Vite only when build tooling becomes useful for tests, bundling, and deployment.

## Milestone 4: AI Pre-Trade Risk Layer

Goal: Add AI where it creates clear product differentiation: reading the user's stated reason, detecting emotional patterns, and generating personalized friction.

AI should analyze:

- Trade thesis quality
- Missing invalidation point
- Missing exit condition
- Emotional language
- Revenge trading language
- FOMO language
- Overconfidence language
- Repeated behavior from journal history
- Conflict with user's own rules

AI should not:

- Recommend buying or selling.
- Forecast price direction.
- Invent market facts.
- Claim a trade is good or bad as an investment.
- Use unsupported financial data.

Architecture:

- Keep deterministic rule engine as the source of truth for hard rule violations.
- Use AI as an explanation and pattern-detection layer.
- Return structured JSON from the AI layer.
- Validate AI output before displaying it.
- Fall back to deterministic report if AI fails.

Suggested AI output schema:

```json
{
  "behavioral_pattern": "fomo | revenge | overconfidence | plan_based | unclear",
  "confidence": 0.0,
  "missing_items": ["max_loss", "exit_condition"],
  "reflection_prompt": "What would make this trade invalid?",
  "summary": "This trade appears driven by urgency rather than a written plan."
}
```

Primary tasks:

- Add `src/ai-risk-layer` module boundary.
- Add prompt templates.
- Add JSON schema validation.
- Add red-team tests for unsafe advice wording.
- Add local mock AI responses for development.
- Add environment-based API configuration.
- Add AI result display in the report panel.

Acceptance criteria:

- AI can identify FOMO, revenge trading, and weak thesis patterns from text.
- AI output is always shown as behavioral analysis, not investment advice.
- If AI is unavailable, the app still works with deterministic rules.
- Unsafe AI language is filtered or replaced.
- No API key is committed to GitHub.

## Milestone 5: Browser Extension Friction Layer

Goal: Move Iceberg closer to the real moment of trading by adding friction before users open or use brokerage websites.

Why this matters:

A standalone app relies on user self-control. The extension can intercept the moment when the user visits a brokerage, charting site, or trading page.

Primary tasks:

- Build Chrome extension manifest.
- Let users configure watched domains.
- Detect visits to brokerage or trading websites.
- Show an Iceberg pre-trade checkpoint overlay.
- Add cooldown lockout for high-risk checks.
- Add "continue anyway" logging with friction.
- Sync extension data with web app local state.

Initial watched domains:

- robinhood.com
- webull.com
- fidelity.com
- schwab.com
- etrade.com
- interactivebrokers.com
- coinbase.com
- tradingview.com

Acceptance criteria:

- Extension can detect configured trading domains.
- Extension can open the Iceberg check flow before the user proceeds.
- Extension does not collect page content beyond configured domain and user action unless explicitly needed.
- User can disable or edit watched domains.
- Extension logs blocked, delayed, and continued actions.

Security and privacy:

- Request the minimum browser permissions.
- Avoid reading brokerage page details in v1.
- Do not capture credentials, balances, orders, or portfolio details.
- Make all extension behavior transparent to the user.

## Milestone 6: Account System, Sync, and Paid Beta

Goal: Move from local tool to real SaaS beta.

Primary tasks:

- Add backend API.
- Add user authentication.
- Add encrypted cloud sync.
- Add multi-device support.
- Add Stripe billing.
- Add privacy policy and terms.
- Add user feedback collection.
- Add product analytics.
- Add admin dashboard for aggregated non-sensitive metrics.

Recommended stack:

- Frontend: TypeScript, Vite, React when UI complexity increases.
- Backend: Node.js or Python API.
- Database: Postgres.
- Auth: managed auth provider or Supabase Auth.
- Payments: Stripe.
- Analytics: privacy-conscious event tracking.
- Hosting: Vercel, Cloudflare, or similar.

Core backend entities:

- User
- RuleSet
- TradeCheck
- RiskReport
- Cooldown
- JournalEntry
- Subscription
- Feedback

Acceptance criteria:

- User can create an account.
- User can sync rules and journal across devices.
- User can subscribe and manage billing.
- User can export and delete all data.
- App has basic monitoring and error reporting.
- App has a clear privacy policy.

## Compliance and Safety Checklist

Before any public beta:

- Review all product copy for investment-advice risk.
- Add clear educational and behavioral-risk disclaimers.
- Add terms of service.
- Add privacy policy.
- Avoid trading recommendations.
- Avoid performance claims that cannot be proven.
- Avoid claims like "guaranteed downside protection."
- Keep user financial data encrypted where possible.
- Do not sell user trading data.
- Document what data is collected and why.

Important distinction:

Iceberg can help users define downside before a trade. It cannot guarantee downside protection. Professional trading downside protection may involve stops, hedges, position sizing, or portfolio construction. Iceberg should focus on discipline and risk awareness unless we later build regulated or broker-integrated functionality.

## Engineering Review Loop

Every milestone should go through two review passes.

Review pass 1: Product behavior

- Does this feature increase useful trading friction?
- Does it help the user act according to rules made while calm?
- Does it reduce impulsive behavior at the moment of action?
- Can users understand the result without trusting a black box?
- Is the workflow short enough to use repeatedly?

Review pass 2: Engineering and safety

- Is the implementation simple enough for the current stage?
- Are hard risk rules deterministic and testable?
- Does the system avoid investment advice?
- Does it fail safely if AI or network calls fail?
- Is sensitive user data protected?
- Are tests covering the highest-risk logic?

## Current Next Steps

Immediate next step:

Build Milestone 2.

Recommended order:

1. Clean up first-run experience.
2. Add example trade button instead of prefilled demo.
3. Add weekly review screen.
4. Add JSON/CSV export.
5. Add stronger mobile QA.
6. Add compliance-sensitive copy review.
7. Add smoke tests for browser behavior.

First beta target:

Recruit 10 to 20 people who admit they have a trading discipline problem. Ask them to use Iceberg before every discretionary trade for one week.

Measure:

- Checks completed
- Trades blocked
- Trades delayed
- Trades continued anyway
- User-reported regret avoided
- Whether the user would pay $10 to $30 per month

The product becomes interesting if users can name specific trades Iceberg helped them avoid, delay, resize, or rethink.
