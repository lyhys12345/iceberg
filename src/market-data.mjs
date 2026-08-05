const STOOQ_BASE_URL = "https://stooq.com/q/d/l/";

export async function fetchMarketSnapshot(symbol, fetchImpl = fetch) {
  const normalizedSymbol = normalizeSymbol(symbol);

  if (!normalizedSymbol) {
    throw new Error("Symbol is required.");
  }

  const url = buildStooqUrl(normalizedSymbol);
  const requests = [
    { url, source: "Stooq daily prices" },
    { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, source: "Stooq daily prices via demo proxy" },
  ];
  let csv = "";
  let source = "";
  let lastError = null;

  for (const request of requests) {
    try {
      const response = await fetchImpl(request.url);
      if (!response.ok) {
        throw new Error(`Market data request failed with ${response.status}.`);
      }
      csv = await response.text();
      source = request.source;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!csv) {
    throw lastError || new Error("Market data request failed.");
  }

  const candles = parseStooqCsv(csv);

  if (candles.length < 30) {
    throw new Error("Not enough market history returned.");
  }

  return buildMarketSnapshot(normalizedSymbol, candles, source);
}

export function buildMarketSnapshot(symbol, candles, source = "manual") {
  const sorted = [...candles].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1);
  const previous = sorted.at(-2);
  const close = latest.close;

  return {
    symbol: normalizeSymbol(symbol),
    source,
    asOf: latest.date,
    latestClose: close,
    previousClose: previous?.close || close,
    return5d: periodReturn(sorted, 5),
    return20d: periodReturn(sorted, 20),
    return60d: periodReturn(sorted, 60),
    annualizedVolatility: annualizedVolatility(sorted.slice(-60)),
    maxDrawdown60d: maxDrawdown(sorted.slice(-60)),
    range20d: priceRange(sorted.slice(-20)),
    trend: classifyTrend(periodReturn(sorted, 20), periodReturn(sorted, 60)),
  };
}

export function manualMarketSnapshot(symbol, latestClose, annualizedVolatility = 0.35) {
  const close = toNumber(latestClose) || 100;
  const vol = clamp(toNumber(annualizedVolatility) || 0.35, 0.05, 2.5);

  return {
    symbol: normalizeSymbol(symbol),
    source: "manual estimate",
    asOf: new Date().toISOString().slice(0, 10),
    latestClose: close,
    previousClose: close,
    return5d: 0,
    return20d: 0,
    return60d: 0,
    annualizedVolatility: vol,
    maxDrawdown60d: -vol * 0.35,
    range20d: {
      low: close * (1 - vol * 0.12),
      high: close * (1 + vol * 0.12),
    },
    trend: "unknown",
  };
}

export function parseStooqCsv(csv) {
  const rows = csv.trim().split(/\r?\n/);

  if (rows.length <= 1 || rows[0].toLowerCase().includes("no data")) {
    return [];
  }

  return rows
    .slice(1)
    .map((row) => {
      const [date, open, high, low, close, volume] = row.split(",");
      return {
        date,
        open: toNumber(open),
        high: toNumber(high),
        low: toNumber(low),
        close: toNumber(close),
        volume: toNumber(volume),
      };
    })
    .filter((candle) => candle.date && candle.close > 0);
}

function buildStooqUrl(symbol) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 210);
  const querySymbol = symbol.includes(".") ? symbol.toLowerCase() : `${symbol.toLowerCase()}.us`;

  const params = new URLSearchParams({
    s: querySymbol,
    i: "d",
    d1: formatDate(start),
    d2: formatDate(end),
  });

  return `${STOOQ_BASE_URL}?${params.toString()}`;
}

function periodReturn(candles, tradingDays) {
  if (candles.length <= tradingDays) return 0;
  const latest = candles.at(-1).close;
  const base = candles.at(-(tradingDays + 1)).close;
  return base > 0 ? latest / base - 1 : 0;
}

function annualizedVolatility(candles) {
  if (candles.length < 3) return 0;

  const returns = [];
  for (let i = 1; i < candles.length; i += 1) {
    const previous = candles[i - 1].close;
    const current = candles[i].close;
    if (previous > 0 && current > 0) {
      returns.push(Math.log(current / previous));
    }
  }

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(returns.length - 1, 1);

  return Math.sqrt(variance) * Math.sqrt(252);
}

function maxDrawdown(candles) {
  let peak = 0;
  let worst = 0;

  candles.forEach((candle) => {
    peak = Math.max(peak, candle.close);
    if (peak > 0) {
      worst = Math.min(worst, candle.close / peak - 1);
    }
  });

  return worst;
}

function priceRange(candles) {
  return {
    low: Math.min(...candles.map((candle) => candle.low || candle.close)),
    high: Math.max(...candles.map((candle) => candle.high || candle.close)),
  };
}

function classifyTrend(return20d, return60d) {
  if (return20d > 0.08 && return60d > 0.15) return "extended uptrend";
  if (return20d > 0.03 && return60d > 0) return "uptrend";
  if (return20d < -0.08 && return60d < -0.12) return "drawdown";
  if (return20d < -0.03 && return60d < 0) return "downtrend";
  return "mixed";
}

function formatDate(date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
