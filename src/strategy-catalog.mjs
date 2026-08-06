export const strategyCatalog = [
  {
    id: "no-trade-wait",
    name: "No Trade / Wait",
    level: "Beginner",
    goal: "Turn an emotional trade into an observation plan.",
    bestFor: "FOMO, weak edge, missing thesis, crowded move, or a trade that cannot fit the risk budget.",
    avoidWhen: "The trade has a clear invalidation level, positive edge, and a small protected size.",
    howItWorks: "Iceberg blocks execution today, records the setup, and asks the user to define the price or event that would make the trade safer later.",
    inputs: ["ticker", "current price", "account value", "planned budget", "reason for buying"],
    steps: [
      "Do not place the order during this session.",
      "Write the invalidation point and the price that would make risk/reward better.",
      "Set a cooling-off window, usually 24 hours for beginners.",
      "Re-check the trade only if price, thesis, or risk budget changes.",
    ],
    output: "No order, watch level, cooldown timer, and a saved journal note.",
  },
  {
    id: "small-starter",
    name: "Small Starter Position",
    level: "Beginner",
    goal: "Let the user participate without letting the first click define the whole trade.",
    bestFor: "High volatility, uncertain timing, recent sharp move, or a beginner who mainly wants to reduce FOMO.",
    avoidWhen: "Commission, liquidity, or account size makes a small position impractical.",
    howItWorks: "Iceberg caps the first order at a small percentage of the planned budget, then requires objective confirmation before adding.",
    inputs: ["planned budget", "risk score", "volatility", "cash available", "stop distance"],
    steps: [
      "Start with 10%-30% of the intended budget.",
      "Place or write down the protective stop before buying.",
      "Add only if the thesis confirms and the future position stays below the exposure cap.",
      "Never average down automatically after the first entry.",
    ],
    output: "Starter dollar amount, starter shares, add conditions, and max loss at stop.",
  },
  {
    id: "risk-capped-position",
    name: "Risk-Capped Position",
    level: "Beginner",
    goal: "Size the trade from maximum acceptable loss instead of excitement.",
    bestFor: "A stock or ETF trade with a clear stop price.",
    avoidWhen: "The user cannot define what price proves the idea wrong.",
    howItWorks: "Position size is calculated from account risk budget divided by per-share loss to the stop.",
    inputs: ["account value", "max risk percent", "entry price", "stop price", "cash available"],
    steps: [
      "Set account risk budget, usually 0.5%-1.0% for beginners.",
      "Choose a logical stop where the thesis is invalid, not a random tight stop.",
      "Calculate per-share risk: entry price minus stop price.",
      "Cap shares by risk budget, available cash, and planned budget.",
    ],
    formula: "shares = account risk budget / (entry price - stop price)",
    output: "Max shares, max dollars, stop price, and loss if wrong.",
  },
  {
    id: "fractional-kelly",
    name: "Fractional Kelly",
    level: "Intermediate",
    goal: "Convert edge assumptions into a conservative size cap.",
    bestFor: "Users who can estimate win probability, expected upside, and expected downside.",
    avoidWhen: "The user is guessing the probability or using wishful upside assumptions.",
    howItWorks: "Iceberg calculates full Kelly, then uses only a fraction of it, usually 10%-25%, to avoid overbetting.",
    inputs: ["win probability", "upside estimate", "downside estimate", "account value", "Kelly fraction"],
    steps: [
      "Estimate win probability and payoff ratio.",
      "Calculate full Kelly from upside/downside odds.",
      "Use a smaller fraction of Kelly for beginner safety.",
      "Take the smaller result between Kelly cap, risk cap, cash cap, and planned budget.",
    ],
    output: "Full Kelly, fractional Kelly, edge, and final size cap.",
  },
  {
    id: "tranche-entry",
    name: "Tranche Entry",
    level: "Beginner",
    goal: "Replace one big emotional order with staged execution.",
    bestFor: "Volatile stocks, ETFs after a fast move, or entries where timing is uncertain.",
    avoidWhen: "The thesis requires immediate full exposure, which is rare for beginners.",
    howItWorks: "Iceberg splits the approved shares into starter, confirmation add, and final add.",
    inputs: ["approved shares", "entry price", "volatility", "trend", "stop price"],
    steps: [
      "Buy about half of the approved size first.",
      "Add only if price confirms the thesis, such as holding above entry or breaking a defined level.",
      "Keep the final add optional, not automatic.",
      "Cancel remaining tranches if the stop or thesis fails.",
    ],
    output: "Three-stage entry plan with share counts and triggers.",
  },
  {
    id: "rebalance-reduce",
    name: "Rebalance / Reduce Exposure",
    level: "Beginner",
    goal: "Prevent one stock, ETF, or theme from quietly becoming the whole portfolio.",
    bestFor: "Users who already own the symbol, sector, or highly correlated positions.",
    avoidWhen: "The trade remains a small part of a diversified portfolio after execution.",
    howItWorks: "Iceberg checks future exposure after the trade and reduces or blocks the order if concentration gets too high.",
    inputs: ["current shares", "current price", "account value", "planned budget", "sector/theme exposure"],
    steps: [
      "Calculate current exposure before the new order.",
      "Calculate exposure after the proposed trade.",
      "If exposure is too high, reduce size or skip the trade.",
      "Optionally rebalance by trimming existing exposure before adding new risk.",
    ],
    output: "Current exposure, future exposure, reduced order size, or skip recommendation.",
  },
  {
    id: "protective-stop",
    name: "Protective Stop",
    level: "Beginner",
    goal: "Define the exit before the trade becomes emotional.",
    bestFor: "Most beginner stock and ETF trades.",
    avoidWhen: "The asset is extremely illiquid or the user is investing long-term with a different plan.",
    howItWorks: "Iceberg sets a stop near the invalidation area and sizes the trade so the stop loss stays within the account risk budget.",
    inputs: ["entry price", "stop-loss percent", "account risk budget", "shares"],
    steps: [
      "Pick a stop that represents a broken thesis.",
      "Estimate dollar loss if the stop is hit.",
      "Reduce shares until that loss is acceptable.",
      "Do not widen the stop after entry just to avoid taking the loss.",
    ],
    output: "Stop price, dollar loss at stop, and risk percent of account.",
  },
  {
    id: "protective-put",
    name: "Protective Put",
    level: "Advanced",
    goal: "Pay an option premium to create downside protection while keeping upside open.",
    bestFor: "A larger existing position where the user wants to stay invested but cap downside for a period.",
    avoidWhen: "The user does not understand options, premiums, expiration, or liquidity.",
    howItWorks: "The user owns shares and buys put options. If the stock falls below the strike, the put may offset part of the loss.",
    inputs: ["shares owned", "option chain", "put strike", "expiration", "premium", "liquidity"],
    steps: [
      "Confirm the user owns or plans to own at least 100 shares per put contract.",
      "Choose expiration long enough to cover the risk window.",
      "Compare premium cost to the loss being insured.",
      "Treat the premium as insurance cost, not as a separate profit trade.",
    ],
    output: "Possible put strike, premium budget, protected floor, and protection expiration.",
  },
  {
    id: "collar",
    name: "Collar",
    level: "Advanced",
    goal: "Reduce protection cost by giving up some upside.",
    bestFor: "A user with an existing position who wants downside protection and accepts capped gains.",
    avoidWhen: "The user wants unlimited upside or does not understand assignment risk.",
    howItWorks: "The user owns shares, buys a put for downside protection, and sells a call to help pay for the put.",
    inputs: ["shares owned", "put strike", "call strike", "expiration", "net premium"],
    steps: [
      "Confirm at least 100 shares per options contract.",
      "Choose a put strike near the maximum tolerable downside.",
      "Choose a call strike where the user is willing to sell or cap gains.",
      "Compare net cost, max downside, and capped upside before entering.",
    ],
    output: "Protected floor, capped upside, net option cost, and expiration.",
  },
  {
    id: "broad-index-hedge",
    name: "Broad Index Hedge",
    level: "Advanced",
    goal: "Reduce portfolio-level market or sector risk instead of hedging one ticker only.",
    bestFor: "Users with many positions that all depend on the same market, sector, or macro theme.",
    avoidWhen: "The user only has a small single trade and no meaningful portfolio concentration.",
    howItWorks: "Iceberg flags correlated exposure and suggests reducing the new order first; advanced users may compare broad index hedges.",
    inputs: ["portfolio holdings", "sector exposure", "beta/correlation estimate", "hedge instrument"],
    steps: [
      "Group holdings by common driver, such as AI, semiconductors, or broad tech.",
      "Estimate how much the new trade increases that driver exposure.",
      "Prefer reducing the new order before adding a hedge.",
      "For advanced users, compare index hedge cost and tracking mismatch.",
    ],
    output: "Theme exposure warning, reduced size, or advanced hedge note.",
  },
];

