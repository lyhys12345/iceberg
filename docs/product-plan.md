# Iceberg App Product Plan

## One-line Positioning

Iceberg is a pre-trade discipline app for beginner investors and impulsive traders. It does not predict the market or recommend trades. It helps users slow down before placing a trade, identify emotional risk, and enforce rules they made while calm.

## Core Product Thesis

Most retail trading products reduce friction: faster account opening, faster order entry, more alerts, more lists, more charts. Iceberg goes in the opposite direction. Its value is useful friction.

The user does not need another app telling them to be rational. They need a system that changes the cost of impulsive behavior at the exact moment they are about to trade.

## Target Users

Primary target: beginner retail investors who recently started buying individual stocks, ETFs, options, or crypto and are vulnerable to FOMO, hot tips, and social-media-driven buying.

Secondary target: active traders who already know they have weak discipline, especially people who overtrade, revenge trade, chase winners, or increase position size after losses.

The early adopter is probably not the pure beginner who thinks they are brilliant. The early adopter is the user who has already been hurt by impulsive trades and is looking for a personal guardrail.

## What Iceberg Is Not

- Iceberg is not a stock-picking app.
- Iceberg is not a brokerage.
- Iceberg is not a financial advisor.
- Iceberg is not an AI buy/sell signal product.
- Iceberg is not trying to maximize trading frequency.

The safest and clearest framing is: Iceberg measures behavioral risk, not investment merit.

## MVP Use Case

Before opening a brokerage app and placing a buy order, the user opens Iceberg and runs a pre-trade check.

The check should take less than 60 seconds. It asks what the user wants to buy, how much they plan to buy, why they want to buy, what emotion they are feeling, what loss they can accept, and what their exit condition is.

Iceberg returns a discipline report: risk level, triggered rules, reason for friction, and the next action.

## MVP Success Criteria

- A user can complete a trade check in under 60 seconds.
- The app produces a clear behavioral risk score.
- High-risk trades trigger a cooldown, confirmation, or reduced-size suggestion.
- Every check is saved into a trading journal.
- Users can later review whether they executed, delayed, cancelled, or regretted the trade.
- Early users can name at least one trade Iceberg helped them avoid or delay.

## Core Modules

### 1. Rules Setup

Users define rules while calm. These rules become the standard that Iceberg enforces later.

Suggested v1 rules:

- Single-trade maximum amount.
- Maximum single-symbol position size as a percentage of portfolio.
- Maximum number of trades per day.
- Cooldown requirement after a large short-term price move.
- Cooldown requirement after consecutive losses.
- Required exit condition for every non-plan trade.
- Rule changes take effect only after a delay, such as 24 hours, so users cannot weaken their rules while emotional.

### 2. Pre-trade Check

Required inputs:

- Ticker or asset name.
- Asset type: stock, ETF, option, crypto, or other.
- Planned buy amount.
- Portfolio value.
- Current position size.
- Buy reason.
- Emotion: calm, excited, FOMO, anxious, revenge trading, plan-based, or unsure.
- Planned holding period.
- Maximum acceptable loss.
- Exit condition.

Output:

- Behavioral risk level: low, medium, high, or extreme.
- Risk score from 0 to 100.
- Triggered rules.
- Plain-language explanation.
- Recommended friction action.

### 3. Friction Engine

- Low risk: record and allow the user to proceed.
- Medium risk: require an exit condition and loss acceptance confirmation.
- High risk: start a cooldown before the user can mark the trade as approved.
- Extreme risk: start a longer cooldown, block repeated same-day checks for the same asset, or require stronger written confirmation.

The app should avoid language like "do not buy." Use language like "this trade violates your rules" or "this looks behaviorally high-risk."

### 4. Cooldown Flow

Cooldown page should show:

- Countdown timer.
- Original buy reason.
- Triggered risk factors.
- Reflection prompts.
- A button to cancel the trade.
- A button to revise the plan after the cooldown.

Reflection prompts:

- Would I still want this trade tomorrow?
- What will I do if it drops 10 percent immediately?
- Am I acting on a plan or reacting to price movement?
- Is this trade worth using my risk budget?
- What evidence would prove my thesis wrong?

### 5. Trading Journal

Every pre-trade check becomes a journal entry.

Saved fields:

- Timestamp.
- Asset.
- Planned amount.
- Emotion.
- Buy reason.
- Risk level.
- Triggered rules.
- Cooldown status.
- Final decision: executed, delayed, cancelled, or ignored.
- Follow-up result.
- User reflection.

Future insight examples:

- Your FOMO trades have worse outcomes than planned trades.
- You tend to chase after large short-term moves.
- Cooldowns prevented several trades that later moved against you.
- Your largest losses came from trades without exit conditions.

## Risk Scoring V1

Use a transparent rules engine first. AI can explain and summarize, but it should not be the final judge.

Example scoring:

- Emotion is FOMO, excited, anxious, or revenge trading: +20.
- No clear exit condition: +20.
- Planned amount exceeds rule limit: +25.
- Position would exceed max concentration rule: +25.
- Reason mentions recent price move, hot tip, news hype, or social media: +15.
- Holding period is unclear: +10.
- Maximum acceptable loss is missing or inconsistent with position size: +20.
- User recently submitted multiple checks in the same day: +10.
- User is trying to change rules immediately before trade: +30.

