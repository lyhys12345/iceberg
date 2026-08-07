import { analyzeTrade, defaultRules } from "./risk-engine.mjs";
import { analyzeAdvisorTrade } from "./advisor-engine.mjs";
import { createAiRiskBrief } from "./ai-risk-layer.mjs";
import { beginnerAdvice, beginnerIntro, beginnerMissingFields, beginnerQuestion, classifyBeginnerIntent, parseBeginnerTradeMessage } from "./conversation-agent.mjs";
import { fetchMarketSnapshot, manualMarketSnapshot } from "./market-data.mjs";
import {
  analyzePortfolio,
  buildResearchDossier,
  demoPortfolio,
  holdingsToText,
  parseHoldingsText,
  portfolioDefaultsForSymbol,
} from "./portfolio-advisor.mjs";
import { strategyCatalog } from "./strategy-catalog.mjs";

const storageKeys = {
  rules: "iceberg.rules.v1",
  journal: "iceberg.journal.v1",
  advisorHistory: "iceberg.advisor-history.v1",
  advisorProfile: "iceberg.advisor-profile.v1",
  portfolio: "iceberg.portfolio.v1",
  onboardingSeen: "iceberg.onboarding-seen.v1",
};

const state = {
  latestReport: null,
  latestAdvisorReport: null,
  marketSnapshot: null,
  cooldownId: null,
  cooldownEndsAt: 0,
};

const elements = {
  navTabs: document.querySelectorAll(".nav-tab"),
  panels: document.querySelectorAll(".tab-panel"),
  tradeForm: document.querySelector("#tradeForm"),
  rulesForm: document.querySelector("#rulesForm"),
  emotionLevel: document.querySelector("#emotionLevel"),
  emotionOutput: document.querySelector("#emotionOutput"),
  riskMeter: document.querySelector("#riskMeter"),
  riskScore: document.querySelector("#riskScore"),
  riskTitle: document.querySelector("#riskTitle"),
  riskSummary: document.querySelector("#riskSummary"),
  recommendation: document.querySelector("#recommendation"),
  ruleList: document.querySelector("#ruleList"),
  cooldownBox: document.querySelector("#cooldownBox"),
  cooldownTimer: document.querySelector("#cooldownTimer"),
  cancelCooldown: document.querySelector("#cancelCooldown"),
  savePassed: document.querySelector("#savePassed"),
  saveBlocked: document.querySelector("#saveBlocked"),
  journalList: document.querySelector("#journalList"),
  clearJournal: document.querySelector("#clearJournal"),
  resetDemo: document.querySelector("#resetDemo"),
  aiProviderStatus: document.querySelector("#aiProviderStatus"),
  todayChecks: document.querySelector("#todayChecks"),
  todayBlocks: document.querySelector("#todayBlocks"),
  riskSaved: document.querySelector("#riskSaved"),
  advisorForm: document.querySelector("#advisorForm"),
  researchTicker: document.querySelector("#researchTicker"),
  loadAdvisorExample: document.querySelector("#loadAdvisorExample"),
  marketStatus: document.querySelector("#marketStatus"),
  advisorRiskScore: document.querySelector("#advisorRiskScore"),
  advisorDecisionTitle: document.querySelector("#advisorDecisionTitle"),
  advisorDecisionSummary: document.querySelector("#advisorDecisionSummary"),
  advisorSuggestedSize: document.querySelector("#advisorSuggestedSize"),
  advisorSuggestedShares: document.querySelector("#advisorSuggestedShares"),
  advisorKelly: document.querySelector("#advisorKelly"),
  advisorKellyEdge: document.querySelector("#advisorKellyEdge"),
  advisorStopRisk: document.querySelector("#advisorStopRisk"),
  advisorStopPrice: document.querySelector("#advisorStopPrice"),
  advisorExposure: document.querySelector("#advisorExposure"),
  advisorStrategyName: document.querySelector("#advisorStrategyName"),
  advisorStrategySummary: document.querySelector("#advisorStrategySummary"),
  advisorStrategySteps: document.querySelector("#advisorStrategySteps"),
  advisorStrategyStack: document.querySelector("#advisorStrategyStack"),
  advisorMarketTitle: document.querySelector("#advisorMarketTitle"),
  advisorMarketSource: document.querySelector("#advisorMarketSource"),
  market5d: document.querySelector("#market5d"),
  market20d: document.querySelector("#market20d"),
  market60d: document.querySelector("#market60d"),
  marketVol: document.querySelector("#marketVol"),
  marketDrawdown: document.querySelector("#marketDrawdown"),
  marketTrend: document.querySelector("#marketTrend"),
  scenarioList: document.querySelector("#scenarioList"),
  protectionList: document.querySelector("#protectionList"),
  entryPlan: document.querySelector("#entryPlan"),
  aiBrief: document.querySelector("#aiBrief"),
  saveAdvisorPlan: document.querySelector("#saveAdvisorPlan"),
  skipAdvisorTrade: document.querySelector("#skipAdvisorTrade"),
  exportJson: document.querySelector("#exportJson"),
  exportCsv: document.querySelector("#exportCsv"),
  onboardingPanel: document.querySelector("#onboardingPanel"),
  dismissOnboarding: document.querySelector("#dismissOnboarding"),
  agentForm: document.querySelector("#agentForm"),
  agentPrompt: document.querySelector("#agentPrompt"),
  agentConversation: document.querySelector("#agentConversation"),
  quickPrompts: document.querySelectorAll("[data-prompt]"),
  strategyLibrary: document.querySelector("#strategyLibrary"),
  portfolioForm: document.querySelector("#portfolioForm"),
  loadPortfolioDemo: document.querySelector("#loadPortfolioDemo"),
  portfolioRisk: document.querySelector("#portfolioRisk"),
  portfolioHorizon: document.querySelector("#portfolioHorizon"),
  portfolioCash: document.querySelector("#portfolioCash"),
  portfolioContribution: document.querySelector("#portfolioContribution"),
  portfolioHoldings: document.querySelector("#portfolioHoldings"),
  portfolioTotalValue: document.querySelector("#portfolioTotalValue"),
  portfolioRiskScore: document.querySelector("#portfolioRiskScore"),
  portfolioRiskLabel: document.querySelector("#portfolioRiskLabel"),
  portfolioLargest: document.querySelector("#portfolioLargest"),
  portfolioLargestWeight: document.querySelector("#portfolioLargestWeight"),
  portfolioCashWeight: document.querySelector("#portfolioCashWeight"),
  portfolioPulse: document.querySelector("#portfolioPulse"),
  portfolioPlan: document.querySelector("#portfolioPlan"),
  portfolioSellList: document.querySelector("#portfolioSellList"),
  portfolioTickerIdeas: document.querySelector("#portfolioTickerIdeas"),
  portfolioResearchSymbol: document.querySelector("#portfolioResearchSymbol"),
  portfolioResearchButton: document.querySelector("#portfolioResearchButton"),
  portfolioResearchOutput: document.querySelector("#portfolioResearchOutput"),
};

init();

function init() {
  bindNavigation();
  bindForms();
  loadRulesIntoForm();
  renderJournal();
  renderStrategyLibrary();
  loadPortfolioIntoForm();
  renderPortfolioAnalysis();
  hydrateAiStatus();
  updateSummary();
  renderOnboarding();
  if (!loadAdvisorProfileIntoForm()) {
    seedAdvisorDefaults();
  }
  seedDemoTrade();
}

