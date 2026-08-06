const STOOQ_BASE_URL = "https://stooq.com/q/d/l/";

export async function fetchMarketSnapshot(symbol, fetchImpl = fetch) {
  const normalizedSymbol = normalizeSymbol(symbol);

  if (!normalizedSymbol) {
    throw new Error("Symbol is required.");
  }

  if (typeof window !== "undefined") {
    const localSnapshot = await fetchLocalSnapshot(normalizedSymbol, fetchImpl);
    if (localSnapshot) return localSnapshot;
    throw new Error("Market data unavailable. Enter current price manually.");
  }

  if (typeof window === "undefined" && process.env.ALPHA_VANTAGE_API_KEY) {
    try {
      return await fetchAlphaVantageSnapshot(normalizedSymbol, process.env.ALPHA_VANTAGE_API_KEY, fetchImpl);
    } catch {
      // Fall through to the public no-key provider.
    }
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

export async function fetchAlphaVantageSnapshot(symbol, apiKey, fetchImpl = fetch) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const params = new URLSearchParams({
    function: "TIME_SERIES_DAILY",
    symbol: normalizedSymbol,
    outputsize: "compact",
    apikey: apiKey,
  });
  const response = await fetchImpl(`https://www.alphavantage.co/query?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Alpha Vantage request failed with ${response.status}.`);
  }

  const data = await response.json();
  return buildAlphaVantageSnapshot(normalizedSymbol, data);
}

export function buildAlphaVantageSnapshot(symbol, data) {
  const series = data["Time Series (Daily)"];
  if (!series) {
    const message = data.Note || data.Information || data["Error Message"] || "Alpha Vantage returned no daily time series.";
    throw new Error(message);
  }

  const candles = Object.entries(series).map(([date, row]) => ({
    date,
    open: toNumber(row["1. open"]),
    high: toNumber(row["2. high"]),
    low: toNumber(row["3. low"]),
    close: toNumber(row["4. close"]),
    volume: toNumber(row["5. volume"]),
  }));

  return buildMarketSnapshot(symbol, candles, "Alpha Vantage daily prices");
}

async function fetchLocalSnapshot(symbol, fetchImpl) {
  try {
    const response = await fetchImpl(`/api/market/${encodeURIComponent(symbol)}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data && !data.needsManualPrice && data.latestClose ? data : null;
  } catch {
    return null;
  }
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
    isStale: isStale(latest.date),
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
    isStale: false,
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

function isStale(dateText) {
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return true;

  const ageMs = Date.now() - date.getTime();
  return ageMs > 5 * 24 * 60 * 60 * 1000;
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
