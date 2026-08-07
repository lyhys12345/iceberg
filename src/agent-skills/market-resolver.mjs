import { fetchMarketSnapshot, manualMarketSnapshot } from "../market-data.mjs";
import { portfolioPriceForSymbol } from "./portfolio-context.mjs";

export async function runMarketResolverSkill(symbol, portfolio, fetchImpl = fetch) {
  try {
    return { source: "live_market", market: await fetchMarketSnapshot(symbol, fetchImpl), note: "" };
  } catch {
    const portfolioPrice = portfolioPriceForSymbol(portfolio, symbol);
    if (portfolioPrice) {
      return {
        source: "portfolio_saved_price",
        market: manualMarketSnapshot(symbol, portfolioPrice),
        note: `I could not reach live market data, so I used your portfolio's saved ${symbol} price as a temporary estimate.`,
      };
    }
    return {
      source: "missing_market",
      market: null,
      note: `I searched recent market data for ${symbol}, but could not get a reliable live price from the connected data providers.`,
    };
  }
}

export async function finalMarketSnapshotSkill(trade, portfolio, fetchImpl = fetch) {
  if (positive(trade.currentPrice)) {
    return manualMarketSnapshot(trade.symbol, trade.currentPrice);
  }

  const marketResult = await runMarketResolverSkill(trade.symbol, portfolio, fetchImpl);
  return marketResult.market || manualMarketSnapshot(trade.symbol, 100);
}

function positive(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}