function bindNavigation() {
  elements.navTabs.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      elements.navTabs.forEach((item) => item.classList.toggle("active", item === button));
      elements.panels.forEach((panel) => panel.classList.toggle("active", panel.id === `${tab}Tab`));
    });
  });
}

function bindForms() {
  elements.emotionLevel.addEventListener("input", () => {
    elements.emotionOutput.value = elements.emotionLevel.value;
  });

  elements.tradeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const report = analyzeTrade(readTradeForm(), loadRules());
    state.latestReport = report;
    renderReport(report);
  });

  elements.researchTicker.addEventListener("click", async () => {
    await researchAdvisorTicker();
  });

  elements.advisorForm.addEventListener("submit", (event) => {
    event.preventDefault();
    generateAdvisorPlan();
  });

  elements.saveAdvisorPlan.addEventListener("click", () => saveAdvisorDecision("saved"));
  elements.skipAdvisorTrade.addEventListener("click", () => saveAdvisorDecision("skipped"));
  elements.exportJson.addEventListener("click", exportJson);
  elements.exportCsv.addEventListener("click", exportCsv);
  elements.agentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await askBeginnerAgent(elements.agentPrompt.value);
  });
  elements.agentPrompt.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    elements.agentForm.requestSubmit();
  });
  elements.quickPrompts.forEach((button) => {
    button.addEventListener("click", () => {
      elements.agentPrompt.value = button.dataset.prompt;
      elements.agentPrompt.focus();
    });
  });
  elements.dismissOnboarding.addEventListener("click", () => {
    localStorage.setItem(storageKeys.onboardingSeen, "true");
    renderOnboarding();
  });
  elements.loadAdvisorExample.addEventListener("click", () => {
    seedAdvisorExample();
    resetAdvisorReport();
  });
  elements.portfolioForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderPortfolioAnalysis();
  });
  elements.loadPortfolioDemo.addEventListener("click", () => {
    fillPortfolioForm(demoPortfolio);
    renderPortfolioAnalysis();
  });
  elements.portfolioResearchButton.addEventListener("click", async () => {
    await researchPortfolioTicker();
  });

  elements.rulesForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveRules(readRulesForm());
    elements.rulesForm.classList.add("saved");
    window.setTimeout(() => elements.rulesForm.classList.remove("saved"), 900);
  });

  elements.savePassed.addEventListener("click", () => saveDecision("passed"));
  elements.saveBlocked.addEventListener("click", () => saveDecision("blocked"));
  elements.cancelCooldown.addEventListener("click", stopCooldown);
  elements.clearJournal.addEventListener("click", () => {
    localStorage.setItem(storageKeys.journal, JSON.stringify([]));
    localStorage.setItem(storageKeys.advisorHistory, JSON.stringify([]));
    renderJournal();
    updateSummary();
  });
  elements.resetDemo.addEventListener("click", resetDemo);
}

async function researchAdvisorTicker() {
  const symbol = document.querySelector("#advisorSymbol").value.trim().toUpperCase();
  if (!symbol) {
    elements.marketStatus.textContent = "Enter a ticker first.";
    return;
  }

  elements.researchTicker.disabled = true;
  elements.marketStatus.textContent = `Researching ${symbol} recent daily prices...`;

  try {
    const snapshot = await fetchMarketSnapshot(symbol);
    state.marketSnapshot = snapshot;
    document.querySelector("#advisorPrice").value = snapshot.latestClose.toFixed(2);
    renderMarketSnapshot(snapshot);
    elements.marketStatus.textContent = `Loaded ${symbol} market snapshot as of ${snapshot.asOf}.`;
  } catch (error) {
    const price = document.querySelector("#advisorPrice").value;
    if (price) {
      const fallback = manualMarketSnapshot(symbol, price);
      state.marketSnapshot = fallback;
      renderMarketSnapshot(fallback);
      elements.marketStatus.textContent = `Live market data was unavailable. Using the current price field for ${symbol}; confirm it before generating.`;
    } else {
      state.marketSnapshot = null;
      elements.marketStatus.textContent = `Live market data was unavailable. Enter the current ${symbol} price manually.`;
    }
  } finally {
    elements.researchTicker.disabled = false;
  }
}

function loadPortfolioIntoForm() {
  const saved = loadPortfolio();
  fillPortfolioForm(saved || demoPortfolio);
}

function fillPortfolioForm(portfolio) {
  elements.portfolioRisk.value = portfolio.riskProfile || "balanced";
  elements.portfolioHorizon.value = portfolio.timeHorizon || "long";
  elements.portfolioCash.value = portfolio.cash || "";
  elements.portfolioContribution.value = portfolio.monthlyContribution || "";
  elements.portfolioHoldings.value = holdingsToText(portfolio.holdings || []);
}

function readPortfolioForm() {
  const formData = new FormData(elements.portfolioForm);
  return {
    riskProfile: formData.get("riskProfile"),
    timeHorizon: formData.get("timeHorizon"),
    cash: formData.get("cash"),
    monthlyContribution: formData.get("monthlyContribution"),
    holdings: parseHoldingsText(formData.get("holdings")),
  };
}

function loadPortfolio() {
  try {
    return JSON.parse(localStorage.getItem(storageKeys.portfolio) || "null");
  } catch {
    return null;
  }
}

function savePortfolio(portfolio) {
  localStorage.setItem(storageKeys.portfolio, JSON.stringify(portfolio));
}

function renderPortfolioAnalysis() {
  const portfolio = readPortfolioForm();
  savePortfolio(portfolio);
  const analysis = analyzePortfolio(portfolio);

  elements.portfolioTotalValue.textContent = formatCurrency(analysis.totalValue);
  elements.portfolioRiskScore.textContent = analysis.riskScore;
  elements.portfolioRiskScore.dataset.level = analysis.riskScore >= 72 ? "avoid" : analysis.riskScore >= 48 ? "reduce" : "consider";
  elements.portfolioRiskLabel.textContent = `${analysis.riskLabel} portfolio risk`;
  elements.portfolioLargest.textContent = analysis.largest ? analysis.largest.symbol : "--";
  elements.portfolioLargestWeight.textContent = analysis.largest ? `${formatPercent(analysis.largest.weight)} of account` : "--";
  elements.portfolioCashWeight.textContent = formatPercent(analysis.cashWeight);
  elements.portfolioPulse.innerHTML = renderAdvisorItems(analysis.pulse);
  elements.portfolioPlan.innerHTML = renderAdvisorItems(analysis.financialPlan);
  elements.portfolioSellList.innerHTML = renderAdvisorItems(analysis.whatToSell);
  elements.portfolioTickerIdeas.innerHTML = analysis.tickersForYou.map(tickerIdea).join("");

  return analysis;
}

async function researchPortfolioTicker() {
  const symbol = elements.portfolioResearchSymbol.value.trim().toUpperCase();
  if (!symbol) {
    elements.portfolioResearchOutput.textContent = "Enter a ticker first.";
    return;
  }

  elements.portfolioResearchButton.disabled = true;
  elements.portfolioResearchOutput.textContent = `Researching ${symbol} against your portfolio...`;

  const analysis = renderPortfolioAnalysis();
  let market = null;
  try {
    market = await fetchMarketSnapshot(symbol);
  } catch {
    market = null;
  } finally {
    elements.portfolioResearchButton.disabled = false;
  }

  renderResearchDossier(buildResearchDossier(symbol, market, analysis));
}

