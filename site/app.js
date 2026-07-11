import {
  APP_VERSION,
  DATABASE_COMPATIBILITY_VERSION,
  effectiveStatus,
  firstYearFeeWaived,
  mergeOffers,
  migrateDatabase,
  parseResearchJson,
  validateDatabase,
  validateImportPayload
} from "./lib/schema.mjs";
import {
  effectiveTemplateContent,
  filterCards,
  resolvePrompt,
  restoreTemplateDefault,
  updateTemplateContent,
  validatePromptLibrary
} from "./lib/prompts.mjs";
import {inferRepoFromLocation, putJsonFile, testRepositoryAccess} from "./lib/github.mjs";

const DATA_PATH = "site/data/cardtrack.json";
const PROMPTS_PATH = "site/data/prompts.json";
const app = document.querySelector("#app");
const promptFileInput = document.querySelector("#prompt-file-input");

const state = {
  database: null,
  stagedDatabase: null,
  databaseMigration: {migrated: false, changes: []},
  prompts: null,
  stagedPrompts: null,
  valuations: null,
  tab: "offers",
  theme: localStorage.getItem("cardtrack-theme") || "light",
  query: "",
  issuer: "all",
  channel: "all",
  status: "all",
  sort: "promotions",
  importText: "",
  importMode: "merge",
  validation: null,
  promptManagerOpen: false,
  selectedTemplateId: "full-catalog",
  promptTestText: "",
  promptTestResult: null,
  promptDirty: false,
  repository: {...inferRepoFromLocation(), dataPath: DATA_PATH, promptsPath: PROMPTS_PATH},
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
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {maximumFractionDigits: 0}).format(value);
}

function fmtMoney(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {style: "currency", currency: "USD", maximumFractionDigits: 0}).format(value);
}

function fmtDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"});
}

function SCHEMA_VERSION_LABEL() {
  return `${state.stagedDatabase?.schemaVersion ?? 3}.${state.stagedDatabase?.compatibilityVersion ?? DATABASE_COMPATIBILITY_VERSION}`;
}

function statusLabel(status) {
  return ({standard: "Standard", elevated: "Elevated", limited: "Limited Time", targeted: "Targeted", review: "Needs Review"})[status] || status;
}

