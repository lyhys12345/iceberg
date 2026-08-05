import { analyzeTrade, defaultRules } from "./risk-engine.mjs";
import { analyzeAdvisorTrade } from "./advisor-engine.mjs";
import { fetchMarketSnapshot, manualMarketSnapshot } from "./market-data.mjs";

const storageKeys = {
  rules: "iceberg.rules.v1",
  journal: "iceberg.journal.v1",
  advisorHistory: "iceberg.advisor-history.v1",
  advisorProfile: "iceberg.advisor-profile.v1",
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
  saveAdvisorPlan: document.querySelector("#saveAdvisorPlan"),
  skipAdvisorTrade: document.querySelector("#skipAdvisorTrade"),
  exportJson: document.querySelector("#exportJson"),
  exportCsv: document.querySelector("#exportCsv"),
};

init();

function init() {
  bindNavigation();
  bindForms();
  loadRulesIntoForm();
  renderJournal();
  updateSummary();
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
  elements.loadAdvisorExample.addEventListener("click", () => {
    seedAdvisorExample();
    resetAdvisorReport();
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

function generateAdvisorPlan() {
  const advisorInput = readAdvisorForm();
  saveAdvisorProfile(advisorInput);
  const market =
    state.marketSnapshot && state.marketSnapshot.symbol === advisorInput.symbol
      ? state.marketSnapshot
      : manualMarketSnapshot(advisorInput.symbol, advisorInput.currentPrice);
  const report = analyzeAdvisorTrade(advisorInput, market);

  state.latestAdvisorReport = report;
  state.marketSnapshot = market;
  renderAdvisorReport(report);
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
  };
}

function renderAdvisorReport(report) {
  const { decision, riskScore, sizing, kelly, scenarios, protection, entries, flags, market } = report;

  elements.advisorRiskScore.textContent = riskScore;
  elements.advisorRiskScore.dataset.level = decision.kind;
  elements.advisorDecisionTitle.textContent = decision.title;
  elements.advisorDecisionSummary.textContent = decision.summary;
  elements.advisorSuggestedSize.textContent = formatCurrency(sizing.suggestedDollars);
  elements.advisorSuggestedShares.textContent = `${sizing.suggestedShares} shares`;
  elements.advisorKelly.textContent = formatPercent(kelly.fractionalKelly);
  elements.advisorKellyEdge.textContent = `full Kelly ${formatPercent(kelly.fullKelly)} · edge ${formatPercent(kelly.edge)}`;
  elements.advisorStopRisk.textContent = formatCurrency(Math.abs(scenarios.stop.pnl));
  elements.advisorStopPrice.textContent = `stop ${formatCurrency(scenarios.stop.price)}`;
  elements.advisorExposure.textContent = formatPercent(sizing.futurePositionPercent);
  elements.saveAdvisorPlan.disabled = false;
  elements.skipAdvisorTrade.disabled = false;

  renderMarketSnapshot(market);

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
}

function renderMarketSnapshot(snapshot) {
  elements.advisorMarketTitle.textContent = `${snapshot.symbol} · ${formatCurrency(snapshot.latestClose)} · ${snapshot.asOf}`;
  elements.advisorMarketSource.textContent = snapshot.source;
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
  state.marketSnapshot = null;
  elements.marketStatus.textContent = "Enter a ticker and research recent performance. If live data is unavailable, enter the current price manually.";
}

function resetAdvisorReport() {
  state.latestAdvisorReport = null;
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
  elements.saveAdvisorPlan.disabled = true;
  elements.skipAdvisorTrade.disabled = true;
  elements.scenarioList.innerHTML = "";
  elements.protectionList.innerHTML = "";
  elements.entryPlan.innerHTML = "";
}

function resetDemo() {
  localStorage.removeItem(storageKeys.rules);
  localStorage.removeItem(storageKeys.journal);
  localStorage.removeItem(storageKeys.advisorHistory);
  localStorage.removeItem(storageKeys.advisorProfile);
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
  renderJournal();
  updateSummary();
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