function renderResearchDossier(dossier) {
  elements.portfolioResearchOutput.innerHTML = `
    <div class="research-dossier">
      <div>
        <span class="eyebrow">Ticker</span>
        <strong>${escapeHtml(dossier.symbol)}</strong>
      </div>
      <div>
        <span class="eyebrow">Market facts</span>
        ${dossier.facts.map((fact) => `<p>${escapeHtml(fact)}</p>`).join("")}
      </div>
      <div>
        <span class="eyebrow">Portfolio fit</span>
        ${dossier.fit.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
      </div>
      <div>
        <span class="eyebrow">Questions before trade</span>
        <ul>${dossier.questions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ul>
      </div>
    </div>
  `;
}

function renderAdvisorItems(items) {
  return items
    .map(
      (item) => `
        <article class="advisor-item">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.detail)}</span>
        </article>
      `,
    )
    .join("");
}

function tickerIdea(item) {
  return `
    <article class="ticker-idea">
      <strong>${escapeHtml(item.symbol)}</strong>
      <span>${escapeHtml(item.label)}</span>
      <small>${escapeHtml(item.detail)}</small>
    </article>
  `;
}

async function askBeginnerAgent(message) {
  const text = String(message || "").trim();
  if (!text) return;

  appendAgentMessage("user", text);
  elements.agentPrompt.value = "";
  appendAgentLoading();
  setAgentLoading(true);

  try {
    const result = await callIcebergAgent(text);
    renderAgentResult(result);
  } catch {
    await runLocalBeginnerAgent(text);
  } finally {
    setAgentLoading(false);
  }
}

async function callIcebergAgent(message) {
  const response = await fetch("/api/agent-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      defaults: readTrustedAdvisorDefaults(),
      portfolio: readPortfolioForm(),
    }),
  });

  if (!response.ok) {
    throw new Error("Agent API unavailable");
  }

  return response.json();
}

function renderAgentResult(result) {
  replaceLastAssistantMessage(result.message || "I could not complete the agent check.", result);

  if (result.trade) {
    fillAdvisorForm(result.trade);
  }

  if (result.market) {
    state.marketSnapshot = result.market;
    renderMarketSnapshot(result.market);
  }

  if (result.report) {
    state.latestAdvisorReport = result.report;
    renderAdvisorReport(result.report, result.aiBrief);
  }
}

async function runLocalBeginnerAgent(text) {
  const intent = classifyBeginnerIntent(text);
  if (intent === "quote") {
    await answerLocalQuote(text);
    return;
  }

  if (intent !== "trade") {
    replaceLastAssistantMessage(beginnerIntro(intent));
    return;
  }

  const parsed = parseBeginnerTradeMessage(text, readTrustedAdvisorDefaults());
  applyPortfolioContext(parsed, text);
  let marketSearchNote = "";

  if (parsed.symbol && !parsed.currentPrice) {
    try {
      const snapshot = await fetchMarketSnapshot(parsed.symbol);
      parsed.currentPrice = String(snapshot.latestClose);
      state.marketSnapshot = snapshot;
      renderMarketSnapshot(snapshot);
    } catch (error) {
      const portfolioPrice = portfolioPriceForSymbol(parsed.symbol);
      if (portfolioPrice) {
        const fallback = manualMarketSnapshot(parsed.symbol, portfolioPrice);
        parsed.currentPrice = String(portfolioPrice);
        state.marketSnapshot = fallback;
        renderMarketSnapshot(fallback);
        marketSearchNote = `I could not reach live market data, so I used your portfolio's saved ${parsed.symbol} price as a temporary estimate. `;
      } else {
        state.marketSnapshot = null;
        marketSearchNote = `${marketSearchFailureMessage(parsed.symbol, error)} `;
      }
    }
  }

  const searchFailed = Boolean(marketSearchNote) && !positiveValue(parsed.currentPrice);
  const missing = beginnerMissingFields(parsed);
  fillAdvisorForm(parsed);

  if (missing.length > 0) {
    if (shouldGiveLocalTimingRead(text, parsed, missing)) {
      const market = state.marketSnapshot || manualMarketSnapshot(parsed.symbol, parsed.currentPrice);
      replaceLastAssistantMessage(`${marketSearchNote}${timingReadReply(market)}`);
      return;
    }

    replaceLastAssistantMessage(`${marketSearchNote}${beginnerQuestion(missing, { marketSearchFailed: searchFailed, symbol: parsed.symbol })}`);
    return;
  }

  const report = generateAdvisorPlan();
  replaceLastAssistantMessage(`${beginnerAdvice(report)} I filled the advanced model below so you can inspect the assumptions.`);
}

async function answerLocalQuote(text) {
  const parsed = parseBeginnerTradeMessage(text, readTrustedAdvisorDefaults());
  if (!parsed.symbol) {
    replaceLastAssistantMessage("Which stock ticker do you want me to check?");
    return;
  }

  try {
    const snapshot = await fetchMarketSnapshot(parsed.symbol);
    state.marketSnapshot = snapshot;
    renderMarketSnapshot(snapshot);
    replaceLastAssistantMessage(quoteReply(snapshot));
  } catch (error) {
    const portfolioPrice = portfolioPriceForSymbol(parsed.symbol);
    if (portfolioPrice) {
      const fallback = manualMarketSnapshot(parsed.symbol, portfolioPrice);
      state.marketSnapshot = fallback;
      renderMarketSnapshot(fallback);
      replaceLastAssistantMessage(`I could not reach live market data, so I used your saved ${parsed.symbol} portfolio price: ${formatCurrency(portfolioPrice)}. If you want a trade plan, tell me how much you are considering buying and your account size.`);
      return;
    }

    replaceLastAssistantMessage(`${marketSearchFailureMessage(parsed.symbol, error)} If you paste the latest price, I can use it for a risk check.`);
  }
}

function quoteReply(snapshot) {
  return `${snapshot.symbol} latest available price is ${formatCurrency(snapshot.latestClose)} as of ${snapshot.asOf}. Source: ${snapshot.source}. If you want a trade plan, tell me how much you are considering buying and your account size.`;
}

function shouldGiveLocalTimingRead(message, trade, missing) {
  return Boolean(
    trade.symbol &&
      positiveValue(trade.currentPrice) &&
      missing.includes("planned amount") &&
      asksTimingQuestion(message),
  );
}

function asksTimingQuestion(message) {
  const text = String(message || "").toLowerCase();
  return (
    /\b(good time|right time|should i buy|should i enter|buy now|worth buying|is this.*buy|is now.*buy)\b/.test(text) ||
    /好时机|好時機|现在.*买|現在.*買|该买|該買|适合买|值得买/.test(text)
  );
}

function timingReadReply(snapshot) {
  const trend = snapshot.trend || "mixed";
  return `${snapshot.symbol} is around ${formatCurrency(snapshot.latestClose)} as of ${snapshot.asOf}. Recent 20-day move is ${formatPercent(snapshot.return20d)}, trend reads ${trend}, estimated annualized volatility is ${formatPercent(snapshot.annualizedVolatility)}, and the recent 60-day drawdown is ${formatPercent(snapshot.maxDrawdown60d)}. I can give you a timing read, but I need your planned buy amount before I can calculate exact sizing, downside, stop, and protection.`;
}

