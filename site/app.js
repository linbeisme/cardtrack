import {
  APP_VERSION,
  DATABASE_COMPATIBILITY_VERSION,
  applySectionImport,
  effectiveStatus,
  estimateFirstYearValue,
  firstYearFeeWaived,
  migrateDatabase,
  parseResearchJson,
  validateDatabase,
  validateSectionPayload,
  valueTier
} from "./lib/schema.mjs";
import {
  effectiveTemplateContent,
  filterCards,
  migratePromptLibrary,
  promptVariantLabel,
  resolvePromptVariant,
  restoreTemplateDefault,
  updateTemplateContent,
  validatePromptLibrary
} from "./lib/prompts.mjs";
import {inferRepoFromLocation, putJsonFile, testRepositoryAccess} from "./lib/github.mjs";

const DATA_PATH = "site/data/cardtrack.json";
const PROMPTS_PATH = "site/data/prompts.json";
const VALUATIONS_PATH = "site/data/tpg-valuations.json";
const app = document.querySelector("#app");
const promptFileInput = document.querySelector("#prompt-file-input");

const state = {
  database: null,
  stagedDatabase: null,
  databaseMigration: {migrated: false, changes: []},
  prompts: null,
  stagedPrompts: null,
  promptMigration: {migrated: false, changes: []},
  defaultPrompts: null,
  valuations: null,
  savedValuations: null,
  tab: "offers",
  theme: localStorage.getItem("cardtrack-theme") || "light",
  query: "",
  issuer: "all",
  channel: "all",
  status: "all",
  sort: "promotions",
  factQuery: "",
  partnerQuery: "",
  partnerView: "program",
  compareIds: [],
  importText: "",
  importType: "auto",
  importMode: "merge",
  validation: null,
  promptManagerOpen: false,
  selectedTemplateId: "full-data-refresh",
  promptWorkflow: localStorage.getItem("cardtrack-prompt-workflow") === "two-step" ? "two-step" : "one-step",
  promptProvider: localStorage.getItem("cardtrack-prompt-provider") === "gemini" ? "gemini" : "chatgpt",
  promptStage: localStorage.getItem("cardtrack-prompt-stage") === "json" ? "json" : "research",
  promptTestText: "",
  promptTestPayload: null,
  promptTestResult: null,
  promptDirty: false,
  repository: {
    ...inferRepoFromLocation(),
    dataPath: DATA_PATH,
    promptsPath: PROMPTS_PATH,
    valuationsPath: VALUATIONS_PATH
  },
  toast: []
};

document.documentElement.dataset.theme = state.theme;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("en-US", {maximumFractionDigits: 0}).format(Number(value));
}

function fmtMoney(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("en-US", {style: "currency", currency: "USD", maximumFractionDigits: 0}).format(Number(value));
}

function fmtDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"});
}

function fmtDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString([], {month: "short", day: "numeric", year: "numeric"});
}

function schemaLabel() {
  return `${state.stagedDatabase?.schemaVersion ?? 5}.${state.stagedDatabase?.compatibilityVersion ?? DATABASE_COMPATIBILITY_VERSION}`;
}

function statusLabel(status) {
  return ({standard: "Standard", elevated: "Elevated", limited: "Limited Time", targeted: "Targeted", review: "Needs Review", public: "Public", referral: "Referral", branch: "Branch", mailer: "Mailer"})[status] || status;
}

function activeCards() {
  return (state.stagedDatabase?.cards || []).filter((card) => !card.isArchived);
}

function cardMap() {
  return new Map((state.stagedDatabase?.cards || []).map((card) => [card.id, card]));
}

function detailsMap() {
  return new Map((state.stagedDatabase?.cardDetails || []).map((item) => [item.cardId, item]));
}

function programMap() {
  return new Map((state.stagedDatabase?.transferPrograms || []).map((item) => [item.programId, item]));
}

function offersForCard(cardId) {
  return (state.stagedDatabase?.offers || []).filter((offer) => offer.cardId === cardId);
}

function primaryOffer(cardId) {
  const offers = offersForCard(cardId);
  return offers.find((offer) => offer.channel === "public") || offers[0] || null;
}

function cashValue(card, offer) {
  if (!offer) return null;
  if (offer.bonusUnit === "cash") return {value: Number(offer.bonusAmount || 0), cpp: null, label: "Cash face value"};
  const valuation = state.valuations?.programs?.[card.program];
  if (!valuation) return null;
  return {value: Number(offer.bonusAmount || 0) * Number(valuation.cpp || 0) / 100, cpp: valuation.cpp, label: valuation.label};
}

function firstYearSummary(card) {
  const offer = primaryOffer(card.id);
  const details = detailsMap().get(card.id);
  const valuation = state.valuations?.programs?.[card.program];
  return estimateFirstYearValue(card, offer, details, valuation);
}

function toast(message, type = "success") {
  const id = crypto.randomUUID();
  state.toast.push({id, message, type});
  renderToasts();
  setTimeout(() => {
    state.toast = state.toast.filter((item) => item.id !== id);
    renderToasts();
  }, 4200);
}

function renderToasts() {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.append(stack);
  }
  stack.innerHTML = state.toast.map((item) => `<div class="toast ${escapeHtml(item.type)}">${escapeHtml(item.message)}</div>`).join("");
}

async function loadJson(path, optional = false) {
  const response = await fetch(`${path}?v=${Date.now()}`, {cache: "no-store"});
  if (!response.ok) {
    if (optional) return null;
    throw new Error(`Could not load ${path} (${response.status}).`);
  }
  return response.json();
}

async function initialize() {
  try {
    const [savedDatabase, savedPrompts, defaultPrompts, valuations] = await Promise.all([
      loadJson("./data/cardtrack.json"),
      loadJson("./data/prompts.json", true),
      loadJson("./data/default-prompts.json"),
      loadJson("./data/tpg-valuations.json")
    ]);
    const migration = migrateDatabase(savedDatabase);
    const normalized = migration.database;
    const dbCheck = validateDatabase(normalized, {rejectExpired: false});
    if (!dbCheck.valid) throw new Error(`Saved database is invalid: ${dbCheck.errors[0]}`);
    const promptMigration = migratePromptLibrary(savedPrompts, defaultPrompts);
    const promptCheck = validatePromptLibrary(promptMigration.library);
    if (!promptCheck.valid) throw new Error(`Prompt library is invalid: ${promptCheck.errors[0]}`);
    state.database = structuredClone(normalized);
    state.stagedDatabase = structuredClone(normalized);
    state.databaseMigration = migration;
    state.defaultPrompts = defaultPrompts;
    state.prompts = structuredClone(promptMigration.library);
    state.stagedPrompts = structuredClone(promptMigration.library);
    state.promptMigration = promptMigration;
    state.valuations = structuredClone(valuations);
    state.savedValuations = structuredClone(valuations);
    state.selectedTemplateId = promptMigration.library.defaultTemplateId;
    const cards = activeCards();
    state.compareIds = cards.slice(0, 4).map((card) => card.id);
    render();
  } catch (error) {
    app.innerHTML = `<main class="content"><div class="notice error-notice"><strong>CardTrack could not start.</strong><br>${escapeHtml(error.message)}</div></main>`;
  }
}

