# Iceberg

Cool down before you trade.

Iceberg is a pre-trade discipline app for beginner investors and impulsive traders. It does not predict the market or recommend trades. It helps users slow down before placing a trade, identify emotional risk, and enforce rules they made while calm.

## Product Thesis

Most retail trading products reduce friction: faster account opening, faster order entry, more alerts, more lists, more charts. Iceberg goes in the opposite direction. Its value is useful friction.

The user does not need another app telling them to be rational. They need a system that changes the cost of impulsive behavior at the exact moment they are about to trade.

## MVP

Before opening a brokerage app and placing a buy order, the user opens Iceberg and runs a pre-trade check.

The check should take less than 60 seconds. It asks:

- What do you want to buy?
- How much do you plan to buy?
- Why do you want to buy?
- What emotion are you feeling?
- What loss can you accept?
- What is your exit condition?

Iceberg returns a discipline report with a behavioral risk score, triggered rules, and a recommended friction action.

## Core Flows

- Set personal trading rules.
- Submit a pre-trade check.
- View a risk report.
- Enter a cooldown when risk is high.
- Save the final decision to the trading journal.

## Positioning

Iceberg is not a stock-picking app, brokerage, financial advisor, or AI buy/sell signal product.

Iceberg measures behavioral risk, not investment merit.

See [docs/product-plan.md](docs/product-plan.md) for the full product plan.

See [docs/development-roadmap.md](docs/development-roadmap.md) for the step-by-step software development plan.

See [docs/ai-trade-advisor-spec.md](docs/ai-trade-advisor-spec.md) for the AI pre-trade advisor specification.

See [docs/mvp-qualification.md](docs/mvp-qualification.md) for the current MVP qualification checklist.

## Prototype

The first MVP is a static web app that runs entirely in the browser:

- AI-style trade advisor for ticker research, Kelly sizing, scenarios, and protection planning
- Local AI risk brief preview for behavior and sizing risks
- Pre-trade trade intent form
- Behavioral risk score
- Rule-triggered recommendations
- High-risk cooldown timer
- Personal rule settings
- Local decision journal

Open `index.html` in a browser to try the prototype, or run the local server to enable the market-data proxy:

```sh
node server.mjs
```

## Development

Run the pure risk-engine tests with:

```sh
npm test
npm run check
```