function cashValue(card, offer) {
  if (offer.bonusUnit === "cash") return {value: offer.bonusAmount, cpp: null, label: "Cash face value"};
  const valuation = state.valuations?.programs?.[card.program];
  if (!valuation) return null;
  return {value: offer.bonusAmount * valuation.cpp / 100, cpp: valuation.cpp, label: valuation.label};
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

async function loadJson(path) {
  const response = await fetch(`${path}?v=${Date.now()}`, {cache: "no-store"});
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
  return response.json();
}

async function initialize() {
  try {
    const [database, prompts, valuations] = await Promise.all([
      loadJson("./data/cardtrack.json"),
      loadJson("./data/prompts.json"),
      loadJson("./data/tpg-valuations.json")
    ]);
    const migration = migrateDatabase(database);
    const normalizedDatabase = migration.database;
    const dbCheck = validateDatabase(normalizedDatabase, {rejectExpired: false});
    if (!dbCheck.valid) throw new Error(`Saved database is invalid: ${dbCheck.errors[0]}`);
    const promptCheck = validatePromptLibrary(prompts);
    if (!promptCheck.valid) throw new Error(`Prompt library is invalid: ${promptCheck.errors[0]}`);
    state.database = structuredClone(normalizedDatabase);
    state.stagedDatabase = structuredClone(normalizedDatabase);
    state.databaseMigration = migration;
    state.prompts = prompts;
    state.stagedPrompts = structuredClone(prompts);
    state.selectedTemplateId = prompts.defaultTemplateId;
    render();
  } catch (error) {
    app.innerHTML = `<main class="content"><div class="notice"><strong>CardTrack could not start.</strong><br>${escapeHtml(error.message)}</div></main>`;
  }
}

function activeCards() {
  return state.stagedDatabase.cards.filter((card) => !card.isArchived);
}

function cardMap() {
  return new Map(state.stagedDatabase.cards.map((card) => [card.id, card]));
}

function displayedOffers() {
  const cards = cardMap();
  const query = state.query.trim().toLowerCase();
  let rows = state.stagedDatabase.offers
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
      <div class="brand"><div class="brand-mark">CT</div><div><div class="brand-title">CardTrack</div><div class="brand-subtitle">Welcome-offer intelligence</div></div></div>
      <div class="header-actions">
        <span class="version-chip" title="Application and data compatibility versions">App v${escapeHtml(APP_VERSION)} · Schema v${escapeHtml(SCHEMA_VERSION_LABEL())}</span>
        <span class="badge ${state.stagedDatabase.dataStatus === "live" ? "elevated" : "targeted"}">${escapeHtml(state.stagedDatabase.dataStatus.toUpperCase())} · ${escapeHtml(fmtDateTime(state.stagedDatabase.generatedAt))}</span>
        <button class="button small" data-action="toggle-theme" title="Toggle light/dark mode">◐</button>
        <button class="button" data-action="reload">Reload GitHub data</button>
      </div>
    </div>
  </header>`;
}

function tabsHtml() {
  const tabs = [
    ["offers", "Current Offers"],
    ["archived", `Archived Cards (${state.stagedDatabase.cards.filter((card) => card.isArchived).length})`],
    ["admin", "Admin Publisher"],
    ["methodology", "Methodology"]
  ];
  return `<nav class="tabs" aria-label="CardTrack sections">${tabs.map(([id, label]) => `<button class="tab" data-tab="${id}" aria-selected="${state.tab === id}">${escapeHtml(label)}</button>`).join("")}</nav>`;
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
      ${kpi("Active cards", cards.length, "Archived cards excluded", "")}
      ${kpi("Verified offers", offers.length, "Current saved records", "green")}
      ${kpi("Elevated / limited", promotional.length, "Public promotional offers", "purple")}
      ${kpi("Needs review", review.length, "Conflicts or weak support", "amber")}
    </div>
    <div class="panel filters">
      <div class="field"><label for="filter-search">Search</label><input id="filter-search" data-filter="query" value="${escapeHtml(state.query)}" placeholder="Card, issuer, or rewards program"></div>
      <div class="field"><label for="filter-issuer">Issuer</label><select id="filter-issuer" data-filter="issuer"><option value="all">All issuers</option>${issuers.map((issuer) => `<option ${state.issuer === issuer ? "selected" : ""}>${escapeHtml(issuer)}</option>`).join("")}</select></div>
      <div class="field"><label for="filter-channel">Channel</label><select id="filter-channel" data-filter="channel">${options(["all", "public", "targeted", "referral", "branch", "mailer"], state.channel, "All channels")}</select></div>
      <div class="field"><label for="filter-status">Status</label><select id="filter-status" data-filter="status">${options(["all", "standard", "elevated", "limited", "targeted", "review"], state.status, "All statuses")}</select></div>
      <div class="field"><label for="filter-sort">Sort</label><select id="filter-sort" data-filter="sort">${sortOptions()}</select></div>
    </div>
    <div class="panel" style="padding:0">
      ${rows.length ? offerTable(rows) : `<div class="empty"><strong>No offers match the current filters.</strong></div>`}
    </div>
    <div class="footer">Estimated cash values use TPG editorial CPP valuations dated ${escapeHtml(state.valuations.asOf)}. Values are estimates, not issuer guarantees.</div>
  </section>`;
}

function kpi(label, value, sub, cls) {
  return `<div class="kpi ${cls}"><div class="kpi-label">${escapeHtml(label)}</div><div class="kpi-value">${escapeHtml(value)}</div><div class="kpi-sub">${escapeHtml(sub)}</div></div>`;
}

function options(values, selected, firstLabel) {
  return values.map((value, index) => `<option value="${value}" ${selected === value ? "selected" : ""}>${escapeHtml(index === 0 && value === "all" ? firstLabel : statusLabel(value))}</option>`).join("");
}

function sortOptions() {
  const values = [["promotions", "Promotions first"], ["cash", "Highest TPG value"], ["bonus", "Highest bonus"], ["fee", "Highest annual fee"], ["name", "Card name"]];
  return values.map(([value, label]) => `<option value="${value}" ${state.sort === value ? "selected" : ""}>${label}</option>`).join("");
}

function offerTable(rows) {
  return `<div class="table-shell"><table class="offer-table">
    <thead><tr><th>Card / Program</th><th>Welcome Offer</th><th>Est. TPG Value</th><th>Spend Requirement</th><th>Annual Fee</th><th>Promotion</th><th>Channel</th><th>Verified</th><th>Sources</th><th></th></tr></thead>
    <tbody>${rows.map(({card, offer}) => offerRow(card, offer)).join("")}</tbody>
  </table></div>`;
}

function offerRow(card, offer) {
  const effective = effectiveStatus(offer, card);
  const value = cashValue(card, offer);
  const waived = firstYearFeeWaived(offer);
  const sourceLinks = offer.sources.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.name)}</a>`).join("<br>");
  return `<tr>
    <td><div class="card-name">${escapeHtml(card.name)}</div><div class="subtext">${escapeHtml(card.issuer)} · ${escapeHtml(card.program)}</div></td>
    <td><div class="offer-value">${fmtNumber(offer.bonusAmount)} ${escapeHtml(offer.bonusUnit)}</div><div class="subtext">Baseline ${fmtNumber(card.baselineOffer)} · Historical high ${fmtNumber(card.historicalHigh)}</div>${offer.expirationDate ? `<div class="expiration">Expires ${escapeHtml(offer.expirationDate)}</div>` : ""}</td>
    <td>${value ? `<div class="cash-estimate">≈ ${fmtMoney(value.value)}</div><div class="cpp-note">${value.cpp ? `${value.cpp.toFixed(2)}¢ each · ` : ""}${escapeHtml(value.label)}</div>` : `<div class="subtext">No valuation mapped</div>`}</td>
    <td><strong>${offer.spendRequirement === null ? "—" : fmtMoney(offer.spendRequirement)}</strong>${offer.spendPeriodMonths ? `<div class="subtext">in ${escapeHtml(offer.spendPeriodMonths)} month${offer.spendPeriodMonths === 1 ? "" : "s"}</div>` : ""}</td>
    <td><div class="fee-value">${fmtMoney(offer.annualFee)} / year</div>${waived ? `<span class="waiver">First year waived</span>` : `<div class="subtext">No first-year waiver reported</div>`}</td>
    <td><span class="badge ${effective}">${statusLabel(effective)}</span><div class="subtext">${escapeHtml(offer.confidence)} confidence</div><div class="note">${escapeHtml(offer.note)}</div></td>
    <td><span class="badge ${offer.channel === "public" ? "standard" : "targeted"}">${escapeHtml(statusLabel(offer.channel))}</span></td>
    <td>${escapeHtml(fmtDateTime(offer.lastVerifiedAt))}</td>
    <td>${sourceLinks}</td>
    <td><a class="button primary small" href="${escapeHtml(card.applyUrl)}" target="_blank" rel="noopener noreferrer">Issuer site</a></td>
  </tr>`;
}

function archivedHtml() {
  const archived = state.stagedDatabase.cards.filter((card) => card.isArchived);
  return `<div class="panel"><div class="panel-header"><div><h2>Archived Cards</h2><p>Archived cards stay in the database but are excluded from the dashboard and research prompts.</p></div></div>
    ${archived.length ? `<div class="card-list">${archived.map((card) => `<div class="card-list-item"><div><strong>${escapeHtml(card.name)}</strong><div class="subtext">${escapeHtml(card.issuer)} · archived ${escapeHtml(fmtDateTime(card.archivedAt))}</div></div><button class="button" data-action="restore-card" data-card-id="${escapeHtml(card.id)}">Restore</button></div>`).join("")}</div>` : `<div class="empty">No archived cards.</div>`}
  </div>`;
}

function migrationNoticeHtml() {
  if (!state.databaseMigration?.migrated) return "";
  const count = state.databaseMigration.changes.length;
  return `<div class="migration-notice"><strong>Compatibility update applied automatically.</strong> ${count} legacy field${count === 1 ? " was" : "s were"} normalized in the browser. The site is safe to use now. Save the database to GitHub once to make the normalization permanent.</div>`;
}

function adminHtml() {
  const validation = state.validation;
  const active = activeCards();
  return `<section class="admin-grid">
    <div class="full-span"><div class="panel-header"><div><h2>Admin Publisher</h2><p>Research, validate, preview, and publish changes to your GitHub repository.</p></div><button class="button purple" data-action="open-prompts">✨ Prompt Manager</button></div><div class="security-rule"><strong>Security rule:</strong> Use a fine-grained GitHub token restricted to this repository with only Contents: Read and write. CardTrack never stores the token.</div>${migrationNoticeHtml()}</div>

    <div class="panel full-span">
      <div class="panel-header"><div><h3>1. Import researched offers</h3><p>Paste the JSON returned by ChatGPT or Gemini. Nothing is applied until validation succeeds.</p></div><button class="button purple small" data-action="open-prompts">✨</button></div>
      <textarea id="import-json" placeholder='Paste the complete JSON here, beginning with { "schemaVersion": 3, ... }'>${escapeHtml(state.importText)}</textarea>
      <div class="button-row" style="margin-top:10px"><button class="button primary" data-action="validate-import">Validate JSON</button><button class="button" data-action="clear-import">Clear</button><span style="margin-left:auto" class="subtext">Import mode</span><select id="import-mode" style="width:auto"><option value="merge" ${state.importMode === "merge" ? "selected" : ""}>Merge with existing offers</option><option value="replace" ${state.importMode === "replace" ? "selected" : ""}>Replace all offers</option></select></div>
      ${validationHtml(validation)}
    </div>

    <div class="panel">
      <h3>2. Add a new card</h3><p class="subtext">The new card becomes active in the staged browser database. Publish to make it permanent.</p>
      <form id="add-card-form">
        <div class="field"><label>Card name</label><input name="name" required placeholder="Example Travel Rewards Card"></div>
        <div class="filters" style="grid-template-columns:1fr 1fr;margin-top:10px"><div class="field"><label>Issuer</label><input name="issuer" required></div><div class="field"><label>Rewards program</label><input name="program" required></div></div>
        <div class="filters" style="grid-template-columns:1fr 1fr 1fr;margin-top:10px"><div class="field"><label>Annual fee</label><input name="annualFee" type="number" min="0" value="0" required></div><div class="field"><label>Baseline offer</label><input name="baselineOffer" type="number" min="0" value="0" required></div><div class="field"><label>Historical high</label><input name="historicalHigh" type="number" min="0" value="0"></div></div>
        <div class="field" style="margin-top:10px"><label>Bonus unit</label><select name="bonusUnit"><option>points</option><option>miles</option><option>cash</option><option>free-night certificate points</option></select></div>
        <div class="field" style="margin-top:10px"><label>Official issuer URL</label><input name="applyUrl" type="url" required placeholder="https://issuer.example/card"></div>
        <button class="button primary" style="margin-top:12px" type="submit">Add Card</button>
      </form>
    </div>

    <div class="panel">
      <h3>3. Card management</h3><p class="subtext">Archive active cards to hide them from the dashboard and generated prompts.</p>
      <div class="card-list">${active.map((card) => `<div class="card-list-item"><div><strong>${escapeHtml(card.name)}</strong><div class="subtext">${escapeHtml(card.issuer)} · ${escapeHtml(card.program)} · ${fmtMoney(card.annualFee)}/yr</div></div><button class="button danger small" data-action="archive-card" data-card-id="${escapeHtml(card.id)}">Hide / Archive</button></div>`).join("")}</div>
    </div>

    <div class="panel full-span">
      <h3>4. Publish staged files to GitHub</h3><p class="subtext">Database changes save to ${DATA_PATH}. Prompt Manager changes save separately to ${PROMPTS_PATH}.</p>
      ${repositoryFields()}
      <div class="field" style="margin-top:10px"><label for="github-token">Fine-grained GitHub token</label><input id="github-token" type="password" autocomplete="off" placeholder="Paste only when testing or saving"></div>
      <div class="button-row" style="margin-top:12px"><button class="button" data-action="test-repo">Test Repository Access</button><button class="button" data-action="download-backup">Download Database Backup</button><button class="button green" data-action="save-database">Save Database to GitHub</button></div>
      <div id="github-status" class="validation-strip">The token field is cleared after every GitHub attempt.</div>
    </div>
  </section>`;
}

function repositoryFields() {
  return `<div class="filters" style="grid-template-columns:1fr 1fr 1fr 2fr">
    <div class="field"><label>Owner</label><input data-repo="owner" value="${escapeHtml(state.repository.owner)}"></div>
    <div class="field"><label>Repository</label><input data-repo="repo" value="${escapeHtml(state.repository.repo)}"></div>
    <div class="field"><label>Branch</label><input data-repo="branch" value="${escapeHtml(state.repository.branch)}"></div>
    <div class="field"><label>Database path</label><input data-repo="dataPath" value="${escapeHtml(state.repository.dataPath)}"></div>
  </div>`;
}

function validationHtml(validation) {
  if (!validation) return `<div class="validation-strip">No import has been validated.</div>`;
  const good = validation.accepted.length > 0 && validation.rejected.length === 0;
  return `<div class="validation-strip ${good ? "good" : "bad"}">${good ? "Validation passed." : `Validation found ${validation.rejected.length} rejected item(s).`} ${validation.accepted.length} offer(s) accepted.</div>
    <div class="summary-grid">
      ${summaryCard("Accepted", validation.summary.acceptedCount)}${summaryCard("Rejected", validation.summary.rejectedCount)}${summaryCard("Public", validation.summary.publicCount)}${summaryCard("Promotions", validation.summary.promotionCount)}
    </div>
    ${validation.errors.length ? `<div class="test-results"><ul>${validation.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul></div>` : ""}
    ${validation.accepted.length ? `<button class="button primary" style="margin-top:12px" data-action="apply-import">Apply Validated Import</button>` : ""}`;
}

function summaryCard(label, value) {
  return `<div class="summary-card"><span class="subtext">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function methodologyHtml() {
  const programs = Object.entries(state.valuations.programs);
  return `<section class="methodology-grid">
    <div class="panel"><h2>Offer classification</h2><p>CardTrack deterministically derives the displayed status from the saved offer, channel, and catalog baseline. Public offers above baseline display as Elevated unless marked Limited Time or Needs Review. Non-public channels display as Targeted.</p><p>Imported data is treated as untrusted. CardTrack rejects unknown card IDs, duplicate card/channel pairs, malformed dates, expired imported offers, invalid enums, invalid fee-waiver flags, and source URLs outside the approved domain list.</p></div>
    <div class="panel"><h2>TPG cash-value estimates</h2><p>${escapeHtml(state.valuations.disclaimer)}</p><p><a href="${escapeHtml(state.valuations.sourceUrl)}" target="_blank" rel="noopener noreferrer">View the TPG monthly valuations source</a>. Valuation snapshot: ${escapeHtml(state.valuations.asOf)}.</p><table class="cpp-table"><thead><tr><th>Program</th><th>CPP</th></tr></thead><tbody>${programs.map(([program, item]) => `<tr><td>${escapeHtml(program)}</td><td>${item.cpp.toFixed(2)}¢</td></tr>`).join("")}</tbody></table></div>
    <div class="panel full-span"><h2>Annual fees</h2><p>The recurring annual fee is shown explicitly for each offer. When research confirms a first-year waiver, the recurring fee remains visible and a separate <strong>First year waived</strong> badge is displayed. The research prompt now requires an explicit <code>annualFeeWaivedFirstYear</code> boolean.</p></div>
  </section>`;
}