function displayedOffers() {
  const cards = cardMap();
  const query = state.query.trim().toLowerCase();
  let rows = (state.stagedDatabase?.offers || [])
    .map((offer) => ({offer, card: cards.get(offer.cardId)}))
    .filter(({card}) => card && !card.isArchived)
    .filter(({offer, card}) => {
      const effective = effectiveStatus(offer, card);
      if (state.issuer !== "all" && card.issuer !== state.issuer) return false;
      if (state.channel !== "all" && offer.channel !== state.channel) return false;
      if (state.status !== "all" && effective !== state.status) return false;
      if (query) {
        const haystack = `${card.name} ${card.issuer} ${card.program} ${offer.note}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  const rank = {limited: 0, elevated: 1, targeted: 2, review: 3, standard: 4};
  rows.sort((a, b) => {
    if (state.sort === "name") return a.card.name.localeCompare(b.card.name);
    if (state.sort === "bonus") return b.offer.bonusAmount - a.offer.bonusAmount;
    if (state.sort === "cash") return (cashValue(b.card, b.offer)?.value || 0) - (cashValue(a.card, a.offer)?.value || 0);
    if (state.sort === "fee") return b.offer.annualFee - a.offer.annualFee;
    return (rank[effectiveStatus(a.offer, a.card)] ?? 9) - (rank[effectiveStatus(b.offer, b.card)] ?? 9) || a.card.name.localeCompare(b.card.name);
  });
  return rows;
}

function headerHtml() {
  return `<header class="site-header">
    <div class="header-inner">
      <div class="brand"><div class="brand-mark">CT</div><div><div class="brand-title">CardTrack</div><div class="brand-subtitle">Offers, benefits, transfers and comparisons</div></div></div>
      <div class="header-actions">
        <span class="version-chip">App v${escapeHtml(APP_VERSION)} · Schema v${escapeHtml(schemaLabel())}</span>
        <span class="badge ${state.stagedDatabase.dataStatus === "live" ? "elevated" : "targeted"}">${escapeHtml(state.stagedDatabase.dataStatus.toUpperCase())} · ${escapeHtml(fmtDateTime(state.stagedDatabase.generatedAt))}</span>
        <button class="theme-toggle" data-action="toggle-theme" title="Switch between day and night mode" aria-label="Switch between day and night mode"><span class="theme-choice ${state.theme === "light" ? "active" : ""}" aria-hidden="true">☀️</span><span class="theme-choice ${state.theme === "dark" ? "active" : ""}" aria-hidden="true">🌙</span></button>
        <button class="button" data-action="reload">Reload GitHub data</button>
      </div>
    </div>
  </header>`;
}

function tabsHtml() {
  const tabs = [
    ["offers", "Current Offers"],
    ["transfer-bonuses", "Transfer Bonuses"],
    ["transfer-partners", "Transfer Partners"],
    ["fact-sheets", "Fact Sheets"],
    ["compare", "Compare"],
    ["archived", `Archived Cards (${state.stagedDatabase.cards.filter((card) => card.isArchived).length})`],
    ["admin", "Admin Publisher"],
    ["methodology", "Methodology"]
  ];
  return `<nav class="tabs" aria-label="CardTrack sections">${tabs.map(([id, label]) => `<button class="tab" data-tab="${id}" aria-selected="${state.tab === id}">${escapeHtml(label)}</button>`).join("")}</nav>`;
}

function kpi(label, value, subtext, colorClass) {
  return `<div class="kpi ${colorClass}"><div class="kpi-label">${escapeHtml(label)}</div><div class="kpi-value">${escapeHtml(value)}</div><div class="kpi-sub">${escapeHtml(subtext)}</div></div>`;
}

function dashboardHtml() {
  const cards = activeCards();
  const offers = state.stagedDatabase.offers.filter((offer) => cards.some((card) => card.id === offer.cardId));
  const byId = cardMap();
  const promotional = offers.filter((offer) => ["elevated", "limited"].includes(effectiveStatus(offer, byId.get(offer.cardId))));
  const review = offers.filter((offer) => effectiveStatus(offer, byId.get(offer.cardId)) === "review");
  const issuers = [...new Set(cards.map((card) => card.issuer))].sort();
  const rows = displayedOffers();
  return `<section>
    <div class="kpis">
      ${kpi("Active cards", cards.length, "Archived cards excluded", "kpi-blue")}
      ${kpi("Verified offers", offers.length, "Current saved records", "kpi-green")}
      ${kpi("Elevated / limited", promotional.length, "Public promotional offers", "kpi-purple")}
      ${kpi("Needs review", review.length, "Conflicts or weak support", "kpi-amber")}
    </div>
    <div class="panel filters">
      <div class="field"><label for="filter-search">Search</label><input id="filter-search" data-filter="query" value="${escapeHtml(state.query)}" placeholder="Card, issuer, rewards program, or note"></div>
      <div class="field"><label for="filter-issuer">Issuer</label><select id="filter-issuer" data-filter="issuer"><option value="all">All issuers</option>${issuers.map((issuer) => `<option value="${escapeHtml(issuer)}" ${state.issuer === issuer ? "selected" : ""}>${escapeHtml(issuer)}</option>`).join("")}</select></div>
      <div class="field"><label for="filter-channel">Channel</label><select id="filter-channel" data-filter="channel"><option value="all">All channels</option>${["public","targeted","referral","branch","mailer"].map((value) => `<option value="${value}" ${state.channel === value ? "selected" : ""}>${statusLabel(value)}</option>`).join("")}</select></div>
      <div class="field"><label for="filter-status">Status</label><select id="filter-status" data-filter="status"><option value="all">All statuses</option>${["standard","elevated","limited","targeted","review"].map((value) => `<option value="${value}" ${state.status === value ? "selected" : ""}>${statusLabel(value)}</option>`).join("")}</select></div>
      <div class="field"><label for="filter-sort">Sort</label><select id="filter-sort" data-filter="sort"><option value="promotions" ${state.sort === "promotions" ? "selected" : ""}>Promotions first</option><option value="name" ${state.sort === "name" ? "selected" : ""}>Card name</option><option value="bonus" ${state.sort === "bonus" ? "selected" : ""}>Bonus amount</option><option value="cash" ${state.sort === "cash" ? "selected" : ""}>Estimated TPG value</option><option value="fee" ${state.sort === "fee" ? "selected" : ""}>Annual fee</option></select></div>
    </div>
    ${rows.length ? offersTableHtml(rows) : `<div class="panel empty"><h2>No matching offers</h2><p>Change the filters or import verified data in Admin Publisher.</p></div>`}
  </section>`;
}

function offersTableHtml(rows) {
  return `<div class="table-shell"><table class="offer-table"><thead><tr>
    <th>Card / Program</th><th>Welcome Offer</th><th>Est. TPG Value</th><th>Spend Requirement</th><th>Annual Fee</th><th class="promotion-heading">Promotion</th><th>Channel</th><th>Verified</th><th>Sources</th><th></th>
  </tr></thead><tbody>${rows.map(({card, offer}, index) => offerRowHtml(card, offer, index)).join("")}</tbody></table></div>`;
}

function offerRowHtml(card, offer, index) {
  const effective = effectiveStatus(offer, card);
  const value = cashValue(card, offer);
  const valuation = state.valuations?.programs?.[card.program];
  const sourceLinks = offer.sources.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.name)}</a>`).join("<br>");
  const flash = ["elevated", "limited"].includes(effective) ? "flash" : "";
  return `<tr class="row-shade-${index % 4}">
    <td><div class="card-name">${escapeHtml(card.name)}</div><div class="subtext">${escapeHtml(card.issuer)} · ${escapeHtml(card.program)}</div></td>
    <td><div class="offer-value">${fmtNumber(offer.bonusAmount)} ${escapeHtml(offer.bonusUnit)}</div><div class="subtext">Baseline ${fmtNumber(card.baselineOffer)} · Historical high ${fmtNumber(card.historicalHigh)}</div>${offer.expirationDate ? `<div class="expiration">Expires ${escapeHtml(fmtDate(offer.expirationDate))}</div>` : ""}</td>
    <td>${value ? `<div class="cash-estimate">≈ ${fmtMoney(value.value)}</div><div class="cpp-note">${value.cpp ? `${value.cpp.toFixed(2)}¢ each · ` : ""}${escapeHtml(value.label)}</div>` : `<div class="subtext">No valuation available</div>`}</td>
    <td><strong>${offer.spendRequirement === null ? "—" : fmtMoney(offer.spendRequirement)}</strong><div class="subtext">${offer.spendPeriodMonths ? `in ${offer.spendPeriodMonths} months` : "Period not reported"}</div></td>
    <td><div class="fee-value">${fmtMoney(offer.annualFee)} / year</div>${firstYearFeeWaived(offer) ? `<span class="waiver">First year waived</span>` : `<div class="subtext">No first-year waiver reported</div>`}</td>
    <td class="promotion-cell"><span class="badge badge-large ${effective} ${flash}">${statusLabel(effective)}</span><div class="confidence">${escapeHtml(offer.confidence)} confidence</div><div class="promotion-note">${escapeHtml(offer.note)}</div></td>
    <td><span class="badge badge-medium ${offer.channel === "public" ? "standard" : "targeted"}">${escapeHtml(statusLabel(offer.channel))}</span></td>
    <td>${escapeHtml(fmtDateTime(offer.lastVerifiedAt))}</td>
    <td>${sourceLinks}</td>
    <td><a class="button primary small" href="${escapeHtml(card.applyUrl)}" target="_blank" rel="noopener noreferrer">Issuer site</a></td>
  </tr>`;
}

function factSheetsHtml() {
  const details = detailsMap();
  const query = state.factQuery.trim().toLowerCase();
  const cards = activeCards().filter((card) => {
    if (!query) return true;
    const detail = details.get(card.id);
    return JSON.stringify({card, detail}).toLowerCase().includes(query);
  });
  return `<section>
    <div class="panel section-toolbar"><div><h2>Card Fact Sheets</h2><p>Search recurring perks, credits, protections, lounge access, status and earning rates.</p></div><div class="field compact"><label>Search perks or benefits</label><input id="fact-search" value="${escapeHtml(state.factQuery)}" placeholder="e.g. lounge, free night, Global Entry"></div></div>
    <div class="fact-grid">${cards.map((card, index) => factCardHtml(card, details.get(card.id), index)).join("")}</div>
  </section>`;
}

function factCardHtml(card, details, index) {
  const offer = primaryOffer(card.id);
  const cash = cashValue(card, offer);
  const estimate = firstYearSummary(card);
  const tier = valueTier(estimate.total);
  const benefits = [
    ...(details?.credits || []).map((item) => ({name: item.name, text: item.conditions || `${fmtMoney(item.faceValueAnnual)} annual face value`})),
    ...(details?.perks || []).map((item) => ({name: item.name, text: item.summary})),
    ...(details?.loungeAccess || []).map((item) => ({name: item.name, text: item.summary})),
    ...(details?.airlineBenefits || []).map((item) => ({name: item.name, text: item.summary})),
    ...(details?.hotelBenefits || []).map((item) => ({name: item.name, text: item.summary}))
  ].slice(0, 7);
  return `<article class="fact-card shade-${index % 4}">
    <div class="fact-card-header"><div><h3>${escapeHtml(card.name)}</h3><div class="subtext">${escapeHtml(card.issuer)} · ${escapeHtml(card.program)}</div></div><span class="tier tier-${tier.toLowerCase()}">${tier}</span></div>
    <dl class="fact-metrics">
      <div><dt>Bonus</dt><dd>${offer ? `${fmtNumber(offer.bonusAmount)} ${escapeHtml(offer.bonusUnit)}` : "—"}</dd></div>
      <div><dt>Bonus value</dt><dd class="cash-estimate">${cash ? fmtMoney(cash.value) : "—"}</dd></div>
      <div><dt>CPP</dt><dd>${cash?.cpp ? `${cash.cpp.toFixed(2)}¢` : "—"}</dd></div>
      <div><dt>Spend req.</dt><dd>${offer?.spendRequirement != null ? `${fmtMoney(offer.spendRequirement)} / ${offer.spendPeriodMonths || "—"}mo` : "—"}</dd></div>
      <div><dt>Annual fee</dt><dd>${fmtMoney(offer?.annualFee ?? card.annualFee)}${offer && firstYearFeeWaived(offer) ? " · first year waived" : ""}</dd></div>
      <div class="net-value"><dt>Est. 1-yr value</dt><dd>${fmtMoney(estimate.total)}</dd></div>
    </dl>
    ${details ? `<div class="benefit-list"><div class="eyebrow">Major verified benefits</div>${benefits.length ? benefits.map((item) => `<div class="benefit-item"><span>✓</span><div><strong>${escapeHtml(item.name)}</strong>${item.text ? `<div>${escapeHtml(item.text)}</div>` : ""}</div></div>`).join("") : `<div class="subtext">No benefit items were returned.</div>`}</div>` : `<div class="missing-data">No fact-sheet import yet. Use the Card Facts & Benefits prompt in Admin Publisher.</div>`}
    <a class="button primary fact-apply" href="${escapeHtml(card.applyUrl)}" target="_blank" rel="noopener noreferrer">Apply / issuer page ↗</a>
  </article>`;
}

function transferPartnersHtml() {
  const programs = state.stagedDatabase.transferPrograms || [];
  const query = state.partnerQuery.trim().toLowerCase();
  return `<section>
    <div class="panel section-toolbar"><div><h2>Transfer Partners</h2><p>Standard, non-promotional transfer relationships. Active bonuses appear in the Transfer Bonuses tab.</p></div><div class="partner-controls"><div class="field compact"><label>Search partner</label><input id="partner-search" value="${escapeHtml(state.partnerQuery)}" placeholder="Virgin Atlantic, World of Hyatt"></div><div class="segmented"><button data-partner-view="program" class="${state.partnerView === "program" ? "active" : ""}">By program</button><button data-partner-view="card" class="${state.partnerView === "card" ? "active" : ""}">By card</button></div></div></div>
    ${programs.length ? (state.partnerView === "program" ? programsByProgramHtml(programs, query) : programsByCardHtml(programs, query)) : `<div class="panel empty"><h2>No transfer-partner data yet</h2><p>Run the Transfer Partners & Ratios prompt and import the returned JSON.</p></div>`}
  </section>`;
}

function filteredPartners(program, query) {
  if (!query) return program.partners;
  return program.partners.filter((partner) => `${partner.partnerName} ${partner.partnerType} ${partner.ratioDisplay}`.toLowerCase().includes(query));
}

function programsByProgramHtml(programs, query) {
  return `<div class="program-stack">${programs.map((program) => {
    const partners = filteredPartners(program, query);
    if (query && !partners.length && !program.programName.toLowerCase().includes(query)) return "";
    const airlines = partners.filter((item) => item.partnerType === "airline");
    const hotels = partners.filter((item) => item.partnerType === "hotel");
    const cards = program.cards.map((id) => cardMap().get(id)?.name).filter(Boolean);
    return `<article class="program-card"><div class="program-header"><div><h3>${escapeHtml(program.programName)}</h3><div class="subtext">Earned by: ${cards.map(escapeHtml).join(" · ") || "No mapped cards"}</div></div><span class="count-chip">${partners.length} partners</span></div><div class="partner-columns">${partnerColumn("Airlines", airlines)}${partnerColumn("Hotels", hotels)}</div></article>`;
  }).join("")}</div>`;
}

function programsByCardHtml(programs, query) {
  const cards = activeCards();
  return `<div class="program-stack">${cards.map((card) => {
    const matching = programs.filter((program) => program.cards.includes(card.id));
    const partners = matching.flatMap((program) => filteredPartners(program, query).map((partner) => ({...partner, programName: program.programName})));
    if (query && !partners.length && !card.name.toLowerCase().includes(query)) return "";
    if (!matching.length && !query) return `<article class="program-card muted-card"><div class="program-header"><div><h3>${escapeHtml(card.name)}</h3><div class="subtext">No transferable program imported</div></div><span class="count-chip">0 partners</span></div></article>`;
    return `<article class="program-card"><div class="program-header"><div><h3>${escapeHtml(card.name)}</h3><div class="subtext">${matching.map((item) => escapeHtml(item.programName)).join(" · ")}</div></div><span class="count-chip">${partners.length} partners</span></div><div class="partner-columns">${partnerColumn("Airlines", partners.filter((item) => item.partnerType === "airline"))}${partnerColumn("Hotels", partners.filter((item) => item.partnerType === "hotel"))}</div></article>`;
  }).join("")}</div>`;
}

function partnerColumn(title, partners) {
  return `<div><div class="eyebrow">${escapeHtml(title)}</div>${partners.length ? partners.map((partner) => `<div class="partner-row"><span>${escapeHtml(partner.partnerName)}</span><strong>${escapeHtml(partner.ratioDisplay)}</strong></div>`).join("") : `<div class="subtext partner-empty">None reported</div>`}</div>`;
}

function transferBonusesHtml() {
  const bonuses = state.stagedDatabase.transferBonuses || [];
  const programs = programMap();
  const grouped = new Map();
  bonuses.forEach((bonus) => {
    if (!grouped.has(bonus.sourceProgramId)) grouped.set(bonus.sourceProgramId, []);
    grouped.get(bonus.sourceProgramId).push(bonus);
  });
  const programIds = new Set([...programs.keys(), ...grouped.keys()]);
  return `<section><div class="panel section-toolbar"><div><h2>Active Transfer Bonuses</h2><p>Countdowns are calculated in your browser from the verified end date.</p></div></div>${programIds.size ? `<div class="program-stack">${[...programIds].map((id) => transferBonusGroupHtml(id, programs.get(id), grouped.get(id) || [])).join("")}</div>` : `<div class="panel empty"><h2>No transfer programs or bonuses imported</h2><p>Import transfer partners first, then run the Active Transfer Bonuses prompt.</p></div>`}</section>`;
}

function countdown(endDate) {
  const end = new Date(`${endDate}T23:59:59Z`).getTime();
  const diff = Math.max(0, end - Date.now());
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return `${days}d ${hours}h`;
}

function transferBonusGroupHtml(id, program, bonuses) {
  return `<article class="program-card bonus-program"><div class="program-header"><div><h3>${escapeHtml(program?.programName || id)}</h3></div><span class="count-chip ${bonuses.length ? "active-count" : ""}">${bonuses.length ? `${bonuses.length} active` : "No active bonus"}</span></div>${bonuses.length ? `<div class="table-shell compact-table"><table><thead><tr><th>Transfer partner</th><th>Regular</th><th>Bonus</th><th>Effective</th><th>Ends in</th><th>Channel</th></tr></thead><tbody>${bonuses.map((bonus, index) => `<tr class="row-shade-${index % 4}"><td><strong>${escapeHtml(bonus.destinationProgramName)}</strong><div class="subtext">${escapeHtml(bonus.note || "")}</div></td><td>${escapeHtml(bonus.standardRatio)}</td><td class="bonus-percent">+${fmtNumber(bonus.bonusPercent)}%</td><td class="cash-estimate">${escapeHtml(bonus.effectiveRatio)}</td><td><strong>${escapeHtml(countdown(bonus.endDate))}</strong><div class="subtext">${escapeHtml(fmtDate(bonus.endDate))}</div></td><td><span class="badge badge-medium ${bonus.publicOrTargeted === "public" ? "standard" : "targeted"}">${escapeHtml(statusLabel(bonus.publicOrTargeted))}</span></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty compact-empty">No transfer bonus running right now. Points transfer at standard ratios.</div>`}</article>`;
}

function compareHtml() {
  const cards = activeCards();
  while (state.compareIds.length < 4) state.compareIds.push("");
  const selected = state.compareIds.map((id) => cards.find((card) => card.id === id)).filter(Boolean);
  return `<section><div class="panel compare-picker"><div class="panel-header"><div><h2>Compare up to 4 cards</h2><p>Welcome offers, TPG estimates, fees, credits, benefits and transfer access.</p></div><button class="button small" data-action="clear-compare">Clear all</button></div><div class="compare-selects">${[0,1,2,3].map((index) => `<select data-compare-index="${index}"><option value="">Choose a card</option>${cards.map((card) => `<option value="${escapeHtml(card.id)}" ${state.compareIds[index] === card.id ? "selected" : ""}>${escapeHtml(card.name)}</option>`).join("")}</select>`).join("")}</div></div>${selected.length ? compareTableHtml(selected) : `<div class="panel empty">Choose one or more cards above.</div>`}</section>`;
}

function compareTableHtml(cards) {
  const details = detailsMap();
  const programs = state.stagedDatabase.transferPrograms || [];
  const rows = [
    ["Value tier", (card) => `<span class="tier tier-${valueTier(firstYearSummary(card).total).toLowerCase()}">${valueTier(firstYearSummary(card).total)}</span>`],
    ["Welcome bonus", (card) => { const offer = primaryOffer(card.id); return offer ? `${fmtNumber(offer.bonusAmount)} ${escapeHtml(offer.bonusUnit)}` : "—"; }],
    ["Bonus value", (card) => { const value = cashValue(card, primaryOffer(card.id)); return value ? `<span class="cash-estimate">${fmtMoney(value.value)}</span>` : "—"; }],
    ["CPP", (card) => { const value = cashValue(card, primaryOffer(card.id)); return value?.cpp ? `${value.cpp.toFixed(2)}¢` : "—"; }],
    ["Spend requirement", (card) => { const offer = primaryOffer(card.id); return offer?.spendRequirement != null ? `${fmtMoney(offer.spendRequirement)} / ${offer.spendPeriodMonths || "—"}mo` : "—"; }],
    ["Annual fee", (card) => { const offer = primaryOffer(card.id); return `${fmtMoney(offer?.annualFee ?? card.annualFee)}${offer && firstYearFeeWaived(offer) ? " · first year waived" : ""}`; }],
    ["Annual credit face value", (card) => fmtMoney((details.get(card.id)?.credits || []).reduce((sum, item) => sum + Number(item.faceValueAnnual || 0), 0))],
    ["Est. 1-yr value", (card) => `<span class="cash-estimate">${fmtMoney(firstYearSummary(card).total)}</span>`],
    ["Top earn rates", (card) => (details.get(card.id)?.earnRates || []).slice(0,3).map((item) => `${item.rate}${item.unit} ${item.category}`).join("; ") || "—"],
    ["Transfer partners", (card) => { const count = programs.filter((program) => program.cards.includes(card.id)).reduce((sum, program) => sum + program.partners.length, 0); return count || "—"; }],
    ["Lounge access", (card) => (details.get(card.id)?.loungeAccess || []).map((item) => item.name).join("; ") || "—"],
    ["Foreign transaction fee", (card) => details.get(card.id)?.foreignTransactionFee === 0 ? "None" : details.get(card.id)?.foreignTransactionFee != null ? `${details.get(card.id).foreignTransactionFee}%` : "—"]
  ];
  return `<div class="table-shell compare-shell"><table class="compare-table"><thead><tr><th>Benefit</th>${cards.map((card, index) => `<th class="compare-head compare-color-${index}"><strong>${escapeHtml(card.name)}</strong><a class="button primary small" href="${escapeHtml(card.applyUrl)}" target="_blank" rel="noopener noreferrer">Issuer site ↗</a></th>`).join("")}</tr></thead><tbody>${rows.map(([label, render]) => `<tr><th>${escapeHtml(label)}</th>${cards.map((card) => `<td>${render(card)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function archivedHtml() {
  const archived = state.stagedDatabase.cards.filter((card) => card.isArchived);
  return `<div class="panel"><div class="panel-header"><div><h2>Archived Cards</h2><p>Archived cards remain in the database but are excluded from research prompts and views.</p></div></div>${archived.length ? `<div class="card-list">${archived.map((card) => `<div class="card-list-item"><div><strong>${escapeHtml(card.name)}</strong><div class="subtext">${escapeHtml(card.issuer)} · archived ${escapeHtml(fmtDateTime(card.archivedAt))}</div></div><button class="button" data-action="restore-card" data-card-id="${escapeHtml(card.id)}">Restore</button></div>`).join("")}</div>` : `<div class="empty">No archived cards.</div>`}</div>`;
}

function migrationNoticeHtml() {
  const changes = [...(state.databaseMigration?.changes || []), ...(state.promptMigration?.changes || [])];
  if (!changes.length) return "";
  return `<div class="migration-notice"><strong>Compatibility update applied automatically.</strong> ${changes.length} legacy setting${changes.length === 1 ? " was" : "s were"} normalized in the browser. Save the affected file to GitHub once to make it permanent.</div>`;
}

function adminHtml() {
  const active = activeCards();
  return `<section class="admin-grid">
    <div class="full-span"><div class="panel-header"><div><h2>Admin Publisher</h2><p>Generate research prompts, validate section-based JSON, preview imports, and publish to GitHub.</p></div><button class="button purple" data-action="open-prompts">✨ Prompt Manager</button></div><div class="security-rule"><strong>Security rule:</strong> Use a fine-grained GitHub token restricted to this repository with only Contents: Read and write. CardTrack never stores the token.</div>${migrationNoticeHtml()}</div>
    <div class="panel full-span"><div class="panel-header"><div><h3>1. Import researched JSON</h3><p>CardTrack can import welcome offers, fact sheets, transfer partners, transfer bonuses, CPP valuations, or a complete v5 dataset.</p></div><button class="button purple small" data-action="open-prompts">✨</button></div>
      <div class="filters admin-import-controls"><div class="field"><label>Import type</label><select id="import-type"><option value="auto" ${state.importType === "auto" ? "selected" : ""}>Auto-detect</option><option value="offers" ${state.importType === "offers" ? "selected" : ""}>Welcome offers</option><option value="cardDetails" ${state.importType === "cardDetails" ? "selected" : ""}>Card facts & benefits</option><option value="transferPrograms" ${state.importType === "transferPrograms" ? "selected" : ""}>Transfer partners</option><option value="transferBonuses" ${state.importType === "transferBonuses" ? "selected" : ""}>Transfer bonuses</option><option value="valuations" ${state.importType === "valuations" ? "selected" : ""}>TPG valuations</option><option value="complete" ${state.importType === "complete" ? "selected" : ""}>Complete dataset</option></select></div><div class="field"><label>Import mode</label><select id="import-mode"><option value="merge" ${state.importMode === "merge" ? "selected" : ""}>Merge / preserve unaffected data</option><option value="replace" ${state.importMode === "replace" ? "selected" : ""}>Replace selected section</option></select></div></div>
      <textarea id="import-json" placeholder='Paste the complete JSON object here, starting with {'>${escapeHtml(state.importText)}</textarea>
      <div class="button-row" style="margin-top:10px"><button class="button primary" data-action="validate-import">Validate JSON</button><button class="button" data-action="clear-import">Clear</button><button class="button" data-action="download-backup">Download Full Backup</button></div>${validationHtml(state.validation)}
    </div>
    <div class="panel"><h3>2. Add a new card</h3><p class="subtext">Adds a card to the staged catalog. Use issuer data and verify all values.</p><form id="add-card-form"><div class="field"><label>Card name</label><input name="name" required></div><div class="filters two-col"><div class="field"><label>Issuer</label><input name="issuer" required></div><div class="field"><label>Rewards program</label><input name="program" required></div></div><div class="filters three-col"><div class="field"><label>Annual fee</label><input name="annualFee" type="number" min="0" value="0" required></div><div class="field"><label>Baseline offer</label><input name="baselineOffer" type="number" min="0" value="0" required></div><div class="field"><label>Historical high</label><input name="historicalHigh" type="number" min="0"></div></div><div class="field"><label>Bonus unit</label><select name="bonusUnit"><option>points</option><option>miles</option><option>cash</option><option>free-night certificate points</option></select></div><div class="field"><label>Official issuer URL</label><input name="applyUrl" type="url" required placeholder="https://..."></div><button class="button primary" style="margin-top:12px" type="submit">Add Card</button></form></div>
    <div class="panel"><h3>3. Card management</h3><p class="subtext">Archive active cards to hide them from views and research prompts.</p><div class="card-list">${active.map((card) => `<div class="card-list-item"><div><strong>${escapeHtml(card.name)}</strong><div class="subtext">${escapeHtml(card.issuer)} · ${escapeHtml(card.program)} · ${fmtMoney(card.annualFee)}/yr</div></div><button class="button danger small" data-action="archive-card" data-card-id="${escapeHtml(card.id)}">Hide / Archive</button></div>`).join("")}</div></div>
    <div class="panel full-span"><h3>4. Publish staged files to GitHub</h3><p class="subtext">Database and TPG valuation changes are saved separately. Prompt edits are saved from Prompt Manager.</p>${repositoryFields()}<div class="field" style="margin-top:10px"><label for="github-token">Fine-grained GitHub token</label><input id="github-token" type="password" autocomplete="off" placeholder="Paste only when testing or saving"></div><div class="button-row" style="margin-top:12px"><button class="button" data-action="test-repo">Test Repository Access</button><button class="button green" data-action="save-database">Save Database to GitHub</button><button class="button green" data-action="save-valuations">Save TPG Valuations to GitHub</button></div><div id="github-status" class="validation-strip">The token field is cleared after every GitHub attempt.</div></div>
  </section>`;
}

function repositoryFields() {
  return `<div class="filters repo-fields"><div class="field"><label>Owner</label><input data-repo="owner" value="${escapeHtml(state.repository.owner)}"></div><div class="field"><label>Repository</label><input data-repo="repo" value="${escapeHtml(state.repository.repo)}"></div><div class="field"><label>Branch</label><input data-repo="branch" value="${escapeHtml(state.repository.branch)}"></div><div class="field"><label>Database path</label><input data-repo="dataPath" value="${escapeHtml(state.repository.dataPath)}"></div><div class="field"><label>Valuations path</label><input data-repo="valuationsPath" value="${escapeHtml(state.repository.valuationsPath)}"></div></div>`;
}

function validationHtml(validation) {
  if (!validation) return `<div class="validation-strip">No import has been validated.</div>`;
  const good = validation.valid;
  return `<div class="validation-strip ${good ? "good" : "bad"}">${good ? `Validation passed for ${escapeHtml(validation.type)}.` : `Validation found ${validation.rejected.length} rejected item(s).`} ${validation.accepted.length} item(s) accepted.</div><div class="summary-grid">${summaryCard("Import type", validation.type)}${summaryCard("Accepted", validation.summary.acceptedCount)}${summaryCard("Rejected", validation.summary.rejectedCount)}${summaryCard("Mode", state.importMode)}</div>${validation.errors.length ? `<div class="test-results"><ul>${validation.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul></div>` : ""}${validation.valid ? `<button class="button primary" style="margin-top:12px" data-action="apply-import">Apply Validated Import</button>` : ""}`;
}

function summaryCard(label, value) {
  return `<div class="summary-card"><span class="subtext">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function methodologyHtml() {
  const programs = Object.entries(state.valuations?.programs || {});
  return `<section class="methodology-grid"><div class="panel"><h2>Offer classification</h2><p>Public offers above the catalog baseline display as Elevated unless explicitly Limited Time or marked Needs Review. Non-public channels display as Targeted.</p><p>Elevated and Limited Time badges use a subtle flashing pulse for visibility. The animation is disabled automatically when the device requests reduced motion.</p></div><div class="panel"><h2>First-year value estimates</h2><p>Estimated first-year value equals welcome-bonus value plus imported credit face value multiplied by its utilization setting, plus any explicitly valued perks, minus the first-year annual fee. It is an estimate, not cash or an issuer guarantee.</p></div><div class="panel"><h2>TPG valuations</h2><p>${escapeHtml(state.valuations?.disclaimer || "Editorial estimates only.")}</p><p><a href="${escapeHtml(state.valuations?.sourceUrl || "#")}" target="_blank" rel="noopener noreferrer">TPG monthly valuations</a> · snapshot ${escapeHtml(state.valuations?.asOf || "—")}</p><table class="cpp-table"><thead><tr><th>Program</th><th>CPP</th></tr></thead><tbody>${programs.map(([program, item]) => `<tr><td>${escapeHtml(program)}</td><td>${Number(item.cpp).toFixed(2)}¢</td></tr>`).join("")}</tbody></table></div><div class="panel"><h2>Data separation</h2><p>Welcome offers, recurring card facts, standard transfer partners, active transfer bonuses, and CPP valuations are stored separately. Partial imports update only the selected section, protecting unaffected data.</p></div></section>`;
}

function promptManagerHtml() {
  if (!state.promptManagerOpen) return "";
  const template = state.stagedPrompts.templates.find((item) => item.id === state.selectedTemplateId) || state.stagedPrompts.templates[0];
  const content = effectiveTemplateContent(state.stagedPrompts, template);
  const variantOptions = {workflow: state.promptWorkflow, provider: state.promptProvider, stage: state.promptStage};
  const resolved = resolvePromptVariant(state.stagedPrompts, template, state.stagedDatabase.cards, new Date(), state.stagedDatabase, variantOptions);
  const selectedCount = filterCards(state.stagedDatabase.cards, template.filter).length;
  const variant = promptVariantLabel(variantOptions);
  const copyLabel = state.promptWorkflow === "two-step" ? (state.promptStage === "json" ? "📋 Copy Step 2 — JSON Prompt" : "📋 Copy Step 1 — Research Prompt") : "📋 Copy One-Step JSON Prompt";
  const lastSaved = state.stagedPrompts.lastSavedToGitHubAt ? fmtDateTime(state.stagedPrompts.lastSavedToGitHubAt) : "Not yet saved from this version";
  const usage = state.promptWorkflow === "two-step"
    ? (state.promptStage === "json" ? "Paste this into the same Deep Research conversation after Step 1 finishes." : "Start a new Deep Research conversation with this prompt. When the report finishes, return here and copy Step 2.")
    : `Paste this into a normal ${state.promptProvider === "gemini" ? "Gemini chat with Google Search" : "ChatGPT chat with Search enabled"}; do not select Deep Research.`;
  return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="prompt-manager-title"><div class="modal"><div class="modal-header"><div><h2 id="prompt-manager-title">Prompt Manager</h2><div class="subtext">Choose the data category first, then choose one-step Search or two-step Deep Research for ChatGPT or Gemini.</div></div><button class="button" data-action="close-prompts">✕</button></div><div class="modal-body"><div class="prompt-choice-grid"><div class="field"><label>1. Data category / saved template</label><select id="template-select" class="saved-template-select">${state.stagedPrompts.templates.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === template.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select><div class="template-meta">${escapeHtml(template.description)} · ${selectedCount} active card${selectedCount === 1 ? "" : "s"}</div></div><div class="prompt-choice"><div class="choice-label">2. Workflow</div><div class="segmented prompt-segment"><button class="${state.promptWorkflow === "one-step" ? "active" : ""}" data-action="set-prompt-workflow" data-value="one-step">1-Step · Regular Search</button><button class="${state.promptWorkflow === "two-step" ? "active" : ""}" data-action="set-prompt-workflow" data-value="two-step">2-Step · Deep Research</button></div></div><div class="prompt-choice"><div class="choice-label">3. Platform</div><div class="segmented prompt-segment"><button class="${state.promptProvider === "chatgpt" ? "active" : ""}" data-action="set-prompt-provider" data-value="chatgpt">ChatGPT</button><button class="${state.promptProvider === "gemini" ? "active" : ""}" data-action="set-prompt-provider" data-value="gemini">Gemini</button></div></div>${state.promptWorkflow === "two-step" ? `<div class="prompt-choice"><div class="choice-label">4. Deep Research step</div><div class="segmented prompt-segment"><button class="${state.promptStage === "research" ? "active" : ""}" data-action="set-prompt-stage" data-value="research">Step 1 · Research Report</button><button class="${state.promptStage === "json" ? "active" : ""}" data-action="set-prompt-stage" data-value="json">Step 2 · JSON Conversion</button></div></div>` : ""}</div><div class="workflow-summary"><strong>${escapeHtml(variant)}</strong><span>${escapeHtml(usage)}</span></div><div class="prompt-actions prompt-actions-main"><button class="button primary" data-action="copy-prompt">${copyLabel}</button><button class="button" data-action="save-template-local">Save Category Edit</button><button class="button" data-action="restore-template">Restore Default</button><button class="button" data-action="import-prompts">Import</button><button class="button" data-action="export-current-prompt">Export Current</button><button class="button" data-action="export-prompts">Export Library</button></div><div class="prompt-layout"><div><div class="editor-label"><span>Editable category template</span><span class="subtext">The app adds the selected platform/workflow instructions automatically. Keep required {{...}} placeholders.</span></div><div class="editor-wrap"><pre id="prompt-highlight" class="editor-highlight" aria-hidden="true">${highlightPrompt(content)}</pre><textarea id="prompt-editor" class="editor-input" spellcheck="false">${escapeHtml(content)}</textarea></div></div><div><div class="editor-label"><span>Resolved prompt to copy</span><span class="subtext">Current date, active catalog and stored data are injected automatically</span></div><pre id="resolved-prompt" class="resolved-preview">${escapeHtml(resolved)}</pre></div></div><div class="modal-footer"><div style="flex:1;min-width:280px"><div class="field"><label>Fine-grained GitHub token</label><input id="prompt-github-token" type="password" autocomplete="off"></div><div class="button-row" style="margin-top:8px"><button class="button purple" data-action="save-prompts-github">💾 Save Prompt Library to GitHub</button><span class="prompt-saved-time"><strong>Last saved to GitHub:</strong> ${escapeHtml(lastSaved)}</span></div><div class="subtext">Writes only ${PROMPTS_PATH}. Newly added active cards are inserted into every resolved prompt automatically.</div></div><span class="subtext">${state.promptDirty ? "Unsaved prompt changes" : "Prompt library unchanged"}</span></div><div class="test-box"><h3>🧪 Test returned JSON against CardTrack schema</h3><p class="subtext">The tester auto-detects welcome offers, card facts, transfer partners, transfer bonuses, valuations, or a complete dataset.</p><textarea id="prompt-test-json" placeholder="Paste returned JSON here">${escapeHtml(state.promptTestText)}</textarea><div class="button-row" style="margin-top:9px"><button class="button primary" data-action="test-json">Test JSON</button><button class="button" data-action="copy-to-publisher" ${state.promptTestResult?.valid ? "" : "disabled"}>Copy to Publisher</button></div>${promptTestHtml()}</div></div></div></div>`;
}

function highlightPrompt(content) {
  return escapeHtml(content)
    .replace(/(\{\{(?:TODAY|SCOPE_INSTRUCTION|ACTIVE_CARD_CATALOG|CURRENT_DATABASE_SUMMARY)\}\})/g, '<span class="syntax-placeholder">$1</span>')
    .replace(/(^|\n)([A-Z][A-Z /&-]{3,})(?=\n)/g, '$1<span class="syntax-heading">$2</span>')
    .replace(/(&quot;[^&\n]*?&quot;\s*:)/g, '<span class="syntax-json">$1</span>');
}

function promptTestHtml() {
  const result = state.promptTestResult;
  if (!result) return `<div class="validation-strip">No JSON test has been run.</div>`;
  return `<div class="validation-strip ${result.valid ? "good" : "bad"}">${result.valid ? `JSON passes as ${escapeHtml(result.type)}.` : "JSON does not fully comply."} Accepted ${result.accepted.length}; rejected ${result.rejected.length}.</div>${result.errors.length ? `<div class="test-results"><ul>${result.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul></div>` : ""}`;
}

function render() {
  if (!state.stagedDatabase) return;
  const views = {
    offers: dashboardHtml,
    "transfer-bonuses": transferBonusesHtml,
    "transfer-partners": transferPartnersHtml,
    "fact-sheets": factSheetsHtml,
    compare: compareHtml,
    archived: archivedHtml,
    admin: adminHtml,
    methodology: methodologyHtml
  };
  const body = (views[state.tab] || dashboardHtml)();
  app.innerHTML = `<div class="app-shell">${headerHtml()}<main class="content"><div class="notice info-notice">Showing the latest validated snapshot stored in GitHub. Editorial values and first-year estimates are not issuer guarantees.</div>${tabsHtml()}${body}<div class="footer">CardTrack is an informational tool. Verify current terms directly with the issuer before applying.</div></main></div>${promptManagerHtml()}`;
  bindEvents();
}

function renderPreserveFocus(elementId, selectionStart = null) {
  render();
  requestAnimationFrame(() => {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.focus();
    if (selectionStart !== null && typeof element.setSelectionRange === "function") element.setSelectionRange(selectionStart, selectionStart);
  });
}

function bindEvents() {
  document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => { state.tab = button.dataset.tab; render(); }));
  document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", handleAction));
  document.querySelectorAll("[data-filter]").forEach((input) => input.addEventListener(input.tagName === "INPUT" ? "input" : "change", () => {
    state[input.dataset.filter] = input.value;
    if (input.tagName === "INPUT") renderPreserveFocus(input.id, input.selectionStart); else render();
  }));
  document.querySelectorAll("[data-repo]").forEach((input) => input.addEventListener("input", () => { state.repository[input.dataset.repo] = input.value.trim(); }));
  document.querySelectorAll("[data-partner-view]").forEach((button) => button.addEventListener("click", () => { state.partnerView = button.dataset.partnerView; render(); }));
  document.querySelectorAll("[data-compare-index]").forEach((select) => select.addEventListener("change", () => { state.compareIds[Number(select.dataset.compareIndex)] = select.value; render(); }));
  document.querySelector("#fact-search")?.addEventListener("input", (event) => { state.factQuery = event.target.value; renderPreserveFocus("fact-search", event.target.selectionStart); });
  document.querySelector("#partner-search")?.addEventListener("input", (event) => { state.partnerQuery = event.target.value; renderPreserveFocus("partner-search", event.target.selectionStart); });
  document.querySelector("#import-json")?.addEventListener("input", (event) => { state.importText = event.target.value; });
  document.querySelector("#import-type")?.addEventListener("change", (event) => { state.importType = event.target.value; });
  document.querySelector("#import-mode")?.addEventListener("change", (event) => { state.importMode = event.target.value; });
  document.querySelector("#add-card-form")?.addEventListener("submit", addCard);
  bindPromptEvents();
}

function bindPromptEvents() {
  document.querySelector("#template-select")?.addEventListener("change", (event) => {
    saveCurrentEditorToState(false);
    state.selectedTemplateId = event.target.value;
    state.promptTestResult = null;
    render();
  });
  const editor = document.querySelector("#prompt-editor");
  const highlight = document.querySelector("#prompt-highlight");
  if (editor && highlight) {
    editor.addEventListener("input", () => {
      highlight.innerHTML = highlightPrompt(editor.value) + "\n";
      state.promptDirty = true;
      updateResolvedPreview(editor.value);
    });
    editor.addEventListener("scroll", () => { highlight.scrollTop = editor.scrollTop; highlight.scrollLeft = editor.scrollLeft; });
  }
  document.querySelector("#prompt-test-json")?.addEventListener("input", (event) => { state.promptTestText = event.target.value; });
}

function updateResolvedPreview(content) {
  const template = state.stagedPrompts.templates.find((item) => item.id === state.selectedTemplateId);
  const temporary = structuredClone(state.stagedPrompts);
  temporary.templates.find((item) => item.id === template.id).customPrompt = content;
  const preview = document.querySelector("#resolved-prompt");
  if (preview) preview.textContent = resolvePromptVariant(temporary, temporary.templates.find((item) => item.id === template.id), state.stagedDatabase.cards, new Date(), state.stagedDatabase, {workflow: state.promptWorkflow, provider: state.promptProvider, stage: state.promptStage});
}

function saveCurrentEditorToState(notify = true) {
  const editor = document.querySelector("#prompt-editor");
  if (!editor) return true;
  const content = editor.value;
  for (const placeholder of ["{{TODAY}}", "{{ACTIVE_CARD_CATALOG}}"] ) {
    if (!content.includes(placeholder)) {
      if (notify) toast(`Prompt must keep ${placeholder}.`, "error");
      return false;
    }
  }
  state.stagedPrompts = updateTemplateContent(state.stagedPrompts, state.selectedTemplateId, content);
  state.promptDirty = true;
  if (notify) toast("Template edit saved in the staged browser copy.");
  return true;
}

async function handleAction(event) {
  const action = event.currentTarget.dataset.action;
  try {
    if (action === "toggle-theme") {
      state.theme = state.theme === "light" ? "dark" : "light";
      localStorage.setItem("cardtrack-theme", state.theme);
      document.documentElement.dataset.theme = state.theme;
      render();
    } else if (action === "set-prompt-workflow") {
      saveCurrentEditorToState(false);
      state.promptWorkflow = event.currentTarget.dataset.value === "two-step" ? "two-step" : "one-step";
      localStorage.setItem("cardtrack-prompt-workflow", state.promptWorkflow);
      state.promptStage = state.promptWorkflow === "one-step" ? "json" : "research";
      localStorage.setItem("cardtrack-prompt-stage", state.promptStage);
      render();
    } else if (action === "set-prompt-provider") {
      saveCurrentEditorToState(false);
      state.promptProvider = event.currentTarget.dataset.value === "gemini" ? "gemini" : "chatgpt";
      localStorage.setItem("cardtrack-prompt-provider", state.promptProvider);
      render();
    } else if (action === "set-prompt-stage") {
      saveCurrentEditorToState(false);
      state.promptStage = event.currentTarget.dataset.value === "json" ? "json" : "research";
      localStorage.setItem("cardtrack-prompt-stage", state.promptStage);
      render();
    } else if (action === "reload") {
      if ((state.promptDirty || JSON.stringify(state.stagedDatabase) !== JSON.stringify(state.database)) && !confirm("Reloading will discard staged browser changes. Continue?")) return;
      await initialize(); toast("Reloaded the latest GitHub Pages data.");
    } else if (action === "open-prompts") {
      state.promptManagerOpen = true; render();
    } else if (action === "close-prompts") {
      saveCurrentEditorToState(false); state.promptManagerOpen = false; render();
    } else if (action === "validate-import") {
      state.importText = document.querySelector("#import-json").value;
      const payload = parseResearchJson(state.importText);
      state.validation = validateSectionPayload(payload, state.stagedDatabase, {type: state.importType});
      render();
    } else if (action === "clear-import") {
      state.importText = ""; state.validation = null; render();
    } else if (action === "apply-import") {
      if (!state.validation?.valid) return;
      if (state.validation.type === "valuations") {
        state.valuations = structuredClone(state.validation.accepted[0]);
      } else {
        state.stagedDatabase = applySectionImport(state.stagedDatabase, state.validation, state.importMode);
      }
      const appliedType = state.validation.type;
      state.importText = ""; state.validation = null; render(); toast(`Validated ${appliedType} import applied to the staged data.`);
    } else if (action === "archive-card") {
      archiveCard(event.currentTarget.dataset.cardId);
    } else if (action === "restore-card") {
      restoreCard(event.currentTarget.dataset.cardId);
    } else if (action === "download-backup") {
      downloadJson({database: state.stagedDatabase, valuations: state.valuations, prompts: state.stagedPrompts}, `cardtrack-full-backup-${new Date().toISOString().slice(0,10)}.json`);
    } else if (action === "test-repo") {
      await runGithub("test");
    } else if (action === "save-database") {
      await runGithub("database");
    } else if (action === "save-valuations") {
      await runGithub("valuations");
    } else if (action === "clear-compare") {
      state.compareIds = ["", "", "", ""]; render();
    } else if (action === "copy-prompt") {
      if (state.promptDirty) saveCurrentEditorToState(false);
      const template = state.stagedPrompts.templates.find((item) => item.id === state.selectedTemplateId);
      const resolvedPrompt = resolvePromptVariant(state.stagedPrompts, template, state.stagedDatabase.cards, new Date(), state.stagedDatabase, {workflow: state.promptWorkflow, provider: state.promptProvider, stage: state.promptStage});
      await navigator.clipboard.writeText(resolvedPrompt);
      toast(`${promptVariantLabel({workflow: state.promptWorkflow, provider: state.promptProvider, stage: state.promptStage})} copied.`);
    } else if (action === "save-template-local") {
      saveCurrentEditorToState(true); render();
    } else if (action === "restore-template") {
      if (!confirm("Restore this template to the package default?")) return;
      state.stagedPrompts = restoreTemplateDefault(state.stagedPrompts, state.selectedTemplateId); state.promptDirty = true; render(); toast("Template restored to default.");
    } else if (action === "export-current-prompt") {
      saveCurrentEditorToState(false);
      const template = state.stagedPrompts.templates.find((item) => item.id === state.selectedTemplateId);
      downloadText(effectiveTemplateContent(state.stagedPrompts, template), `cardtrack-prompt-${template.id}.txt`);
    } else if (action === "export-prompts") {
      saveCurrentEditorToState(false); downloadJson(state.stagedPrompts, `cardtrack-prompts-${new Date().toISOString().slice(0,10)}.json`);
    } else if (action === "import-prompts") {
      promptFileInput.value = ""; promptFileInput.click();
    } else if (action === "save-prompts-github") {
      saveCurrentEditorToState(false); await runGithub("prompts");
    } else if (action === "test-json") {
      state.promptTestText = document.querySelector("#prompt-test-json").value;
      state.promptTestPayload = parseResearchJson(state.promptTestText);
      state.promptTestResult = validateSectionPayload(state.promptTestPayload, state.stagedDatabase, {type: "auto"});
      render();
    } else if (action === "copy-to-publisher") {
      if (!state.promptTestResult?.valid || !state.promptTestPayload) return;
      state.importText = JSON.stringify(state.promptTestPayload, null, 2);
      state.importType = state.promptTestResult.type;
      state.importMode = "merge";
      state.validation = null;
      state.promptManagerOpen = false;
      state.tab = "admin";
      render();
      toast("Validated JSON copied into Admin Publisher.");
    }
  } catch (error) {
    toast(error.message, "error");
    setGithubStatus(error.message, false);
  }
}

promptFileInput.addEventListener("change", async () => {
  const file = promptFileInput.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    let imported = null;
    try { imported = JSON.parse(text); } catch { /* individual prompt */ }
    if (imported && typeof imported === "object" && Array.isArray(imported.templates)) {
      const migrated = migratePromptLibrary(imported, state.defaultPrompts).library;
      const check = validatePromptLibrary(migrated);
      if (!check.valid) throw new Error(check.errors.join(" "));
      state.stagedPrompts = migrated;
      state.selectedTemplateId = migrated.defaultTemplateId;
      toast("Prompt library imported into the staged browser copy.");
    } else {
      if (!text.includes("{{ACTIVE_CARD_CATALOG}}") || !text.includes("{{TODAY}}")) throw new Error("An individual prompt must include {{TODAY}} and {{ACTIVE_CARD_CATALOG}}.");
      state.stagedPrompts = updateTemplateContent(state.stagedPrompts, state.selectedTemplateId, text);
      toast("Prompt text imported into the selected template.");
    }
    state.promptDirty = true;
    render();
  } catch (error) {
    toast(`Prompt import failed: ${error.message}`, "error");
  }
});

function addCard(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const name = String(data.get("name") || "").trim();
  let id = name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const existing = new Set(state.stagedDatabase.cards.map((card) => card.id));
  let candidate = id; let n = 2;
  while (existing.has(candidate)) candidate = `${id}-${n++}`;
  const now = new Date().toISOString();
  state.stagedDatabase.cards.push({id: candidate, name, issuer: String(data.get("issuer") || "").trim(), program: String(data.get("program") || "").trim(), annualFee: Number(data.get("annualFee")), baselineOffer: Number(data.get("baselineOffer")), historicalHigh: data.get("historicalHigh") === "" ? null : Number(data.get("historicalHigh")), bonusUnit: String(data.get("bonusUnit")), applyUrl: String(data.get("applyUrl") || "").trim(), isArchived: false, archivedAt: null, createdAt: now, updatedAt: now});
  state.promptTestResult = null;
  render(); toast(`Added ${name}. Every resolved research prompt now includes this active card automatically.`);
}

function archiveCard(cardId) {
  const card = state.stagedDatabase.cards.find((item) => item.id === cardId);
  if (!card || !confirm(`Archive ${card.name}?`)) return;
  card.isArchived = true; card.archivedAt = new Date().toISOString(); card.updatedAt = card.archivedAt;
  render(); toast(`${card.name} archived in the staged database.`);
}

function restoreCard(cardId) {
  const card = state.stagedDatabase.cards.find((item) => item.id === cardId);
  if (!card) return;
  card.isArchived = false; card.archivedAt = null; card.updatedAt = new Date().toISOString();
  render(); toast(`${card.name} restored in the staged database.`);
}

function downloadJson(value, filename) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

function downloadText(value, filename) {
  const blob = new Blob([value], {type: "text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

function currentToken() {
  return document.querySelector("#github-token")?.value.trim() || document.querySelector("#prompt-github-token")?.value.trim() || prompt("Paste the fine-grained GitHub token. It will not be stored.") || "";
}

async function runGithub(mode) {
  const token = currentToken();
  if (!token) throw new Error("A GitHub token is required for this action.");
  const base = {owner: state.repository.owner, repo: state.repository.repo, branch: state.repository.branch, token};
  if (!base.owner || !base.repo || !base.branch) throw new Error("GitHub owner, repository, and branch are required.");
  setGithubStatus("Contacting GitHub…", null);
  try {
    if (mode === "test") {
      const response = await testRepositoryAccess({...base, path: state.repository.dataPath});
      setGithubStatus(`Repository access confirmed. Current file SHA starts ${response.sha.slice(0, 8)}.`, true);
      toast("Repository access confirmed.");
    } else if (mode === "database") {
      const check = validateDatabase(state.stagedDatabase, {rejectExpired: false});
      if (!check.valid) throw new Error(`Staged database is invalid: ${check.errors[0]}`);
      const response = await putJsonFile({...base, path: state.repository.dataPath, value: state.stagedDatabase, message: "Update CardTrack v5 database from Admin Publisher"});
      state.database = structuredClone(state.stagedDatabase);
      state.databaseMigration = {migrated: false, changes: []};
      setGithubStatus(`Database saved. Commit: ${response.commit?.html_url || "created"}`, true);
      toast("Database saved to GitHub. GitHub Actions will redeploy the site.");
    } else if (mode === "valuations") {
      const validation = validateSectionPayload(state.valuations, state.stagedDatabase, {type: "valuations"});
      if (!validation.valid) throw new Error(`Valuations are invalid: ${validation.errors[0]}`);
      await putJsonFile({...base, path: state.repository.valuationsPath, value: state.valuations, message: "Update CardTrack TPG valuations"});
      state.savedValuations = structuredClone(state.valuations);
      setGithubStatus("TPG valuations saved to GitHub.", true);
      toast("TPG valuations saved to GitHub.");
    } else if (mode === "prompts") {
      const nextPrompts = structuredClone(state.stagedPrompts);
      nextPrompts.lastSavedToGitHubAt = new Date().toISOString();
      nextPrompts.updatedAt = nextPrompts.lastSavedToGitHubAt;
      const check = validatePromptLibrary(nextPrompts);
      if (!check.valid) throw new Error(`Prompt library is invalid: ${check.errors[0]}`);
      await putJsonFile({...base, path: state.repository.promptsPath, value: nextPrompts, message: "Update CardTrack v5.1 prompt library"});
      state.stagedPrompts = structuredClone(nextPrompts);
      state.prompts = structuredClone(nextPrompts);
      state.promptDirty = false;
      toast(`Prompt library saved to GitHub at ${fmtDateTime(nextPrompts.lastSavedToGitHubAt)}.`); render();
    }
  } finally {
    document.querySelectorAll("#github-token, #prompt-github-token").forEach((field) => { field.value = ""; });
  }
}

function setGithubStatus(message, success) {
  const box = document.querySelector("#github-status");
  if (!box) return;
  box.textContent = message;
  box.className = `validation-strip ${success === true ? "good" : success === false ? "bad" : ""}`;
}

initialize();
