import { analyzeTrade, defaultRules } from "./risk-engine.mjs";

const storageKeys = {
  rules: "iceberg.rules.v1",
  journal: "iceberg.journal.v1",
};

const state = {
  latestReport: null,
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
};

init();

function init() {
  bindNavigation();
  bindForms();
  loadRulesIntoForm();
  renderJournal();
  updateSummary();
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
    renderJournal();
    updateSummary();
  });
  elements.resetDemo.addEventListener("click", resetDemo);
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

function renderJournal() {
  const journal = loadJournal();

  if (journal.length === 0) {
    elements.journalList.innerHTML = `<p class="empty-state">No saved decisions yet. Run a pre-trade check to start building discipline history.</p>`;
    return;
  }

  elements.journalList.innerHTML = journal
    .map((entry) => {
      const date = new Date(entry.createdAt).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const { trade, score, action } = entry.report;

      return `
        <article class="journal-item">
          <div>
            <strong>${trade.symbol || "UNKNOWN"} · ${trade.assetType}</strong>
            <span>${date} · ${entry.decision} · score ${score}</span>
          </div>
          <span class="journal-action" data-level="${action.kind}">${action.title}</span>
        </article>
      `;
    })
    .join("");
}

function updateSummary() {
  const journal = loadJournal();
  const today = new Date().toDateString();
  const todaysEntries = journal.filter((entry) => new Date(entry.createdAt).toDateString() === today);
  const blocks = todaysEntries.filter((entry) => entry.decision === "blocked");
  const riskSaved = blocks.reduce((sum, entry) => sum + Number(entry.report.savedRisk || 0), 0);

  elements.todayChecks.textContent = `${todaysEntries.length} checks`;
  elements.todayBlocks.textContent = `${blocks.length} trades`;
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

function resetDemo() {
  localStorage.removeItem(storageKeys.rules);
  localStorage.removeItem(storageKeys.journal);
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
  renderJournal();
  updateSummary();
}
