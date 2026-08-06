const STOOQ_BASE_URL = "https://stooq.com/q/d/l/";
const YAHOO_CHART_BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart/";

export async function fetchMarketSnapshot(symbol, fetchImpl = fetch) {
  const normalizedSymbol = normalizeSymbol(symbol);

  if (!normalizedSymbol) {
    throw new Error("Symbol is required.");
  }

  if (typeof window !== "undefined") {
    if (window.location?.protocol === "file:") {
      throw new Error("Open http://127.0.0.1:5173/ so Iceberg can call the backend agent and market APIs.");
    }
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

  if (typeof window === "undefined" && process.env.OPENAI_API_KEY) {
    try {
      return await fetchOpenAiMarketSnapshot(normalizedSymbol, fetchImpl);
    } catch {
      // Fall through to no-key market data providers.
    }
  }

  try {
    return await fetchYahooChartSnapshot(normalizedSymbol, fetchImpl);
  } catch {
    // Fall through to Stooq. Yahoo covers many ETFs, while Stooq is a no-key backup.
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

export async function fetchOpenAiMarketSnapshot(symbol, fetchImpl = fetch) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const model = process.env.OPENAI_SEARCH_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini";
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      tools: [{ type: "web_search" }],
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are a market data resolver for Iceberg. Search the web for the most recent reliable quote for the requested US-listed stock or ETF ticker. Return JSON only. Do not give investment advice.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Find the latest available USD quote for ticker ${normalizedSymbol}. Return JSON with symbol, latestPrice, asOf, sourceName, sourceUrl, and notes. Use reliable quote pages such as exchange, issuer, Yahoo Finance, Nasdaq, or StockAnalysis.`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI market search failed with ${response.status}.`);
  }

  const data = await response.json();
  return buildOpenAiMarketSnapshot(normalizedSymbol, data);
}

export function buildOpenAiMarketSnapshot(symbol, data) {
  const parsed = parseJsonFromText(readOpenAiOutputText(data));
  const latestClose = toNumber(parsed.latestPrice);

  if (latestClose <= 0) {
    throw new Error("OpenAI market search did not return a usable price.");
  }

  const snapshot = manualMarketSnapshot(parsed.symbol || symbol, latestClose, 0.55);
  snapshot.source = parsed.sourceName ? `OpenAI web search: ${parsed.sourceName}` : "OpenAI web search";
  snapshot.asOf = normalizeAsOf(parsed.asOf) || snapshot.asOf;
  snapshot.isStale = isStale(snapshot.asOf);
  snapshot.search = {
    sourceName: String(parsed.sourceName || ""),
    sourceUrl: String(parsed.sourceUrl || ""),
    notes: String(parsed.notes || ""),
  };
  return snapshot;
}

export async function fetchYahooChartSnapshot(symbol, fetchImpl = fetch) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const params = new URLSearchParams({
    range: "6mo",
    interval: "1d",
    includePrePost: "false",
  });
  const response = await fetchImpl(`${YAHOO_CHART_BASE_URL}${encodeURIComponent(normalizedSymbol)}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Iceberg/0.1 pre-trade-risk-layer",
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo chart request failed with ${response.status}.`);
  }

  const data = await response.json();
  return buildYahooChartSnapshot(normalizedSymbol, data);
}

export function buildYahooChartSnapshot(symbol, data) {
  const result = data?.chart?.result?.[0];
  const error = data?.chart?.error;

  if (!result) {
    throw new Error(error?.description || "Yahoo chart returned no result.");
  }

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const close = result.indicators?.adjclose?.[0]?.adjclose || quote.close || [];
  const candles = timestamps
    .map((timestamp, index) => ({
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: toNumber(quote.open?.[index]),
      high: toNumber(quote.high?.[index]),
      low: toNumber(quote.low?.[index]),
      close: toNumber(close[index]),
      volume: toNumber(quote.volume?.[index]),
    }))
    .filter((candle) => candle.date && candle.close > 0);

  if (candles.length < 30) {
    throw new Error("Yahoo chart returned too little market history.");
  }

  const metaSymbol = result.meta?.symbol || symbol;
  return buildMarketSnapshot(metaSymbol, candles, "Yahoo Finance chart search");
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

function readOpenAiOutputText(data) {
  const outputText =
    data.output_text ||
    data.output
      ?.flatMap((item) => item.content || [])
      ?.map((content) => content.text)
      ?.filter(Boolean)
      ?.join("");

  if (!outputText) {
    throw new Error("OpenAI market search returned no text.");
  }

  return outputText;
}

function parseJsonFromText(text) {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("Market search response did not include JSON.");
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

function normalizeAsOf(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
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
