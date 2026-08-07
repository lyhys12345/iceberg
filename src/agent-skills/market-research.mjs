export function runMarketResearchSkill(trade, market) {
  const symbol = market?.symbol || trade?.symbol || "UNKNOWN";
  const latestClose = Number(market?.latestClose || trade?.currentPrice || 0);
  const return5d = Number(market?.return5d || 0);
  const return20d = Number(market?.return20d || 0);
  const return60d = Number(market?.return60d || 0);
  const volatility = Number(market?.annualizedVolatility || 0);
  const drawdown = Number(market?.maxDrawdown60d || 0);
  const trend = market?.trend || "unknown";
  const signals = buildSignals({ return5d, return20d, return60d, volatility, drawdown, trend, isStale: market?.isStale });
  const timingBias = classifyTimingBias(signals);

  return {
    symbol,
    source: market?.source || "unknown",
    asOf: market?.asOf || "",
    latestClose,
    trend,
    timingBias,
    returns: {
      fiveDay: return5d,
      twentyDay: return20d,
      sixtyDay: return60d,
    },
    volatility,
    drawdown,
    signals,
    summary: `${symbol} is around ${formatCurrency(latestClose)} as of ${market?.asOf || "the latest available snapshot"}. 20-day move is ${formatPercent(return20d)}, 60-day move is ${formatPercent(return60d)}, trend reads ${trend}, volatility is about ${formatPercent(volatility)}, and recent 60-day drawdown is ${formatPercent(drawdown)}.`,
  };
}

function buildSignals(context) {
  const signals = [];

  if (context.isStale) {
    signals.push({
      level: "caution",
      title: "Confirm price",
      detail: "The market snapshot may be stale, so sizing should wait for a fresh quote.",
    });
  }
  if (context.return5d > 0.1 || context.return20d > 0.18) {
    signals.push({
      level: "risk",
      title: "Chasing risk",
      detail: "Recent price action is hot enough that FOMO can sneak into the entry.",
    });
  }
  if (context.volatility > 0.55) {
    signals.push({
      level: "risk",
      title: "High volatility",
      detail: "The stop distance and share count matter more than the story when swings are this large.",
    });
  } else if (context.volatility > 0.4) {
    signals.push({
      level: "caution",
      title: "Elevated volatility",
      detail: "Use a smaller first entry and leave room to be wrong.",
    });
  }
  if (context.drawdown < -0.25) {
    signals.push({
      level: "caution",
      title: "Drawdown history",
      detail: "The stock recently had a deep pullback, so downside scenarios need respect.",
    });
  }
  if (context.trend === "extended uptrend") {
    signals.push({
      level: "caution",
      title: "Extended uptrend",
      detail: "Momentum may be real, but entry risk is higher after a large run.",
    });
  }
  if (context.trend === "downtrend" || context.trend === "drawdown") {
    signals.push({
      level: "caution",
      title: "Weak trend",
      detail: "Avoid treating a falling price as automatically cheap.",
    });
  }

  if (signals.length === 0) {
    signals.push({
      level: "neutral",
      title: "No obvious timing alarm",
      detail: "The market snapshot does not show an extreme short-term move, but sizing still controls the trade.",
    });
  }

  return signals;
}

function classifyTimingBias(signals) {
  if (signals.some((signal) => signal.title === "Confirm price")) return "needs fresh quote";
  if (signals.some((signal) => signal.title === "Chasing risk" || signal.title === "High volatility")) return "slow down";
  if (signals.some((signal) => signal.title === "Weak trend" || signal.title === "Extended uptrend")) return "wait for a cleaner entry";
  return "researchable";
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function formatPercent(value) {
  const number = Number(value || 0) * 100;
  const sign = number > 0 ? "+" : "";
  return `${sign}${number.toFixed(1)}%`;
}
