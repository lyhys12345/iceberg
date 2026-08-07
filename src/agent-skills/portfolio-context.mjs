import { portfolioDefaultsForSymbol } from "../portfolio-advisor.mjs";

export function runPortfolioContextSkill(trade, portfolio, message) {
  const applied = [];
  if (!trade?.symbol || !portfolio) return { trade, applied };

  const defaults = portfolioDefaultsForSymbol(portfolio, trade.symbol);
  const explicit = explicitPortfolioFields(message);

  if (!explicit.accountValue && defaults.accountValue) {
    trade.accountValue = defaults.accountValue;
    applied.push("accountValue");
  }
  if (!explicit.cashAvailable && defaults.cashAvailable) {
    trade.cashAvailable = defaults.cashAvailable;
    applied.push("cashAvailable");
  }
  if (!explicit.currentShares && defaults.currentShares) {
    trade.currentShares = defaults.currentShares;
    applied.push("currentShares");
  }

  return { trade, applied };
}

export function portfolioPriceForSymbol(portfolio, symbol) {
  const holding = portfolio?.holdings?.find((item) => String(item.symbol || "").toUpperCase() === String(symbol || "").toUpperCase());
  const price = Number(holding?.price || 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

function explicitPortfolioFields(message) {
  const text = String(message || "").toLowerCase();
  return {
    accountValue: /\b(account|portfolio|net worth)\b|账户|本金|资金/.test(text),
    cashAvailable: /\b(cash|available cash|cash available)\b|现金|可用资金|可用现金/.test(text),
    currentShares: /\b(current shares|already own|already hold|holding|hold|own)\b|持有|已有|现在有/.test(text),
  };
}
