import {
  SCHEMA_VERSION,
  ALLOWED_SOURCE_DOMAINS,
  slugify,
  isHttpsUrl,
  normalizeOfferStatus,
  validateDatabase,
  parseImportPayload,
  validateImportPayload,
  mergeOffers,
  buildDatabaseForSave
} from './lib/schema.mjs';
import { inferGitHubLocation, testRepositoryAccess, publishDatabase } from './lib/github.mjs';

const DATA_URL = './data/cardtrack.json';
const state = {
  db: null,
  activeTab: 'offers',
  filters: { search: '', issuer: '', channel: '', status: '', sort: 'promotion' },
  importPreview: null,
  dirty: false,
  confirmAction: null
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const money = value => value == null || Number.isNaN(Number(value)) ? '—' : `$${Number(value).toLocaleString()}`;
const number = value => value == null || Number.isNaN(Number(value)) ? '—' : Number(value).toLocaleString();
const dateOnly = value => {
  if (!value) return '—';
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
};
const dateTime = value => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};
const deepClone = value => JSON.parse(JSON.stringify(value));
const storageGet = key => { try { return localStorage.getItem(key); } catch { return null; } };
const storageSet = (key, value) => { try { localStorage.setItem(key, value); } catch { /* private or sandboxed context */ } };

function make(tag, options = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(options)) {
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'attrs') Object.entries(value).forEach(([name, val]) => el.setAttribute(name, val));
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else el[key] = value;
  }
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

function setResult(element, message, type = 'neutral') {
  element.textContent = message;
  element.className = `result-box ${type}`;
}

function setDirty(value = true) {
  state.dirty = value;
  $('#dirtyBanner').classList.toggle('hidden', !value);
}