export function getStrategyById(id) {
  return strategyCatalog.find((strategy) => strategy.id === id) || strategyCatalog[0];
}

export function recommendTradeStrategy(context) {
  const { trade, market, decision, riskScore, sizing, kelly } = context;
  const futureExposure = sizing.futurePositionPercent || 0;
  const highVolatility = market.annualizedVolatility > 0.55;
  const hotMove = market.return5d > 0.1 || market.return20d > 0.18;
  const concentrated = futureExposure > 0.2 || trade.currentShares > 0;
  const negativeEdge = kelly.edge <= 0 || sizing.suggestedShares <= 0;

  if (decision.kind === "avoid" || negativeEdge) {
    return buildRecommendation("no-trade-wait", ["risk-capped-position"], [
      "The current assumptions do not leave a protected size.",
      "Waiting is the cleanest form of risk control when the model cannot size the trade.",
    ]);
  }

  if (concentrated) {
    return buildRecommendation("rebalance-reduce", ["risk-capped-position", "protective-stop", "tranche-entry"], [
      `Future exposure would reach ${(futureExposure * 100).toFixed(1)}% of the account.`,
      "The first job is to avoid concentration before thinking about upside.",
    ]);
  }

  if (highVolatility || hotMove || riskScore >= 48) {
    return buildRecommendation("small-starter", ["tranche-entry", "protective-stop", "fractional-kelly"], [
      highVolatility ? "Volatility is elevated, so full-size entries are fragile." : "Recent price action increases chase risk.",
      "A starter position gives participation while preserving optionality.",
    ]);
  }

  return buildRecommendation("risk-capped-position", ["fractional-kelly", "tranche-entry", "protective-stop"], [
    "The trade can be translated into a defined-risk position.",
    "The final size should be the smallest cap from risk budget, cash, planned budget, and fractional Kelly.",
  ]);
}

function buildRecommendation(primaryId, stackIds, rationale) {
  const primary = getStrategyById(primaryId);
  const stack = stackIds.map(getStrategyById);
  const advancedProtection = [getStrategyById("protective-put"), getStrategyById("collar")];

  return {
    primaryId,
    primaryName: primary.name,
    primaryGoal: primary.goal,
    level: primary.level,
    rationale,
    stack: stack.map((strategy) => ({
      id: strategy.id,
      name: strategy.name,
      level: strategy.level,
      goal: strategy.goal,
    })),
    executionRules: primary.steps.slice(0, 4),
    advancedProtection: advancedProtection.map((strategy) => ({
      id: strategy.id,
      name: strategy.name,
      goal: strategy.goal,
    })),
  };
}