function portfolioPriceForSymbol(symbol) {
  const portfolio = loadPortfolio();
  const holding = portfolio?.holdings?.find((item) => String(item.symbol || "").toUpperCase() === String(symbol || "").toUpperCase());
  const price = Number(holding?.price || 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

function positiveValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function applyPortfolioContext(parsed, message = "") {
  if (!parsed.symbol) return;
  const portfolio = loadPortfolio();
  if (!portfolio) return;

  const defaults = portfolioDefaultsForSymbol(portfolio, parsed.symbol);
  const explicit = explicitPortfolioFieldsSafe(message);
  if (!explicit.accountValue && defaults.accountValue) parsed.accountValue = defaults.accountValue;
  if (!explicit.cashAvailable && defaults.cashAvailable) parsed.cashAvailable = defaults.cashAvailable;
  if (!explicit.currentShares && defaults.currentShares) parsed.currentShares = defaults.currentShares;
}

function explicitPortfolioFields(message) {
  const text = String(message || "").toLowerCase();
  return {
    accountValue: /\b(account|portfolio|net worth)\b|账户|本金|资金/.test(text),
    cashAvailable: /\b(cash|available cash|cash available)\b|现金|可用资金|可用现金/.test(text),
    currentShares: /\b(current shares|already own|already hold|holding|hold|own)\b|持有|已有|现在有/.test(text),
  };
}

function explicitPortfolioFieldsSafe(message) {
  const text = String(message || "").toLowerCase();
  return {
    accountValue: /\b(account|portfolio|net worth)\b|账户|本金|资金/.test(text),
    cashAvailable: /\b(cash|available cash|cash available)\b|现金|可用资金|可用现金/.test(text),
    currentShares: /\b(current shares|already own|already hold|holding|hold|own)\b|持有|已有|现在有/.test(text),
  };
}

function appendAgentMessage(role, text) {
  elements.agentConversation.insertAdjacentHTML(
    "beforeend",
    `
      <article class="agent-message ${role}">
        <strong>${role === "user" ? "You" : "Iceberg"}</strong>
        ${renderAgentText(text)}
      </article>
    `,
  );
  elements.agentConversation.scrollTop = elements.agentConversation.scrollHeight;
}

function appendAgentLoading() {
  elements.agentConversation.insertAdjacentHTML(
    "beforeend",
    `
      <article class="agent-message assistant loading" aria-live="polite">
        <strong>Iceberg</strong>
        <div class="agent-thinking">
          <span class="thinking-orb" aria-hidden="true"></span>
          <div>
            <p>Iceberg is thinking<span class="thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span></p>
            <ol class="thinking-steps" aria-label="Agent progress">
              <li>Reading your trade intent</li>
              <li>Checking portfolio context and market data</li>
              <li>Estimating size, downside, and protection</li>
            </ol>
          </div>
        </div>
      </article>
    `,
  );
  elements.agentConversation.scrollTop = elements.agentConversation.scrollHeight;
}

function replaceLastAssistantMessage(text, result = null) {
  const assistantMessages = [...elements.agentConversation.querySelectorAll(".agent-message.assistant")];
  const lastMessage = assistantMessages.at(-1);
  const last = lastMessage?.querySelector("p");
  if (lastMessage && last) {
    lastMessage.classList.remove("loading");
    lastMessage.classList.toggle("with-order-review", Boolean(canRenderOrderReview(result)));
    lastMessage.innerHTML = `
      <strong>Iceberg</strong>
      ${renderAgentResponse(text, result)}
    `;
  } else {
    appendAgentMessage("assistant", text);
  }
}

function renderAgentResponse(text, result) {
  if (!canRenderOrderReview(result)) return renderAgentText(text);

  return `
    ${renderOrderReview(result)}
    <details class="agent-full-analysis">
      <summary>Full analysis</summary>
      ${renderAgentText(text)}
    </details>
  `;
}

function canRenderOrderReview(result) {
  return Boolean(result?.strategySelection?.orderTicket && result?.workflow?.steps?.length);
}

function renderOrderReview(result) {
  const strategy = result.strategySelection;
  const ticket = strategy.orderTicket;
  const decision = result.report?.decision || {};
  const riskScore = result.report?.riskScore;
  const symbol = result.report?.trade?.symbol || result.trade?.symbol || "Trade";
  const action = strategy.action || "review";
  const actionClass = orderActionClass(action, decision.kind);
  const primaryRisks = result.report?.flags?.slice(0, 3) || [];

  return `
    <section class="order-review" data-action="${actionClass}" aria-label="Order review">
      <div class="order-review-head">
        <div>
          <span class="eyebrow">Order Review</span>
          <h4>${escapeHtml(symbol)} - ${escapeHtml(actionLabel(action, decision.kind))}</h4>
        </div>
        <div class="order-verdict">
          <span>${escapeHtml(decision.title || strategy.strategyName)}</span>
          <strong>${Number.isFinite(Number(riskScore)) ? `${riskScore}/100` : "--"}</strong>
        </div>
      </div>

      <div class="order-ticket-grid">
        ${ticketMetric("Max buy", formatCurrency(ticket.maxDollars), `${ticket.maxShares || 0} shares`)}
        ${ticketMetric("First entry", `${ticket.firstEntryShares || 0} shares`, firstEntryHint(strategy))}
        ${ticketMetric("Stop", formatCurrency(ticket.stopPrice), `${formatCurrency(ticket.maxLossAtStop)} max loss`)}
        ${ticketMetric("Strategy", strategy.strategyName, `${Math.round(Number(strategy.confidence || 0) * 100)}% confidence`)}
      </div>

      <div class="workflow-steps" aria-label="Agent workflow">
        ${result.workflow.steps.map((step, index) => renderWorkflowStep(step, index)).join("")}
      </div>

      ${
        primaryRisks.length
          ? `<div class="order-risk-list">${primaryRisks.map((risk) => `<span>${escapeHtml(risk.title)}</span>`).join("")}</div>`
          : ""
      }
    </section>
  `;
}

function ticketMetric(label, value, detail) {
  return `
    <div class="order-ticket-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(detail)}</small>
    </div>
  `;
}

function renderWorkflowStep(step, index) {
  return `
    <div class="workflow-step" data-step="${escapeHtml(step.id || "")}">
      <b>${index + 1}</b>
      <div>
        <strong>${escapeHtml(step.label || "")}</strong>
        <span>${escapeHtml(step.output || "")}</span>
      </div>
    </div>
  `;
}

function actionLabel(action, decisionKind) {
  if (action === "wait" || decisionKind === "avoid") return "Wait";
  if (action === "starter") return "Starter only";
  if (action === "reduce") return "Reduce size";
  return "Proceed with rules";
}

function orderActionClass(action, decisionKind) {
  if (action === "wait" || decisionKind === "avoid") return "wait";
  if (action === "starter" || action === "reduce" || decisionKind === "reduce") return "reduce";
  return "proceed";
}

function firstEntryHint(strategy) {
  if (strategy.action === "starter") return "small first click";
  if (strategy.action === "reduce") return "reduced entry";
  if (strategy.action === "wait") return "no order";
  return "approved cap";
}

function renderAgentText(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part)}</p>`)
    .join("");
}

function setAgentLoading(isLoading) {
  const button = elements.agentForm.querySelector('button[type="submit"]');
  elements.agentForm.setAttribute("aria-busy", String(isLoading));
  elements.agentPrompt.disabled = isLoading;
  if (button) {
    button.disabled = isLoading;
    button.textContent = isLoading ? "Thinking..." : "Ask Iceberg";
  }
}

function marketSearchFailureMessage(symbol, error) {
  const message = String(error?.message || "");
  if (message.includes("127.0.0.1")) {
    return "I can search for that, but this page is opened as a local file. Open http://127.0.0.1:5173/ so Iceberg can call the backend agent and market APIs.";
  }
  return `I searched recent market data for ${symbol}, but could not get a reliable live price from the connected data providers.`;
}

function generateAdvisorPlan() {
  const advisorInput = readAdvisorForm();
  saveAdvisorProfile(advisorInput);
  localStorage.setItem(storageKeys.onboardingSeen, "true");
  renderOnboarding();
  const market =
    state.marketSnapshot && state.marketSnapshot.symbol === advisorInput.symbol
      ? state.marketSnapshot
      : manualMarketSnapshot(advisorInput.symbol, advisorInput.currentPrice);
  const report = analyzeAdvisorTrade(advisorInput, market);

  state.latestAdvisorReport = report;
  state.marketSnapshot = market;
  renderAdvisorReport(report);
  return report;
}

function readAdvisorForm() {
  const formData = new FormData(elements.advisorForm);
  return {
    symbol: String(formData.get("symbol") || "").trim().toUpperCase(),
    side: formData.get("side"),
    horizon: formData.get("horizon"),
    currentPrice: formData.get("currentPrice"),
    accountValue: formData.get("accountValue"),
    cashAvailable: formData.get("cashAvailable"),
    currentShares: formData.get("currentShares"),
    plannedBudget: formData.get("plannedBudget"),
    maxRiskPercent: formData.get("maxRiskPercent"),
    winProbability: formData.get("winProbability"),
    upsidePercent: formData.get("upsidePercent"),
    downsidePercent: formData.get("downsidePercent"),
    stopLossPercent: formData.get("stopLossPercent"),
    targetGainPercent: formData.get("targetGainPercent"),
    kellyFractionPercent: formData.get("kellyFractionPercent"),
    thesis: formData.get("thesis"),
  };
}

function renderAdvisorReport(report, providedAiBrief = null) {
  const { decision, riskScore, sizing, kelly, scenarios, protection, entries, flags, market } = report;
  const aiBrief = providedAiBrief || createAiRiskBrief(report);

  document.body.classList.add("has-advisor-report");
  elements.advisorRiskScore.textContent = riskScore;
  elements.advisorRiskScore.dataset.level = decision.kind;
  elements.advisorDecisionTitle.textContent = decision.title;
  elements.advisorDecisionSummary.textContent = decision.summary;
  elements.advisorSuggestedSize.textContent = formatCurrency(sizing.suggestedDollars);
  elements.advisorSuggestedShares.textContent = `${sizing.suggestedShares} shares`;
  elements.advisorKelly.textContent = formatPercent(kelly.fractionalKelly);
  elements.advisorKellyEdge.textContent = `full Kelly ${formatPercent(kelly.fullKelly)} - ${formatPercent(kelly.fractionUsed)} used - edge ${formatPercent(kelly.edge)}`;
  elements.advisorStopRisk.textContent = formatCurrency(Math.abs(scenarios.stop.pnl));
  elements.advisorStopPrice.textContent = `stop ${formatCurrency(scenarios.stop.price)}`;
  elements.advisorExposure.textContent = formatPercent(sizing.futurePositionPercent);
  elements.saveAdvisorPlan.disabled = false;
  elements.skipAdvisorTrade.disabled = false;

  renderMarketSnapshot(market);
  renderTradeStrategy(report.strategy);

  elements.scenarioList.innerHTML = [
    scenarioItem("Bull", scenarios.bull.price, scenarios.bull.pnl),
    scenarioItem("Base", scenarios.base.price, scenarios.base.pnl),
    scenarioItem("Bear", scenarios.bear.price, scenarios.bear.pnl),
    scenarioItem("Stop", scenarios.stop.price, scenarios.stop.pnl),
  ].join("");

  elements.protectionList.innerHTML = [...flags, ...protection]
    .map(
      (item) => `
        <article class="rule-item">
          <strong>${item.title}</strong>
          <span>${item.detail}</span>
        </article>
      `,
    )
    .join("");

  elements.entryPlan.innerHTML =
    entries.length > 0
      ? entries
          .map(
            (step) => `
              <article class="rule-item">
                <strong>${step.label}: ${step.shares} shares</strong>
                <span>${step.trigger}</span>
              </article>
            `,
          )
          .join("")
      : `<p class="empty-state">No entry plan because the model did not find a safe size.</p>`;

  renderAiBrief(aiBrief);
  if (!providedAiBrief) {
    hydrateAiRiskBrief(report);
  }
}

async function hydrateAiRiskBrief(report) {
  try {
    const response = await fetch("/api/ai-risk-brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report }),
    });

    if (!response.ok) return;
    const brief = await response.json();
    renderAiBrief(brief);
  } catch {
    // Keep the local deterministic brief if the backend or OpenAI is unavailable.
  }
}

async function hydrateAiStatus() {
  if (!elements.aiProviderStatus) return;

  try {
    const response = await fetch("/api/ai-status?check=1");
    if (!response.ok) throw new Error("AI status unavailable");
    const status = await response.json();
    if (status.health && status.health.ok === false) {
      const issueLabel = status.health.reason === "network_error" ? "network issue" : "auth issue";
      elements.aiProviderStatus.textContent = `AI: ${status.provider} ${issueLabel}`;
      elements.aiProviderStatus.dataset.provider = "local";
      elements.aiProviderStatus.title = status.health.message || "AI provider health check failed.";
      return;
    }
    const providerLabels = {
      gemini: `AI: Gemini ${status.geminiModel || ""}`.trim(),
      openai: "AI: OpenAI",
      local: "AI: Local fallback",
    };
    elements.aiProviderStatus.textContent = providerLabels[status.provider] || "AI: Local fallback";
    elements.aiProviderStatus.dataset.provider = status.provider || "local";
  } catch {
    elements.aiProviderStatus.textContent = "AI: local page";
    elements.aiProviderStatus.dataset.provider = "local";
  }
}

function renderAiBrief(aiBrief) {
  const sourceLabel = aiBrief.source === "gemini" ? "Gemini" : aiBrief.source === "openai" ? "OpenAI" : "Local";
  const strategyName = aiBrief.strategyName || aiBrief.strategy?.primaryName || "";
  const strategySteps = Array.isArray(aiBrief.strategySteps) ? aiBrief.strategySteps : aiBrief.strategy?.executionRules || [];
  elements.aiBrief.innerHTML = `
    <article class="ai-brief-card">
      <div>
        <span class="eyebrow">Pattern</span>
        <strong>${escapeHtml(aiBrief.pattern)}</strong>
      </div>
      <div>
        <span class="eyebrow">${sourceLabel} confidence</span>
        <strong>${formatPercent(aiBrief.confidence)}</strong>
      </div>
      ${
        strategyName
          ? `<div>
              <span class="eyebrow">Strategy</span>
              <strong>${escapeHtml(strategyName)}</strong>
            </div>`
          : ""
      }
      <p>${escapeHtml(aiBrief.summary)}</p>
      ${
        strategySteps.length > 0
          ? `<ul>${strategySteps.slice(0, 3).map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul>`
          : ""
      }
      <small>${escapeHtml(aiBrief.reflectionPrompt)}</small>
    </article>
  `;
}

function renderTradeStrategy(strategy) {
  if (!strategy) return;

  elements.advisorStrategyName.textContent = strategy.primaryName;
  elements.advisorStrategySummary.textContent = strategy.rationale.join(" ");
  elements.advisorStrategySteps.innerHTML = strategy.executionRules
    .map(
      (step) => `
        <article class="strategy-step">
          <span>${escapeHtml(step)}</span>
        </article>
      `,
    )
    .join("");
  elements.advisorStrategyStack.innerHTML = strategy.stack
    .map((item) => `<span class="strategy-chip">${escapeHtml(item.name)}</span>`)
    .join("");
}

function renderStrategyLibrary() {
  if (!elements.strategyLibrary) return;

  elements.strategyLibrary.innerHTML = strategyCatalog
    .map(
      (strategy) => `
        <article class="strategy-card" data-level="${escapeHtml(strategy.level)}">
          <div class="strategy-card-head">
            <div>
              <span class="eyebrow">${escapeHtml(strategy.level)}</span>
              <h3>${escapeHtml(strategy.name)}</h3>
            </div>
            <span class="pill">${escapeHtml(strategy.goal)}</span>
          </div>
          <div class="strategy-detail-grid">
            <div>
              <strong>Best for</strong>
              <p>${escapeHtml(strategy.bestFor)}</p>
            </div>
            <div>
              <strong>Avoid when</strong>
              <p>${escapeHtml(strategy.avoidWhen)}</p>
            </div>
          </div>
          <p class="strategy-how">${escapeHtml(strategy.howItWorks)}</p>
          ${strategy.formula ? `<p class="strategy-formula">${escapeHtml(strategy.formula)}</p>` : ""}
          <div class="strategy-playbook">
            ${strategy.steps.map((step, index) => `<div><b>${index + 1}</b><span>${escapeHtml(step)}</span></div>`).join("")}
          </div>
          <div class="strategy-output">
            <strong>Output</strong>
            <span>${escapeHtml(strategy.output)}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderMarketSnapshot(snapshot) {
  elements.advisorMarketTitle.textContent = `${snapshot.symbol} - ${formatCurrency(snapshot.latestClose)} - ${snapshot.asOf}`;
  elements.advisorMarketSource.textContent = snapshot.isStale ? `${snapshot.source} - stale` : snapshot.source;
  elements.advisorMarketSource.dataset.stale = String(Boolean(snapshot.isStale));
  elements.market5d.textContent = formatPercent(snapshot.return5d);
  elements.market20d.textContent = formatPercent(snapshot.return20d);
  elements.market60d.textContent = formatPercent(snapshot.return60d);
  elements.marketVol.textContent = formatPercent(snapshot.annualizedVolatility);
  elements.marketDrawdown.textContent = formatPercent(snapshot.maxDrawdown60d);
  elements.marketTrend.textContent = snapshot.trend;
}

function scenarioItem(label, price, pnl) {
  const level = pnl >= 0 ? "positive" : "negative";
  return `
    <article class="scenario-item" data-level="${level}">
      <span>${label}</span>
      <strong>${formatCurrency(price)}</strong>
      <small>${pnl >= 0 ? "+" : ""}${formatCurrency(pnl)}</small>
    </article>
  `;
}

function readAdvisorDefaults() {
  return {
    side: document.querySelector("#advisorSide").value || "buy",
    horizon: document.querySelector("#advisorHorizon").value || "swing",
    accountValue: document.querySelector("#advisorAccountValue").value,
    cashAvailable: document.querySelector("#advisorCash").value,
    currentShares: document.querySelector("#advisorCurrentShares").value,
    plannedBudget: document.querySelector("#advisorBudget").value,
    maxRiskPercent: document.querySelector("#advisorMaxRisk").value || "1",
    winProbability: document.querySelector("#advisorWinProbability").value || "55",
    upsidePercent: document.querySelector("#advisorUpside").value || "12",
    downsidePercent: document.querySelector("#advisorDownside").value || "8",
    stopLossPercent: document.querySelector("#advisorStopLoss").value || "6",
    targetGainPercent: document.querySelector("#advisorTarget").value || "12",
    kellyFractionPercent: document.querySelector("#advisorKellyFraction").value || "25",
  };
}

function readTrustedAdvisorDefaults() {
  const riskDefaults = readAdvisorDefaults();
  let profile = null;

  try {
    profile = JSON.parse(localStorage.getItem(storageKeys.advisorProfile) || "null");
  } catch {
    profile = null;
  }

  return {
    accountValue: profile?.accountValue || "",
    cashAvailable: profile?.cashAvailable || "",
    currentShares: profile?.currentShares || "0",
    plannedBudget: profile?.plannedBudget || "",
    maxRiskPercent: riskDefaults.maxRiskPercent,
    winProbability: riskDefaults.winProbability,
    upsidePercent: riskDefaults.upsidePercent,
    downsidePercent: riskDefaults.downsidePercent,
    stopLossPercent: riskDefaults.stopLossPercent,
    targetGainPercent: riskDefaults.targetGainPercent,
    kellyFractionPercent: riskDefaults.kellyFractionPercent,
    side: riskDefaults.side,
    horizon: riskDefaults.horizon,
  };
}

function fillAdvisorForm(trade) {
  document.querySelector("#advisorSymbol").value = trade.symbol || "";
  document.querySelector("#advisorSide").value = trade.side || "buy";
  document.querySelector("#advisorHorizon").value = trade.horizon || "swing";
  document.querySelector("#advisorPrice").value = trade.currentPrice || "";
  document.querySelector("#advisorAccountValue").value = trade.accountValue || "";
  document.querySelector("#advisorCash").value = trade.cashAvailable || trade.accountValue || "";
  document.querySelector("#advisorCurrentShares").value = trade.currentShares || "0";
  document.querySelector("#advisorBudget").value = trade.plannedBudget || "";
  document.querySelector("#advisorMaxRisk").value = trade.maxRiskPercent || "1";
  document.querySelector("#advisorWinProbability").value = trade.winProbability || "55";
  document.querySelector("#advisorUpside").value = trade.upsidePercent || "12";
  document.querySelector("#advisorDownside").value = trade.downsidePercent || "8";
  document.querySelector("#advisorStopLoss").value = trade.stopLossPercent || "6";
  document.querySelector("#advisorTarget").value = trade.targetGainPercent || "12";
  document.querySelector("#advisorKellyFraction").value = trade.kellyFractionPercent || "25";
  document.querySelector("#advisorThesis").value = trade.thesis || "";
}

function readTradeForm() {
  const formData = new FormData(elements.tradeForm);
  return {
    symbol: formData.get("symbol"),
    assetType: formData.get("assetType"),
    direction: formData.get("direction"),
    positionSize: formData.get("positionSize"),
    accountSize: formData.get("accountSize"),
    maxLoss: formData.get("maxLoss"),
    thesis: formData.get("thesis"),
    drivers: formData.getAll("drivers"),
    emotionLevel: formData.get("emotionLevel"),
  };
}

function renderReport(report) {
  const { action, findings, score } = report;
  elements.riskScore.textContent = score;
  elements.riskMeter.style.setProperty("--risk-score", score);
  elements.riskMeter.dataset.level = action.kind;
  elements.riskTitle.textContent = action.title;
  elements.riskSummary.textContent = action.summary;
  elements.recommendation.dataset.level = action.kind;
  elements.recommendation.innerHTML = `<span class="recommendation-label">Action</span><strong>${action.title}</strong>`;

  elements.ruleList.innerHTML = findings
    .map(
      (finding) => `
        <article class="rule-item" data-severity="${finding.severity}">
          <strong>${finding.title}</strong>
          <span>${finding.detail}</span>
        </article>
      `,
    )
    .join("");

  elements.savePassed.disabled = false;
  elements.saveBlocked.disabled = false;

  if (action.kind === "block") {
    startCooldown(loadRules().cooldownMinutes);
  } else {
    stopCooldown();
  }
}

function startCooldown(minutes) {
  stopCooldown();
  state.cooldownEndsAt = Date.now() + Number(minutes) * 60 * 1000;
  elements.cooldownBox.classList.remove("hidden");
  tickCooldown();
  state.cooldownId = window.setInterval(tickCooldown, 1000);
}

function tickCooldown() {
  const remaining = Math.max(0, state.cooldownEndsAt - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  elements.cooldownTimer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  if (remaining <= 0) {
    stopCooldown();
  }
}

function stopCooldown() {
  if (state.cooldownId) {
    window.clearInterval(state.cooldownId);
  }
  state.cooldownId = null;
  state.cooldownEndsAt = 0;
  elements.cooldownBox.classList.add("hidden");
}

function saveDecision(decision) {
  if (!state.latestReport) return;

  const journal = loadJournal();
  journal.unshift({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    decision,
    report: state.latestReport,
  });
  localStorage.setItem(storageKeys.journal, JSON.stringify(journal.slice(0, 50)));
  renderJournal();
  updateSummary();
}

function saveAdvisorDecision(decision) {
  if (!state.latestAdvisorReport) return;

  const history = loadAdvisorHistory();
  history.unshift({
    id: crypto.randomUUID(),
    type: "advisor",
    createdAt: new Date().toISOString(),
    decision,
    report: state.latestAdvisorReport,
  });

  localStorage.setItem(storageKeys.advisorHistory, JSON.stringify(history.slice(0, 100)));
  renderJournal();
  updateSummary();
}

function renderJournal() {
  const journal = loadJournal().map((entry) => ({ ...entry, type: "check" }));
  const advisorHistory = loadAdvisorHistory();
  const entries = [...journal, ...advisorHistory].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (entries.length === 0) {
    elements.journalList.innerHTML = `<p class="empty-state">No saved decisions yet. Generate an advisor plan or run a pre-trade check to start building history.</p>`;
    return;
  }

  elements.journalList.innerHTML = entries
    .map((entry) => (entry.type === "advisor" ? advisorHistoryItem(entry) : checkHistoryItem(entry)))
    .join("");
}

function updateSummary() {
  const journal = loadJournal();
  const advisorHistory = loadAdvisorHistory();
  const today = new Date().toDateString();
  const todaysEntries = journal.filter((entry) => new Date(entry.createdAt).toDateString() === today);
  const todaysAdvisor = advisorHistory.filter((entry) => new Date(entry.createdAt).toDateString() === today);
  const blocks = todaysEntries.filter((entry) => entry.decision === "blocked");
  const skips = todaysAdvisor.filter((entry) => entry.decision === "skipped" || entry.report.decision.kind === "avoid");
  const riskSaved =
    blocks.reduce((sum, entry) => sum + Number(entry.report.savedRisk || 0), 0) +
    skips.reduce((sum, entry) => sum + Math.abs(Number(entry.report.scenarios?.stop?.pnl || entry.report.scenarios?.bear?.pnl || 0)), 0);

  elements.todayChecks.textContent = `${todaysEntries.length + todaysAdvisor.length} checks`;
  elements.todayBlocks.textContent = `${blocks.length + skips.length} trades`;
  elements.riskSaved.textContent = `$${riskSaved.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function renderOnboarding() {
  const seen = localStorage.getItem(storageKeys.onboardingSeen) === "true";
  elements.onboardingPanel.classList.toggle("hidden", seen);
}

function loadRules() {
  try {
    return { ...defaultRules, ...JSON.parse(localStorage.getItem(storageKeys.rules)) };
  } catch {
    return { ...defaultRules };
  }
}

function saveRules(rules) {
  localStorage.setItem(storageKeys.rules, JSON.stringify(rules));
}

function readRulesForm() {
  return {
    maxRiskPercent: Number(document.querySelector("#maxRiskPercent").value),
    maxLossDollars: Number(document.querySelector("#maxLossDollars").value),
    cooldownMinutes: Number(document.querySelector("#cooldownMinutes").value),
    emotionThreshold: Number(document.querySelector("#emotionThreshold").value),
    requireThesis: document.querySelector("#requireThesis").checked,
    requireMaxLoss: document.querySelector("#requireMaxLoss").checked,
    extraFrictionForOptions: document.querySelector("#extraFrictionForOptions").checked,
  };
}

function loadRulesIntoForm() {
  const rules = loadRules();
  document.querySelector("#maxRiskPercent").value = rules.maxRiskPercent;
  document.querySelector("#maxLossDollars").value = rules.maxLossDollars;
  document.querySelector("#cooldownMinutes").value = rules.cooldownMinutes;
  document.querySelector("#emotionThreshold").value = rules.emotionThreshold;
  document.querySelector("#requireThesis").checked = rules.requireThesis;
  document.querySelector("#requireMaxLoss").checked = rules.requireMaxLoss;
  document.querySelector("#extraFrictionForOptions").checked = rules.extraFrictionForOptions;
}

function loadJournal() {
  try {
    return JSON.parse(localStorage.getItem(storageKeys.journal)) || [];
  } catch {
    return [];
  }
}

function loadAdvisorHistory() {
  try {
    return JSON.parse(localStorage.getItem(storageKeys.advisorHistory)) || [];
  } catch {
    return [];
  }
}

function advisorHistoryItem(entry) {
  const date = formatHistoryDate(entry.createdAt);
  const { report } = entry;
  const symbol = report.trade.symbol || "UNKNOWN";
  const size = formatCurrency(report.sizing.suggestedDollars);
  const decision = entry.decision === "skipped" ? "skipped" : "saved";

  return `
    <article class="journal-item">
      <div>
        <strong>${symbol} - advisor plan</strong>
        <span>${date} - ${decision} - risk ${report.riskScore} - size ${size}</span>
      </div>
      <span class="journal-action" data-level="${report.decision.kind}">${report.decision.title}</span>
    </article>
  `;
}

function checkHistoryItem(entry) {
  const date = formatHistoryDate(entry.createdAt);
  const { trade, score, action } = entry.report;

  return `
    <article class="journal-item">
      <div>
        <strong>${trade.symbol || "UNKNOWN"} - ${trade.assetType}</strong>
        <span>${date} - ${entry.decision} - score ${score}</span>
      </div>
      <span class="journal-action" data-level="${action.kind}">${action.title}</span>
    </article>
  `;
}

function saveAdvisorProfile(input) {
  const profile = {
    accountValue: input.accountValue,
    cashAvailable: input.cashAvailable,
    currentShares: input.currentShares,
    plannedBudget: input.plannedBudget,
    maxRiskPercent: input.maxRiskPercent,
    winProbability: input.winProbability,
    upsidePercent: input.upsidePercent,
    downsidePercent: input.downsidePercent,
    stopLossPercent: input.stopLossPercent,
    targetGainPercent: input.targetGainPercent,
    kellyFractionPercent: input.kellyFractionPercent,
  };

  localStorage.setItem(storageKeys.advisorProfile, JSON.stringify(profile));
}

function loadAdvisorProfileIntoForm() {
  try {
    const profile = JSON.parse(localStorage.getItem(storageKeys.advisorProfile));
    if (!profile) return false;

    document.querySelector("#advisorAccountValue").value = profile.accountValue || "";
    document.querySelector("#advisorCash").value = profile.cashAvailable || "";
    document.querySelector("#advisorCurrentShares").value = profile.currentShares || "0";
    document.querySelector("#advisorBudget").value = profile.plannedBudget || "";
    document.querySelector("#advisorMaxRisk").value = profile.maxRiskPercent || "1";
    document.querySelector("#advisorWinProbability").value = profile.winProbability || "55";
    document.querySelector("#advisorUpside").value = profile.upsidePercent || "12";
    document.querySelector("#advisorDownside").value = profile.downsidePercent || "8";
    document.querySelector("#advisorStopLoss").value = profile.stopLossPercent || "6";
    document.querySelector("#advisorTarget").value = profile.targetGainPercent || "12";
  document.querySelector("#advisorKellyFraction").value = profile.kellyFractionPercent || "25";
    state.marketSnapshot = null;
    elements.marketStatus.textContent = "Your risk assumptions were restored. Enter a ticker and price to generate a new plan.";
    return true;
  } catch {
    return false;
  }
}

function exportJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    rules: loadRules(),
    advisorProfile: JSON.parse(localStorage.getItem(storageKeys.advisorProfile) || "null"),
    disciplineChecks: loadJournal(),
    advisorPlans: loadAdvisorHistory(),
  };

  downloadFile("iceberg-export.json", JSON.stringify(payload, null, 2), "application/json");
}

function exportCsv() {
  const rows = [["type", "created_at", "symbol", "decision", "risk_score", "suggested_dollars", "suggested_shares", "stop_price"]];

  loadJournal().forEach((entry) => {
    rows.push(["check", entry.createdAt, entry.report.trade.symbol, entry.decision, entry.report.score, "", "", ""]);
  });

  loadAdvisorHistory().forEach((entry) => {
    rows.push([
      "advisor",
      entry.createdAt,
      entry.report.trade.symbol,
      entry.decision,
      entry.report.riskScore,
      entry.report.sizing.suggestedDollars,
      entry.report.sizing.suggestedShares,
      entry.report.scenarios.stop.price,
    ]);
  });

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  downloadFile("iceberg-export.csv", csv, "text/csv");
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function seedDemoTrade() {
  document.querySelector("#symbol").value = "NVDA";
  document.querySelector("#positionSize").value = "1200";
  document.querySelector("#accountSize").value = "25000";
  document.querySelector("#maxLoss").value = "600";
  document.querySelector("#thesis").value = "Stock is moving fast after news and I do not want to miss it. I need to make back yesterday's loss.";
  document.querySelector('input[name="drivers"][value="news"]').checked = true;
  document.querySelector('input[name="drivers"][value="revenge"]').checked = true;
  document.querySelector('input[name="drivers"][value="fomo"]').checked = true;
  elements.emotionLevel.value = "8";
  elements.emotionOutput.value = "8";
}

function seedAdvisorExample() {
  document.querySelector("#advisorSymbol").value = "AAPL";
  document.querySelector("#advisorSide").value = "buy";
  document.querySelector("#advisorHorizon").value = "swing";
  document.querySelector("#advisorPrice").value = "210";
  document.querySelector("#advisorAccountValue").value = "25000";
  document.querySelector("#advisorCash").value = "8000";
  document.querySelector("#advisorCurrentShares").value = "10";
  document.querySelector("#advisorBudget").value = "3000";
  document.querySelector("#advisorMaxRisk").value = "1";
  document.querySelector("#advisorWinProbability").value = "55";
  document.querySelector("#advisorUpside").value = "12";
  document.querySelector("#advisorDownside").value = "8";
  document.querySelector("#advisorStopLoss").value = "6";
  document.querySelector("#advisorTarget").value = "12";
  document.querySelector("#advisorKellyFraction").value = "25";
  document.querySelector("#advisorThesis").value = "Planned swing entry with defined stop, target, and position size. I will exit if the setup breaks below the stop.";
  state.marketSnapshot = manualMarketSnapshot("AAPL", 210, 0.32);
  renderMarketSnapshot(state.marketSnapshot);
  elements.marketStatus.textContent = "Example loaded with manual market estimate. Click Research to try live daily prices.";
}

function seedAdvisorDefaults() {
  document.querySelector("#advisorSymbol").value = "";
  document.querySelector("#advisorSide").value = "buy";
  document.querySelector("#advisorHorizon").value = "swing";
  document.querySelector("#advisorPrice").value = "";
  document.querySelector("#advisorAccountValue").value = "25000";
  document.querySelector("#advisorCash").value = "8000";
  document.querySelector("#advisorCurrentShares").value = "0";
  document.querySelector("#advisorBudget").value = "3000";
  document.querySelector("#advisorMaxRisk").value = "1";
  document.querySelector("#advisorWinProbability").value = "55";
  document.querySelector("#advisorUpside").value = "12";
  document.querySelector("#advisorDownside").value = "8";
  document.querySelector("#advisorStopLoss").value = "6";
  document.querySelector("#advisorTarget").value = "12";
  document.querySelector("#advisorKellyFraction").value = "25";
  document.querySelector("#advisorThesis").value = "";
  state.marketSnapshot = null;
  elements.marketStatus.textContent = "Enter a ticker and research recent performance. If live data is unavailable, enter the current price manually.";
}

function resetAdvisorReport() {
  state.latestAdvisorReport = null;
  document.body.classList.remove("has-advisor-report");
  elements.advisorRiskScore.textContent = "--";
  elements.advisorRiskScore.removeAttribute("data-level");
  elements.advisorDecisionTitle.textContent = "Waiting for ticker";
  elements.advisorDecisionSummary.textContent = "Research a stock and generate a plan to see size, scenarios, and protection settings.";
  elements.advisorSuggestedSize.textContent = "--";
  elements.advisorSuggestedShares.textContent = "-- shares";
  elements.advisorKelly.textContent = "--";
  elements.advisorKellyEdge.textContent = "edge --";
  elements.advisorStopRisk.textContent = "--";
  elements.advisorStopPrice.textContent = "stop --";
  elements.advisorExposure.textContent = "--";
  elements.advisorStrategyName.textContent = "Waiting for strategy";
  elements.advisorStrategySummary.textContent = "Iceberg will choose a strategy after it sees the ticker, account, planned amount, and risk profile.";
  elements.advisorStrategySteps.innerHTML = "";
  elements.advisorStrategyStack.innerHTML = "";
  elements.saveAdvisorPlan.disabled = true;
  elements.skipAdvisorTrade.disabled = true;
  elements.scenarioList.innerHTML = "";
  elements.protectionList.innerHTML = "";
  elements.entryPlan.innerHTML = "";
  elements.aiBrief.innerHTML = "";
}

function resetDemo() {
  localStorage.removeItem(storageKeys.rules);
  localStorage.removeItem(storageKeys.journal);
  localStorage.removeItem(storageKeys.advisorHistory);
  localStorage.removeItem(storageKeys.advisorProfile);
  localStorage.removeItem(storageKeys.portfolio);
  localStorage.removeItem(storageKeys.onboardingSeen);
  loadRulesIntoForm();
  seedDemoTrade();
  stopCooldown();
  state.latestReport = null;
  elements.tradeForm.reset();
  seedDemoTrade();
  elements.riskScore.textContent = "--";
  elements.riskMeter.removeAttribute("data-level");
  elements.riskTitle.textContent = "Waiting for a trade";
  elements.riskSummary.textContent = "Enter a trade idea to see whether Iceberg should pass, slow, or block the order.";
  elements.recommendation.removeAttribute("data-level");
  elements.recommendation.innerHTML = `<span class="recommendation-label">Action</span><strong>Run check first</strong>`;
  elements.ruleList.innerHTML = "";
  elements.savePassed.disabled = true;
  elements.saveBlocked.disabled = true;
  seedAdvisorDefaults();
  resetAdvisorReport();
  fillPortfolioForm(demoPortfolio);
  renderPortfolioAnalysis();
  renderJournal();
  updateSummary();
  renderOnboarding();
}

function formatHistoryDate(createdAt) {
  return new Date(createdAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value) {
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function formatPercent(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}