function setTab(tab) {
  state.activeTab = tab;
  $$('.tab').forEach(button => button.classList.toggle('active', button.dataset.tabTarget === tab));
  $$('[data-tab-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.tabPanel === tab));
  if (tab === 'archived') renderArchived();
  if (tab === 'admin') renderAdmin();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function activeCards() {
  return state.db.cards.filter(card => !card.isArchived);
}

function archivedCards() {
  return state.db.cards.filter(card => card.isArchived);
}

function cardById(cardId) {
  return state.db.cards.find(card => card.id === cardId);
}

function normalizedOffers() {
  return state.db.offers
    .map(offer => {
      const card = cardById(offer.cardId);
      if (!card || card.isArchived) return null;
      return { card, offer: { ...offer, effectiveStatus: normalizeOfferStatus(offer, card) } };
    })
    .filter(Boolean);
}

function statusRank(status) {
  return ({ limited: 0, elevated: 1, targeted: 2, standard: 3, review: 4, expired: 5 }[status] ?? 9);
}

function filteredOffers() {
  const q = state.filters.search.trim().toLowerCase();
  const rows = normalizedOffers().filter(({ card, offer }) => {
    const matchText = !q || [card.name, card.issuer, card.program, offer.note].join(' ').toLowerCase().includes(q);
    const matchIssuer = !state.filters.issuer || card.issuer === state.filters.issuer;
    const matchChannel = !state.filters.channel || offer.channel === state.filters.channel;
    const matchStatus = !state.filters.status || offer.effectiveStatus === state.filters.status;
    return matchText && matchIssuer && matchChannel && matchStatus;
  });
  rows.sort((a, b) => {
    switch (state.filters.sort) {
      case 'bonusDesc': return Number(b.offer.bonusAmount || 0) - Number(a.offer.bonusAmount || 0);
      case 'spendAsc': return Number(a.offer.spendRequirement ?? Infinity) - Number(b.offer.spendRequirement ?? Infinity);
      case 'verifiedDesc': return new Date(b.offer.lastVerifiedAt || 0) - new Date(a.offer.lastVerifiedAt || 0);
      case 'cardName': return a.card.name.localeCompare(b.card.name);
      default: return statusRank(a.offer.effectiveStatus) - statusRank(b.offer.effectiveStatus) || a.card.name.localeCompare(b.card.name);
    }
  });
  return rows;
}

function statusPill(status) {
  const labels = { limited: 'Limited time', elevated: 'Elevated', standard: 'Standard', targeted: 'Targeted', review: 'Needs review', expired: 'Expired' };
  const classes = { limited: 'purple', elevated: 'good', standard: 'neutral', targeted: 'warning', review: 'danger', expired: 'danger' };
  return make('span', { class: `pill ${classes[status] || 'neutral'}`, text: labels[status] || status });
}

function renderOffers() {
  const rows = filteredOffers();
  const body = $('#offersRows');
  body.replaceChildren();
  $('#offersEmpty').classList.toggle('hidden', state.db.offers.length > 0);
  $('#offersTableWrap').classList.toggle('hidden', state.db.offers.length === 0);

  for (const { card, offer } of rows) {
    const tr = make('tr');

    const cardCell = make('td', {}, [
      make('div', { class: 'card-title', text: card.name }),
      make('div', { class: 'subtext', text: `${card.issuer} · ${card.program} · ${money(card.annualFee)}/yr` })
    ]);

    const amountCell = make('td', {}, [
      make('div', { class: 'offer-amount', text: `${number(offer.bonusAmount)} ${offer.bonusUnit}` }),
      make('div', { class: 'subtext', text: `Baseline ${number(card.baselineOffer)} · Historical high ${number(card.historicalHigh)}` })
    ]);
    if (offer.expirationDate) amountCell.append(make('div', { class: 'offer-expiration', text: `Expires ${dateOnly(offer.expirationDate)}` }));

    const spendText = offer.spendRequirement == null ? '—' : `${money(offer.spendRequirement)} in ${offer.spendPeriodMonths || '?'} month${Number(offer.spendPeriodMonths) === 1 ? '' : 's'}`;
    const spendCell = make('td', {}, [make('div', { text: spendText }), make('div', { class: 'subtext', text: `Annual fee ${money(offer.annualFee)}` })]);

    const statusCell = make('td', {}, [statusPill(offer.effectiveStatus)]);
    if (offer.confidence) statusCell.append(make('div', { class: 'subtext', text: `${offer.confidence} confidence` }));
    if (offer.note) statusCell.append(make('div', { class: 'subtext', text: offer.note }));

    const channelCell = make('td', {}, [make('span', { class: `pill ${offer.channel === 'public' ? 'neutral' : 'warning'}`, text: offer.channel })]);
    const verifiedCell = make('td', {}, [make('div', { text: dateTime(offer.lastVerifiedAt) })]);

    const sourceList = make('div', { class: 'source-list' });
    for (const source of offer.sources || []) {
      const a = make('a', { text: source.name || 'Source', attrs: { href: source.url, target: '_blank', rel: 'noopener noreferrer' } });
      sourceList.append(a);
    }
    const sourcesCell = make('td', {}, [sourceList]);
    const linkCell = make('td', {}, [make('a', { class: 'issuer-link', text: 'Issuer site', attrs: { href: card.applyUrl, target: '_blank', rel: 'noopener noreferrer' } })]);
    tr.append(cardCell, amountCell, spendCell, statusCell, channelCell, verifiedCell, sourcesCell, linkCell);
    body.append(tr);
  }

  if (!rows.length && state.db.offers.length) {
    body.append(make('tr', {}, [make('td', { text: 'No offers match the current filters.', attrs: { colspan: '8' } })]));
  }

  const all = normalizedOffers();
  $('#kpiCards').textContent = activeCards().length;
  $('#kpiVerified').textContent = all.filter(({ offer }) => Boolean(offer.lastVerifiedAt)).length;
  $('#kpiPromos').textContent = all.filter(({ offer }) => offer.channel === 'public' && ['elevated', 'limited'].includes(offer.effectiveStatus)).length;
  $('#kpiReview').textContent = all.filter(({ offer }) => offer.effectiveStatus === 'review').length;
  $('#archiveCountBadge').textContent = archivedCards().length;
}

function renderIssuerFilter() {
  const select = $('#issuerFilter');
  const current = select.value;
  const issuers = [...new Set(activeCards().map(card => card.issuer))].sort();
  select.replaceChildren(make('option', { value: '', text: 'All issuers' }), ...issuers.map(issuer => make('option', { value: issuer, text: issuer })));
  select.value = issuers.includes(current) ? current : '';
}

function renderArchived() {
  const cards = archivedCards().sort((a, b) => a.name.localeCompare(b.name));
  const grid = $('#archivedGrid');
  grid.replaceChildren();
  $('#archivedEmpty').classList.toggle('hidden', cards.length > 0);
  grid.classList.toggle('hidden', cards.length === 0);
  for (const card of cards) {
    const restore = make('button', { class: 'primary-button', text: 'Restore', onclick: () => restoreCard(card.id) });
    const article = make('article', { class: 'archive-card' }, [
      make('h3', { text: card.name }),
      make('p', { text: `${card.issuer} · ${card.program} · Archived ${card.archivedAt ? dateTime(card.archivedAt) : 'without date'}` }),
      restore
    ]);
    grid.append(article);
  }
  $('#archiveCountBadge').textContent = cards.length;
}

function renderManagementList() {
  const q = $('#manageCardSearch').value.trim().toLowerCase();
  const cards = activeCards().filter(card => !q || [card.name, card.issuer, card.program].join(' ').toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  const list = $('#activeCardList');
  list.replaceChildren();
  if (!cards.length) {
    list.append(make('div', { class: 'result-box neutral', text: 'No active cards match this search.' }));
    return;
  }
  for (const card of cards) {
    const archive = make('button', { class: 'secondary-button', text: 'Hide / Archive', onclick: () => askArchiveCard(card) });
    const item = make('div', { class: 'management-item' }, [
      make('div', {}, [make('strong', { text: card.name }), make('small', { text: `${card.issuer} · ${card.program} · Baseline ${number(card.baselineOffer)}` })]),
      archive
    ]);
    list.append(item);
  }
}

function renderAdmin() {
  renderManagementList();
  const inferred = inferGitHubLocation();
  if (!$('#githubOwner').value) $('#githubOwner').value = inferred.owner;
  if (!$('#githubRepo').value) $('#githubRepo').value = inferred.repo;
  if (!$('#githubBranch').value) $('#githubBranch').value = inferred.branch;
  if (!$('#githubPath').value) $('#githubPath').value = inferred.filePath;
}

function renderFreshness() {
  const pill = $('#freshnessPill');
  if (state.db.dataStatus === 'seed' || !state.db.generatedAt) {
    pill.textContent = 'Seed data · import offers';
    pill.className = 'pill warning';
    return;
  }
  const ageHours = (Date.now() - new Date(state.db.generatedAt).getTime()) / 3600000;
  pill.textContent = `${state.db.dataStatus === 'live' ? 'Live' : 'Partial'} · ${dateTime(state.db.generatedAt)}`;
  pill.className = `pill ${ageHours <= 48 ? 'good' : ageHours <= 168 ? 'warning' : 'danger'}`;
}

function renderAll() {
  renderFreshness();
  renderIssuerFilter();
  renderOffers();
  renderArchived();
  renderManagementList();
}

async function loadData() {
  $('#globalNotice').textContent = 'Loading the current GitHub snapshot...';
  try {
    const response = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const db = await response.json();
    const validation = validateDatabase(db);
    if (!validation.valid) throw new Error(`Saved database failed validation: ${validation.errors[0].path} ${validation.errors[0].message}`);
    state.db = deepClone(db);
    state.importPreview = null;
    setDirty(false);
    $('#globalNotice').textContent = db.dataStatus === 'seed'
      ? 'This is the starter catalog. Use Admin Publisher to import verified current offers and save them to GitHub.'
      : 'Showing the latest validated snapshot stored in GitHub. Public and targeted offers are kept separate.';
    $('#globalNotice').className = `notice ${db.dataStatus === 'seed' ? 'warning' : 'info'}`;
    renderAll();
  } catch (error) {
    $('#globalNotice').textContent = `Could not load CardTrack data: ${error.message}`;
    $('#globalNotice').className = 'notice warning';
  }
}

function askArchiveCard(card) {
  openConfirm(`Hide and archive ${card.name}?`, 'It will disappear from Current Offers and from the generated research prompt. You can restore it from the Archived Cards tab.', 'Hide / Archive', () => archiveCard(card.id));
}

function archiveCard(cardId) {
  const card = cardById(cardId);
  if (!card) return;
  card.isArchived = true;
  card.archivedAt = new Date().toISOString();
  card.updatedAt = new Date().toISOString();
  setDirty(true);
  renderAll();
}

function restoreCard(cardId) {
  const card = cardById(cardId);
  if (!card) return;
  card.isArchived = false;
  card.archivedAt = null;
  card.updatedAt = new Date().toISOString();
  setDirty(true);
  renderAll();
  setTab('archived');
}

function addCard(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const name = String(form.get('name') || '').trim();
  const id = slugify(name);
  const applyUrl = String(form.get('applyUrl') || '').trim();
  if (!id) return setResult($('#addCardResult'), 'Enter a valid card name.', 'bad');
  if (state.db.cards.some(card => card.id === id)) return setResult($('#addCardResult'), `The generated card ID "${id}" already exists. Use a more specific card name.`, 'bad');
  if (!isHttpsUrl(applyUrl)) return setResult($('#addCardResult'), 'The issuer URL must begin with https://', 'bad');
  const now = new Date().toISOString();
  const card = {
    id,
    name,
    issuer: String(form.get('issuer') || '').trim(),
    program: String(form.get('program') || '').trim(),
    annualFee: Number(form.get('annualFee')),
    baselineOffer: Number(form.get('baselineOffer')),
    historicalHigh: Number(form.get('historicalHigh')) || null,
    bonusUnit: String(form.get('bonusUnit') || 'points'),
    applyUrl,
    isArchived: false,
    createdAt: now,
    updatedAt: now
  };
  state.db.cards.push(card);
  setDirty(true);
  event.currentTarget.reset();
  event.currentTarget.elements.annualFee.value = '0';
  event.currentTarget.elements.baselineOffer.value = '0';
  event.currentTarget.elements.historicalHigh.value = '0';
  setResult($('#addCardResult'), `${card.name} was added to the staged catalog. Open the prompt helper again so the new card is included in future research.`, 'good');
  renderAll();
}

function validateImport() {
  try {
    const payload = parseImportPayload($('#importTextarea').value);
    const result = validateImportPayload(payload, state.db.cards);
    state.importPreview = { payload, ...result };
    if (!result.valid) {
      const first = [...result.errors, ...(result.rejected[0]?.errors || [])][0];
      setResult($('#importResult'), `Import blocked: ${first?.path || 'JSON'} — ${first?.message || 'No valid offers were found.'}`, 'bad');
      renderImportPreview();
      return;
    }
    setResult($('#importResult'), `${result.accepted.length} offer record(s) passed validation. ${result.rejected.length} record(s) were rejected. Review the preview, then apply the import to the staged database.`, result.rejected.length ? 'warning' : 'good');
    renderImportPreview();
  } catch (error) {
    state.importPreview = null;
    $('#importPreview').classList.add('hidden');
    setResult($('#importResult'), `Could not parse JSON: ${error.message}`, 'bad');
  }
}

function renderImportPreview() {
  const box = $('#importPreview');
  box.replaceChildren();
  const preview = state.importPreview;
  if (!preview) return box.classList.add('hidden');
  const counts = [
    ['Accepted', preview.accepted.length],
    ['Rejected', preview.rejected.length],
    ['Public', preview.accepted.filter(offer => offer.channel === 'public').length],
    ['Promotions', preview.accepted.filter(offer => ['elevated','limited'].includes(normalizeOfferStatus(offer, cardById(offer.cardId)))).length]
  ];
  for (const [label, value] of counts) box.append(make('article', {}, [make('span', { text: label }), make('strong', { text: String(value) })]));
  if (preview.valid) {
    const apply = make('button', { class: 'primary-button', text: 'Apply Validated Import', onclick: applyValidatedImport });
    const wrap = make('div', { class: 'span-2 button-row' }, [apply]);
    box.append(wrap);
  }
  box.classList.remove('hidden');
}

function applyValidatedImport() {
  const preview = state.importPreview;
  if (!preview?.valid) return;
  const mode = $('#importMode').value;
  state.db.offers = mergeOffers(state.db.offers, preview.accepted, mode);
  state.db.dataStatus = preview.payload.dataStatus;
  state.db.generatedAt = preview.payload.generatedAt;
  state.db.updatedBy = preview.payload.collector?.provider || 'manual-research-import';
  setDirty(true);
  setResult($('#importResult'), `${preview.accepted.length} validated offer record(s) were applied to the staged database. They are not yet saved to GitHub.`, 'good');
  renderAll();
}

function clearImport() {
  $('#importTextarea').value = '';
  state.importPreview = null;
  $('#importPreview').classList.add('hidden');
  setResult($('#importResult'), 'No import has been validated.', 'neutral');
}

function researchPrompt() {
  const cards = activeCards().map(card => ({
    cardId: card.id,
    cardName: card.name,
    issuer: card.issuer,
    program: card.program,
    baselineOffer: card.baselineOffer,
    historicalHigh: card.historicalHigh,
    annualFee: card.annualFee,
    bonusUnit: card.bonusUnit,
    issuerUrl: card.applyUrl
  }));
  return `You are an expert U.S. credit-card welcome-offer researcher and structured-data auditor.\n\nOBJECTIVE\nResearch the CURRENT U.S. welcome/sign-up offers for every active card in the CARD CATALOG below. Search the live web, verify the offer as of today's actual date, and return one JSON object ready to paste into CardTrack.\n\nIMPORTANT OUTPUT RULE\nReturn ONLY valid JSON. Do not use Markdown fences. Do not add explanations before or after the JSON.\n\nSOURCE PRIORITY\n1. Official issuer application page or official offer terms\n2. Doctor of Credit\n3. Frequent Miler\n4. One Mile at a Time\n5. The Points Guy\n6. NerdWallet\n\nAllowed source domains only:\n${ALLOWED_SOURCE_DOMAINS.join('\n')}\n\nRESEARCH RULES\n- Find the currently available PUBLIC offer for every card.\n- Keep targeted, referral, branch, and mailer offers in separate records.\n- Never present an \"as high as\" or targeted offer as a guaranteed public offer.\n- Do not invent an expiration date. Include one only when a reliable source explicitly supports it.\n- Use status \"elevated\" when a public bonus is above baselineOffer.\n- Use status \"limited\" when a public offer is explicitly time-limited; include expirationDate when known.\n- Use status \"standard\" when the public offer is at or below baselineOffer.\n- Use status \"targeted\" for non-public channels.\n- Use status \"review\" when reliable sources materially disagree or key terms remain ambiguous.\n- Do not calculate dollar value or cents-per-point value.\n- Every offer must have at least one approved HTTPS source.\n- Do not include expired offers as current.\n- If a card cannot be verified, omit its offer and add an error entry.\n\nRETURN THIS EXACT TOP-LEVEL SHAPE\n{\n  \"schemaVersion\": ${SCHEMA_VERSION},\n  \"generatedAt\": \"ISO-8601 UTC timestamp\",\n  \"dataStatus\": \"live or partial\",\n  \"collector\": {\n    \"provider\": \"ChatGPT Deep Research or Gemini Deep Research\",\n    \"model\": \"model name used\"\n  },\n  \"offers\": [],\n  \"errors\": [],\n  \"validation\": {\n    \"acceptedCount\": 0,\n    \"rejectedCount\": 0\n  }\n}\n\nOFFER OBJECT SHAPE\n{\n  \"cardId\": \"exact cardId from the catalog\",\n  \"bonusAmount\": 75000,\n  \"bonusUnit\": \"points, miles, cash, or free-night certificate points\",\n  \"channel\": \"public, targeted, referral, branch, or mailer\",\n  \"spendRequirement\": 4000,\n  \"spendPeriodMonths\": 3,\n  \"annualFee\": 95,\n  \"status\": \"standard, elevated, limited, targeted, or review\",\n  \"expirationDate\": \"YYYY-MM-DD or null\",\n  \"lastVerifiedAt\": \"ISO-8601 UTC timestamp\",\n  \"confidence\": \"high, medium, or low\",\n  \"note\": \"Concise explanation, maximum 500 characters\",\n  \"sources\": [\n    {\n      \"name\": \"Source name\",\n      \"url\": \"https://approved-domain/path\",\n      \"sourceType\": \"issuer, aggregator, or news\"\n    }\n  ]\n}\n\nVALIDATION REQUIREMENTS\n- JSON must parse.\n- Every cardId must exist in the catalog.\n- No duplicate cardId + channel combination.\n- Numeric values must be numbers without commas or currency symbols.\n- expirationDate must be YYYY-MM-DD or null.\n- generatedAt and lastVerifiedAt must be ISO-8601 UTC timestamps.\n- acceptedCount must equal the number of offer objects.\n- Use dataStatus \"live\" only if every active card has a verified public offer; otherwise use \"partial\" and explain missing cards in errors.\n\nCARD CATALOG\n${JSON.stringify(cards, null, 2)}\n\nFINAL CHECK\nIndependently re-check every public offer against the issuer site where possible. Then return only the final JSON object.`;
}

function openPrompt() {
  $('#promptText').value = researchPrompt();
  $('#copyPromptStatus').textContent = '';
  $('#promptModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  $(`#${id}`).classList.add('hidden');
  document.body.style.overflow = '';
}

async function copyPrompt() {
  const text = $('#promptText').value;
  try {
    await navigator.clipboard.writeText(text);
    $('#copyPromptStatus').textContent = 'Prompt copied.';
  } catch {
    $('#promptText').select();
    document.execCommand('copy');
    $('#copyPromptStatus').textContent = 'Prompt copied.';
  }
}

function downloadFile(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = make('a', { attrs: { href: url, download: filename } });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadActiveCatalog() {
  const catalog = { schemaVersion: SCHEMA_VERSION, generatedAt: new Date().toISOString(), cards: activeCards() };
  downloadFile('cardtrack-active-card-catalog.json', `${JSON.stringify(catalog, null, 2)}\n`);
}

function downloadBackup() {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadFile(`cardtrack-backup-${stamp}.json`, `${JSON.stringify(state.db, null, 2)}\n`);
  setResult($('#publishResult'), 'A local backup was downloaded. No GitHub change was made.', 'good');
}

function githubConfig() {
  return {
    owner: $('#githubOwner').value.trim(),
    repo: $('#githubRepo').value.trim(),
    branch: $('#githubBranch').value.trim(),
    filePath: $('#githubPath').value.trim()
  };
}

async function testAccess() {
  const button = $('#testAccessBtn');
  const tokenInput = $('#githubToken');
  button.disabled = true;
  setResult($('#publishResult'), 'Testing repository access...', 'neutral');
  try {
    const repo = await testRepositoryAccess(githubConfig(), tokenInput.value.trim());
    setResult($('#publishResult'), `Access confirmed for ${repo.full_name}. The token can see this repository. The final save will also verify file-write permission.`, 'good');
  } catch (error) {
    setResult($('#publishResult'), friendlyGitHubError(error), 'bad');
  } finally {
    tokenInput.value = '';
    button.disabled = false;
  }
}

function friendlyGitHubError(error) {
  if (error.status === 401) return 'GitHub rejected the token. It may be incorrect, expired, or revoked.';
  if (error.status === 403) return 'GitHub denied access. Confirm the fine-grained token is restricted to this repository and has Contents: Read and write.';
  if (error.status === 404) return 'Repository or file not found. Check the owner, repository name, branch, and JSON file path.';
  if (error.status === 409) return 'GitHub reported a file conflict. Reload the current GitHub data, reapply your changes, and try again.';
  if (error.status === 422) return 'GitHub rejected the update. Check the branch, file path, and commit message.';
  return `GitHub operation failed: ${error.message}`;
}

async function publish() {
  const button = $('#publishBtn');
  const tokenInput = $('#githubToken');
  const token = tokenInput.value.trim();
  const validation = validateDatabase(state.db, { allowSeed: true });
  if (!validation.valid) return setResult($('#publishResult'), `Save blocked: ${validation.errors[0].path} — ${validation.errors[0].message}`, 'bad');
  if (!token) return setResult($('#publishResult'), 'Paste your fine-grained GitHub token. It will be cleared after this attempt.', 'bad');
  if (!state.db.offers.length && state.db.dataStatus !== 'seed') return setResult($('#publishResult'), 'Save blocked because the database is marked live/partial but contains zero offers.', 'bad');

  button.disabled = true;
  setResult($('#publishResult'), 'Reading the current GitHub file and creating a new commit...', 'neutral');
  try {
    const dataStatus = state.db.offers.length ? state.db.dataStatus : 'seed';
    const database = buildDatabaseForSave(state.db, { dataStatus, updatedBy: 'cardtrack-admin-publisher' });
    const finalValidation = validateDatabase(database);
    if (!finalValidation.valid) throw new Error(`Final validation failed: ${finalValidation.errors[0].path} ${finalValidation.errors[0].message}`);
    const message = $('#commitMessage').value.trim() || `Update CardTrack ${new Date().toISOString().slice(0, 10)}`;
    const result = await publishDatabase(githubConfig(), token, database, message);
    state.db = database;
    setDirty(false);
    renderAll();
    const commitUrl = result.commit?.html_url;
    const resultBox = $('#publishResult');
    resultBox.replaceChildren(document.createTextNode('GitHub saved the database successfully. The Pages workflow should redeploy the site within a few minutes. '));
    if (commitUrl) resultBox.append(make('a', { text: 'Open the commit', attrs: { href: commitUrl, target: '_blank', rel: 'noopener noreferrer' } }));
    resultBox.className = 'result-box good';
  } catch (error) {
    setResult($('#publishResult'), friendlyGitHubError(error), 'bad');
  } finally {
    tokenInput.value = '';
    button.disabled = false;
  }
}

function openConfirm(title, text, actionText, callback) {
  $('#confirmModalTitle').textContent = title;
  $('#confirmModalText').textContent = text;
  $('#confirmActionBtn').textContent = actionText;
  state.confirmAction = callback;
  $('#confirmModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function confirmAction() {
  const callback = state.confirmAction;
  state.confirmAction = null;
  closeModal('confirmModal');
  if (callback) callback();
}

function initEvents() {
  $$('[data-tab-target]').forEach(button => button.addEventListener('click', () => setTab(button.dataset.tabTarget)));
  $$('[data-close-modal]').forEach(element => element.addEventListener('click', () => closeModal(element.dataset.closeModal)));
  $('#confirmCancelBtn').addEventListener('click', () => closeModal('confirmModal'));
  $('#confirmActionBtn').addEventListener('click', confirmAction);
  $('#openPromptBtn').addEventListener('click', openPrompt);
  $('#openPromptIconBtn').addEventListener('click', openPrompt);
  $('#copyPromptBtn').addEventListener('click', copyPrompt);
  $('#downloadCatalogBtn').addEventListener('click', downloadActiveCatalog);
  $('#validateImportBtn').addEventListener('click', validateImport);
  $('#clearImportBtn').addEventListener('click', clearImport);
  $('#addCardForm').addEventListener('submit', addCard);
  $('#manageCardSearch').addEventListener('input', renderManagementList);
  $('#testAccessBtn').addEventListener('click', testAccess);
  $('#downloadBackupBtn').addEventListener('click', downloadBackup);
  $('#publishBtn').addEventListener('click', publish);
  $('#reloadBtn').addEventListener('click', () => {
    if (state.dirty) return openConfirm('Discard unsaved changes?', 'Reloading will replace your staged browser changes with the latest GitHub file.', 'Discard and reload', loadData);
    loadData();
  });
  $('#themeBtn').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    storageSet('cardtrack-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  });
  $('#searchInput').addEventListener('input', event => { state.filters.search = event.target.value; renderOffers(); });
  $('#issuerFilter').addEventListener('change', event => { state.filters.issuer = event.target.value; renderOffers(); });
  $('#channelFilter').addEventListener('change', event => { state.filters.channel = event.target.value; renderOffers(); });
  $('#statusFilter').addEventListener('change', event => { state.filters.status = event.target.value; renderOffers(); });
  $('#sortFilter').addEventListener('change', event => { state.filters.sort = event.target.value; renderOffers(); });
  window.addEventListener('beforeunload', event => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (!$('#promptModal').classList.contains('hidden')) closeModal('promptModal');
      if (!$('#confirmModal').classList.contains('hidden')) closeModal('confirmModal');
    }
  });
}

if (storageGet('cardtrack-theme') === 'dark') document.body.classList.add('dark');
initEvents();
loadData();