function promptManagerHtml() {
  if (!state.promptManagerOpen) return "";
  const template = state.stagedPrompts.templates.find((item) => item.id === state.selectedTemplateId) || state.stagedPrompts.templates[0];
  const content = effectiveTemplateContent(state.stagedPrompts, template);
  const resolved = resolvePrompt(state.stagedPrompts, template, state.stagedDatabase.cards);
  const selectedCount = filterCards(state.stagedDatabase.cards, template.filter).length;
  return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="prompt-manager-title">
    <div class="modal">
      <div class="modal-header"><div><h2 id="prompt-manager-title">Prompt Manager</h2><div class="subtext">Edit templates, inject today's date and the current active catalog, validate result JSON, and save templates to GitHub.</div></div><button class="button" data-action="close-prompts" aria-label="Close">✕</button></div>
      <div class="modal-body">
        <div class="prompt-toolbar">
          <div class="field"><label>Saved template</label><select id="template-select">${state.stagedPrompts.templates.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === template.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select><div class="template-meta">${escapeHtml(template.description)} · ${selectedCount} active card${selectedCount === 1 ? "" : "s"}</div></div>
          <div class="prompt-actions"><button class="button primary" data-action="copy-prompt">📋 Copy Prompt</button><button class="button" data-action="save-template-local">Save Edit</button><button class="button" data-action="restore-template">Restore Default</button><button class="button" data-action="import-prompts">Import Prompt / Library</button><button class="button" data-action="export-current-prompt">Export Current</button><button class="button" data-action="export-prompts">Export Library</button></div>
        </div>
        <div class="prompt-layout">
          <div><div class="editor-label"><span>Editable template</span><span class="subtext">Keep {{TODAY}}, {{SCOPE_INSTRUCTION}}, and {{ACTIVE_CARD_CATALOG}}</span></div><div class="editor-wrap"><pre id="prompt-highlight" class="editor-highlight" aria-hidden="true">${highlightPrompt(content)}</pre><textarea id="prompt-editor" class="editor-input" spellcheck="false">${escapeHtml(content)}</textarea></div></div>
          <div><div class="editor-label"><span>Resolved preview</span><span class="subtext">Auto-injected now</span></div><pre id="resolved-prompt" class="resolved-preview">${escapeHtml(resolved)}</pre></div>
        </div>
        <div class="modal-footer"><div style="flex:1;min-width:280px"><div class="field"><label for="prompt-github-token">Fine-grained GitHub token (only for Save to GitHub)</label><input id="prompt-github-token" type="password" autocomplete="off" placeholder="Token is cleared after the save attempt"></div><div class="button-row" style="margin-top:8px"><button class="button purple" data-action="save-prompts-github">💾 Save Prompt Library to GitHub</button><span class="subtext">Writes only ${PROMPTS_PATH}.</span></div></div><span class="subtext">${state.promptDirty ? "Unsaved prompt changes" : "Prompt library unchanged"}</span></div>
        <div class="test-box"><h3>🧪 Test returned JSON against CardTrack schema</h3><p class="subtext">Paste an AI response here before moving it to the main publisher. This uses the same card IDs, enums, source allowlist, fee-waiver requirement, and expiration checks.</p><textarea id="prompt-test-json" placeholder="Paste returned JSON here">${escapeHtml(state.promptTestText)}</textarea><div class="button-row" style="margin-top:9px"><button class="button primary" data-action="test-json">Test JSON</button><button class="button" data-action="copy-to-publisher" ${state.promptTestResult?.accepted?.length ? "" : "disabled"}>Copy Accepted JSON to Publisher</button></div>${promptTestHtml()}</div>
      </div>
    </div>
  </div>`;
}

function highlightPrompt(content) {
  return escapeHtml(content)
    .replace(/(\{\{(?:TODAY|SCOPE_INSTRUCTION|ACTIVE_CARD_CATALOG)\}\})/g, '<span class="syntax-placeholder">$1</span>')
    .replace(/(^|\n)([A-Z][A-Z /&-]{3,})(?=\n)/g, '$1<span class="syntax-heading">$2</span>')
    .replace(/(&quot;[^&\n]*?&quot;\s*:)/g, '<span class="syntax-json">$1</span>');
}

function promptTestHtml() {
  const result = state.promptTestResult;
  if (!result) return `<div class="validation-strip">No JSON test has been run.</div>`;
  const good = result.accepted.length > 0 && result.rejected.length === 0;
  return `<div class="validation-strip ${good ? "good" : "bad"}">${good ? "JSON passes CardTrack validation." : "JSON does not fully comply."} Accepted ${result.accepted.length}; rejected ${result.rejected.length}.</div>${result.errors.length ? `<div class="test-results"><ul>${result.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul></div>` : ""}`;
}

function render() {
  if (!state.stagedDatabase) return;
  const body = state.tab === "offers" ? dashboardHtml() : state.tab === "archived" ? archivedHtml() : state.tab === "admin" ? adminHtml() : methodologyHtml();
  app.innerHTML = `<div class="app-shell">${headerHtml()}<main class="content"><div class="notice info-notice">Showing the latest validated snapshot stored in GitHub. TPG cash values are estimates and public and targeted offers remain separate.</div>${tabsHtml()}${body}</main></div>${promptManagerHtml()}`;
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => { state.tab = button.dataset.tab; render(); }));
  document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", handleAction));
  document.querySelectorAll("[data-filter]").forEach((input) => input.addEventListener(input.tagName === "INPUT" ? "input" : "change", () => { state[input.dataset.filter] = input.value; render(); }));
  document.querySelectorAll("[data-repo]").forEach((input) => input.addEventListener("input", () => { state.repository[input.dataset.repo] = input.value.trim(); }));
  document.querySelector("#import-json")?.addEventListener("input", (event) => { state.importText = event.target.value; });
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
  const tempTemplate = temporary.templates.find((item) => item.id === template.id);
  tempTemplate.customPrompt = content;
  const preview = document.querySelector("#resolved-prompt");
  if (preview) preview.textContent = resolvePrompt(temporary, tempTemplate, state.stagedDatabase.cards);
}

function saveCurrentEditorToState(notify = true) {
  const editor = document.querySelector("#prompt-editor");
  if (!editor) return;
  const content = editor.value;
  if (!content.includes("{{ACTIVE_CARD_CATALOG}}")) {
    if (notify) toast("Prompt must keep {{ACTIVE_CARD_CATALOG}} so the catalog can be injected.", "error");
    return false;
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
    } else if (action === "reload") {
      if ((state.promptDirty || JSON.stringify(state.stagedDatabase) !== JSON.stringify(state.database)) && !confirm("Reloading will discard staged browser changes. Continue?")) return;
      await initialize(); toast("Reloaded the latest GitHub Pages data.");
    } else if (action === "open-prompts") {
      state.promptManagerOpen = true; render();
    } else if (action === "close-prompts") {
      saveCurrentEditorToState(false); state.promptManagerOpen = false; render();
    } else if (action === "validate-import") {
      state.importText = document.querySelector("#import-json").value;
      state.validation = validateImportPayload(parseResearchJson(state.importText), activeCards(), {requireWaiverField: true});
      render();
    } else if (action === "clear-import") {
      state.importText = ""; state.validation = null; render();
    } else if (action === "apply-import") {
      if (!state.validation?.accepted.length) return;
      state.stagedDatabase.offers = mergeOffers(state.stagedDatabase.offers, state.validation.accepted, state.importMode);
      state.stagedDatabase.generatedAt = new Date().toISOString();
      state.stagedDatabase.dataStatus = state.importMode === "replace" ? "partial" : state.stagedDatabase.dataStatus;
      state.stagedDatabase.updatedBy = "cardtrack-admin-publisher-v4.1";
      state.importText = ""; state.validation = null; render(); toast("Validated offers applied to the staged database.");
    } else if (action === "archive-card") {
      archiveCard(event.currentTarget.dataset.cardId);
    } else if (action === "restore-card") {
      restoreCard(event.currentTarget.dataset.cardId);
    } else if (action === "download-backup") {
      downloadJson(state.stagedDatabase, `cardtrack-backup-${new Date().toISOString().slice(0,10)}.json`);
    } else if (action === "test-repo") {
      await runGithub("test");
    } else if (action === "save-database") {
      await runGithub("database");
    } else if (action === "copy-prompt") {
      if (state.promptDirty) saveCurrentEditorToState(false);
      const template = state.stagedPrompts.templates.find((item) => item.id === state.selectedTemplateId);
      await navigator.clipboard.writeText(resolvePrompt(state.stagedPrompts, template, state.stagedDatabase.cards));
      toast("Resolved prompt copied.");
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
      state.promptTestResult = validateImportPayload(parseResearchJson(state.promptTestText), filterCards(state.stagedDatabase.cards, state.stagedPrompts.templates.find((item) => item.id === state.selectedTemplateId).filter), {requireWaiverField: true});
      render();
    } else if (action === "copy-to-publisher") {
      const result = state.promptTestResult;
      if (!result?.accepted?.length) return;
      state.importText = JSON.stringify({schemaVersion: 3, generatedAt: new Date().toISOString(), dataStatus: "partial", collector: {provider: "Prompt Manager validated import", model: "user supplied"}, offers: result.accepted, errors: [], validation: {acceptedCount: result.accepted.length, rejectedCount: 0}}, null, 2);
      state.importMode = "merge"; state.validation = null; state.promptManagerOpen = false; state.tab = "admin"; render(); toast("Validated JSON copied into the Admin Publisher.");
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
    try { imported = JSON.parse(text); } catch { /* individual text prompt */ }
    if (imported && typeof imported === "object" && !Array.isArray(imported) && Array.isArray(imported.templates)) {
      const check = validatePromptLibrary(imported);
      if (!check.valid) throw new Error(check.errors.join(" "));
      state.stagedPrompts = imported;
      state.selectedTemplateId = imported.defaultTemplateId;
      toast("Prompt library imported into the staged browser copy.");
    } else {
      if (!text.includes("{{ACTIVE_CARD_CATALOG}}")) throw new Error("An individual prompt must include {{ACTIVE_CARD_CATALOG}}.");
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
  state.stagedDatabase.cards.push({
    id: candidate, name, issuer: String(data.get("issuer") || "").trim(), program: String(data.get("program") || "").trim(),
    annualFee: Number(data.get("annualFee")), baselineOffer: Number(data.get("baselineOffer")), historicalHigh: data.get("historicalHigh") === "" ? null : Number(data.get("historicalHigh")),
    bonusUnit: String(data.get("bonusUnit")), applyUrl: String(data.get("applyUrl") || "").trim(), isArchived: false, archivedAt: null, createdAt: now, updatedAt: now
  });
  render(); toast(`Added ${name} to the staged catalog.`);
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
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadText(value, filename) {
  const blob = new Blob([value], {type: "text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
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
      const result = await testRepositoryAccess({...base, path: state.repository.dataPath});
      setGithubStatus(`Repository access confirmed. Current file SHA starts ${result.sha.slice(0, 8)}.`, true);
      toast("Repository access confirmed.");
    } else if (mode === "database") {
      const check = validateDatabase(state.stagedDatabase, {rejectExpired: false});
      if (!check.valid) throw new Error(`Staged database is invalid: ${check.errors[0]}`);
      const result = await putJsonFile({...base, path: state.repository.dataPath, value: state.stagedDatabase, message: "Update CardTrack database from Admin Publisher v4.1"});
      state.database = structuredClone(state.stagedDatabase);
      state.databaseMigration = {migrated: false, changes: []};
      setGithubStatus(`Database saved. Commit: ${result.commit?.html_url || "created"}`, true);
      toast("Database saved to GitHub. GitHub Actions will redeploy the site.");
    } else if (mode === "prompts") {
      const check = validatePromptLibrary(state.stagedPrompts);
      if (!check.valid) throw new Error(`Prompt library is invalid: ${check.errors[0]}`);
      const result = await putJsonFile({...base, path: state.repository.promptsPath, value: state.stagedPrompts, message: "Update CardTrack prompt library"});
      state.prompts = structuredClone(state.stagedPrompts); state.promptDirty = false;
      toast(`Prompt library saved to GitHub${result.commit?.html_url ? "." : ""}`);
      render();
    }
  } finally {
    for (const field of document.querySelectorAll("#github-token, #prompt-github-token")) field.value = "";
  }
}

function setGithubStatus(message, success) {
  const box = document.querySelector("#github-status");
  if (!box) return;
  box.textContent = message;
  box.className = `validation-strip ${success === true ? "good" : success === false ? "bad" : ""}`;
}

initialize();