Risk levels:

- 0-29: low.
- 30-59: medium.
- 60-79: high.
- 80-100: extreme.

## AI Role

AI should act as a Discipline Coach, not a Stock Advisor.

Good AI tasks:

- Classify the user's written reason as plan-based, FOMO-driven, revenge-driven, news-driven, or unclear.
- Rewrite the risk explanation in plain language.
- Ask one or two relevant reflection questions.
- Summarize the user's recurring behavioral patterns over time.
- Compare planned trades vs impulsive trades based on the user's own journal.

Avoid:

- Price targets.
- Buy/sell recommendations.
- Claims that a trade is good or bad from an investment-return perspective.
- Market predictions.

## Suggested Product Copy

Product tagline: Cool down before you trade.

Positioning line: Iceberg helps investors see the risk beneath the trade.

User-facing promise: Stop the trades you already know you will regret.

Risk report language example:

> This trade is behaviorally high-risk. It violates your single-trade size rule, has no exit condition, and your reason appears driven by recent price movement. Iceberg recommends a cooldown before you proceed.

## Technical Approach

Recommended MVP: Web app or PWA.

Suggested stack:

- Frontend: Next.js or React.
- Styling: Tailwind CSS.
- Database: Supabase or local-first SQLite for the earliest prototype.
- Auth: email login, or anonymous local mode for initial testing.
- Market data: manual input first, then add an API later.
- AI: use only for reason classification and coaching text.
- Notifications: cooldown completion reminders.

Do not integrate brokerage execution in v1. Brokerage integration adds security, compliance, API, and legal complexity before the behavioral value has been proven.

## Page Map

- Dashboard: discipline status, today's checks, active cooldowns, recent high-risk trades.
- New Check: the 60-second pre-trade form.
- Risk Report: score, triggers, explanation, and next action.
- Cooldown: timer, original reason, reflection prompts, cancel or revise.
- Journal: history, filters, outcome tracking, reflections.
- Rules: personal guardrails and delayed rule-change queue.
- Insights: recurring patterns and personal behavioral evidence.

## Data Model

- `users`: account and preferences.
- `trading_rules`: active rules, pending rule changes, delay policy.
- `trade_checks`: all pre-trade submissions.
- `cooldowns`: active and completed cooldowns.
- `journal_entries`: final decision and reflection.
- `outcomes`: later performance and regret/avoidance notes.

Important `trade_checks` fields:

`symbol`, `asset_type`, `intended_amount`, `portfolio_value`, `current_position`, `reason`, `emotion`, `holding_period`, `max_loss`, `exit_plan`, `risk_score`, `risk_level`, `triggered_rules`, `recommended_action`, `final_decision`.

## Go-to-market Wedge

The strongest early message is not "AI investing assistant." That category is crowded and can create compliance risk.

Better wedge:

> A trading discipline app that stops impulsive trades before they happen.

Channels to test:

- Reddit communities for trading discipline and beginner investing.
- TikTok/YouTube creators discussing trading mistakes.
- Discord trading communities.
- Personal finance newsletters.
- Trading coaches or educators.
- Small beta group of users who admit they overtrade.

## Pricing Hypothesis

- Free: basic checks and journal.
- Paid individual plan: cooldowns, rules engine, insights, AI coach.
- Potential price: $9 to $19 per month.
- Power-user plan: app blocking, browser extension, advanced analytics, coach/supervisor sharing.

## Early Validation Questions

- Will users open Iceberg before opening a brokerage app?
- Which friction feels helpful vs annoying?
- Do cooldowns actually reduce executed high-risk trades?
- Do users trust a behavioral risk score?
- Will users pay for being stopped?
- Which segment feels the pain most strongly: beginners, options traders, crypto traders, or active stock traders?

## Key Risk

The biggest product risk is not scoring accuracy. It is timing. Iceberg must appear when the user is about to trade.

Possible solutions:

- Browser extension for brokerage websites and TradingView.
- Mobile widget or shortcut.
- App blocker integration.
- Share-sheet flow from news or stock pages.
- Cooldown notifications.
- Trading approval code ritual.
- Supervisor or accountability partner option.

## Four-week Build Plan

Week 1: Prototype the core flow. Build Dashboard, New Check, Risk Report, Cooldown, Journal, and Rules as static screens. Define scoring rules and product copy.

Week 2: Build functional MVP. Implement local storage or Supabase, risk scoring, cooldown timers, saved journal entries, and editable rules.

Week 3: Add coaching layer. Add AI reason classification, risk explanation generation, reflection prompts, and basic insight summaries.

Week 4: Test with users. Recruit 10 to 20 users who admit they make impulsive trades. Measure usage before trades, delayed trades, cancelled trades, and perceived money saved.

## Next Build Milestone

Build a working Web/PWA prototype with five usable flows:

1. Set rules.
2. Submit pre-trade check.
3. View risk report.
4. Enter cooldown.
5. Save final decision to journal.

The first version should be sharp, not broad. Iceberg should be remembered as the app that adds useful friction before a trade.
