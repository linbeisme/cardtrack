export const SCHEMA_VERSION = 3;
export const ALLOWED_STATUSES = new Set(['standard','elevated','limited','targeted','review']);
export const ALLOWED_CHANNELS = new Set(['public','targeted','referral','branch','mailer']);
export const ALLOWED_CONFIDENCE = new Set(['high','medium','low']);
export const ALLOWED_SOURCE_TYPES = new Set(['issuer','aggregator','news']);
export const ALLOWED_SOURCE_DOMAINS = [
  'americanexpress.com','chase.com','capitalone.com','citi.com','bankofamerica.com',
  'barclaycardus.com','wellsfargo.com','doctorofcredit.com','frequentmiler.com',
  'onemileatatime.com','thepointsguy.com','nerdwallet.com'
];

export function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isAllowedSourceUrl(value) {
  if (!isHttpsUrl(value)) return false;
  const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  return ALLOWED_SOURCE_DOMAINS.some(domain => host === domain || host.endsWith(`.${domain}`));
}

export function isIsoTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const t = Date.parse(value);
  return Number.isFinite(t) && /T/.test(value);
}

export function isIsoDate(value) {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const t = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(t);
}

export function isExpired(expirationDate, now = new Date()) {
  if (!expirationDate || !isIsoDate(expirationDate)) return false;
  const end = new Date(`${expirationDate}T23:59:59Z`).getTime();
  return end < now.getTime();
}

export function normalizeOfferStatus(offer, card, now = new Date()) {
  if (!offer) return 'unknown';
  if (offer.expirationDate && isExpired(offer.expirationDate, now)) return 'expired';
  const channel = offer.channel || 'public';
  if (offer.status === 'review') return 'review';
  if (channel !== 'public') return 'targeted';
  if (offer.status === 'limited') return 'limited';
  const baseline = Number(card?.baselineOffer || 0);
  const bonus = Number(offer.bonusAmount || 0);
  if (baseline > 0 && bonus > baseline) return 'elevated';
  return ALLOWED_STATUSES.has(offer.status) ? offer.status : 'standard';
}

function pushError(errors, path, message) {
  errors.push({ path, message });
}

function validateCard(card, index, errors, ids) {
  const p = `cards[${index}]`;
  if (!card || typeof card !== 'object') {
    pushError(errors, p, 'Card must be an object.');
    return;
  }
  if (!card.id || !/^[a-z0-9][a-z0-9-]{1,79}$/.test(card.id)) pushError(errors, `${p}.id`, 'Card ID must be a lowercase slug.');
  if (ids.has(card.id)) pushError(errors, `${p}.id`, 'Card ID is duplicated.');
  ids.add(card.id);
  for (const field of ['name','issuer','program']) {
    if (typeof card[field] !== 'string' || !card[field].trim()) pushError(errors, `${p}.${field}`, `${field} is required.`);
  }
  if (!Number.isFinite(Number(card.annualFee)) || Number(card.annualFee) < 0) pushError(errors, `${p}.annualFee`, 'Annual fee must be a non-negative number.');
  if (!Number.isFinite(Number(card.baselineOffer)) || Number(card.baselineOffer) < 0) pushError(errors, `${p}.baselineOffer`, 'Baseline offer must be a non-negative number.');
  if (card.historicalHigh != null && (!Number.isFinite(Number(card.historicalHigh)) || Number(card.historicalHigh) < 0)) pushError(errors, `${p}.historicalHigh`, 'Historical high must be a non-negative number or null.');
  if (!isHttpsUrl(card.applyUrl)) pushError(errors, `${p}.applyUrl`, 'Issuer URL must be a valid HTTPS URL.');
  if (typeof card.isArchived !== 'boolean') pushError(errors, `${p}.isArchived`, 'isArchived must be true or false.');
}

function validateSource(source, path, errors) {
  if (!source || typeof source !== 'object') {
    pushError(errors, path, 'Source must be an object.');
    return;
  }
  if (typeof source.name !== 'string' || !source.name.trim()) pushError(errors, `${path}.name`, 'Source name is required.');
  if (!isAllowedSourceUrl(source.url)) pushError(errors, `${path}.url`, 'Source URL must use HTTPS and an approved domain.');
  if (!ALLOWED_SOURCE_TYPES.has(source.sourceType)) pushError(errors, `${path}.sourceType`, 'Invalid source type.');
}

function validateOffer(offer, index, errors, cardIds, keys, now = new Date()) {
  const p = `offers[${index}]`;
  if (!offer || typeof offer !== 'object') {
    pushError(errors, p, 'Offer must be an object.');
    return;
  }
  if (!cardIds.has(offer.cardId)) pushError(errors, `${p}.cardId`, 'Card ID does not exist in the catalog.');
  if (!ALLOWED_CHANNELS.has(offer.channel)) pushError(errors, `${p}.channel`, 'Invalid offer channel.');
  const key = `${offer.cardId}|${offer.channel}`;
  if (keys.has(key)) pushError(errors, p, 'Duplicate card/channel offer.');
  keys.add(key);
  if (!Number.isFinite(Number(offer.bonusAmount)) || Number(offer.bonusAmount) < 0) pushError(errors, `${p}.bonusAmount`, 'Bonus amount must be a non-negative number.');
  if (typeof offer.bonusUnit !== 'string' || !offer.bonusUnit.trim()) pushError(errors, `${p}.bonusUnit`, 'Bonus unit is required.');
  if (offer.spendRequirement != null && (!Number.isFinite(Number(offer.spendRequirement)) || Number(offer.spendRequirement) < 0)) pushError(errors, `${p}.spendRequirement`, 'Spend requirement must be a non-negative number or null.');
  if (offer.spendPeriodMonths != null && (!Number.isFinite(Number(offer.spendPeriodMonths)) || Number(offer.spendPeriodMonths) <= 0)) pushError(errors, `${p}.spendPeriodMonths`, 'Spend period must be a positive number or null.');
  if (!Number.isFinite(Number(offer.annualFee)) || Number(offer.annualFee) < 0) pushError(errors, `${p}.annualFee`, 'Annual fee must be a non-negative number.');
  if (!ALLOWED_STATUSES.has(offer.status)) pushError(errors, `${p}.status`, 'Invalid promotion status.');
  if (!isIsoDate(offer.expirationDate)) pushError(errors, `${p}.expirationDate`, 'Expiration must be YYYY-MM-DD or null.');
  if (offer.expirationDate && isExpired(offer.expirationDate, now)) pushError(errors, `${p}.expirationDate`, 'Expired offers cannot be imported as current offers.');
  if (!isIsoTimestamp(offer.lastVerifiedAt)) pushError(errors, `${p}.lastVerifiedAt`, 'lastVerifiedAt must be an ISO timestamp.');
  if (!ALLOWED_CONFIDENCE.has(offer.confidence)) pushError(errors, `${p}.confidence`, 'Invalid confidence value.');
  if (typeof offer.note !== 'string' || offer.note.length > 500) pushError(errors, `${p}.note`, 'Note is required and must be 500 characters or fewer.');
  if (!Array.isArray(offer.sources) || !offer.sources.length) pushError(errors, `${p}.sources`, 'At least one approved source is required.');
  else offer.sources.forEach((source, sourceIndex) => validateSource(source, `${p}.sources[${sourceIndex}]`, errors));
}

export function validateDatabase(db, options = {}) {
  const { allowSeed = true, now = new Date() } = options;
  const errors = [];
  if (!db || typeof db !== 'object') return { valid: false, errors: [{ path: '', message: 'Database must be an object.' }] };
  if (db.schemaVersion !== SCHEMA_VERSION) pushError(errors, 'schemaVersion', `schemaVersion must equal ${SCHEMA_VERSION}.`);
  if (!['seed','live','partial'].includes(db.dataStatus)) pushError(errors, 'dataStatus', 'dataStatus must be seed, live, or partial.');
  if (db.dataStatus !== 'seed' && !isIsoTimestamp(db.generatedAt)) pushError(errors, 'generatedAt', 'generatedAt must be an ISO timestamp for live/partial data.');
  if (!allowSeed && db.dataStatus === 'seed') pushError(errors, 'dataStatus', 'Seed data is not allowed here.');
  if (!Array.isArray(db.cards)) pushError(errors, 'cards', 'cards must be an array.');
  if (!Array.isArray(db.offers)) pushError(errors, 'offers', 'offers must be an array.');
  const ids = new Set();
  if (Array.isArray(db.cards)) db.cards.forEach((card, index) => validateCard(card, index, errors, ids));
  const keys = new Set();
  if (Array.isArray(db.offers)) db.offers.forEach((offer, index) => validateOffer(offer, index, errors, ids, keys, now));
  return { valid: errors.length === 0, errors };
}

export function parseImportPayload(text) {
  const trimmed = String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  if (!trimmed) throw new Error('Paste a JSON result first.');
  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed)) return { schemaVersion: SCHEMA_VERSION, dataStatus: 'partial', generatedAt: new Date().toISOString(), offers: parsed, errors: [] };
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.offers)) throw new Error('The JSON must be an offer array or an object containing an offers array.');
  return parsed;
}

export function validateImportPayload(payload, cards, options = {}) {
  const now = options.now || new Date();
  const cardIds = new Set(cards.map(card => card.id));
  const errors = [];
  const keys = new Set();
  const accepted = [];
  const rejected = [];

  (payload.offers || []).forEach((offer, index) => {
    const localErrors = [];
    validateOffer(offer, index, localErrors, cardIds, keys, now);
    if (localErrors.length) rejected.push({ index, cardId: offer?.cardId || null, errors: localErrors });
    else accepted.push({ ...offer });
  });

  if (payload.schemaVersion !== SCHEMA_VERSION) errors.push({ path: 'schemaVersion', message: `Import schemaVersion must equal ${SCHEMA_VERSION}.` });
  if (!accepted.length) errors.push({ path: 'offers', message: 'No valid offers were found. The existing database will not be replaced.' });
  if (!['live','partial'].includes(payload.dataStatus)) errors.push({ path: 'dataStatus', message: 'Import dataStatus must be live or partial.' });
  if (!isIsoTimestamp(payload.generatedAt)) errors.push({ path: 'generatedAt', message: 'Import generatedAt must be an ISO timestamp.' });
  if (payload.validation && Number.isFinite(Number(payload.validation.acceptedCount)) && Number(payload.validation.acceptedCount) !== (payload.offers || []).length) {
    errors.push({ path: 'validation.acceptedCount', message: 'acceptedCount must equal the number of offer objects returned.' });
  }
  if (payload.dataStatus === 'live') {
    const activeIds = cards.filter(card => !card.isArchived).map(card => card.id);
    const publicIds = new Set(accepted.filter(offer => offer.channel === 'public').map(offer => offer.cardId));
    const missing = activeIds.filter(id => !publicIds.has(id));
    if (missing.length) errors.push({ path: 'dataStatus', message: `dataStatus cannot be live because ${missing.length} active card(s) lack a public offer.` });
  }

  return { valid: errors.length === 0 && accepted.length > 0, errors, accepted, rejected };
}

export function mergeOffers(existingOffers, acceptedOffers, mode = 'merge') {
  if (mode === 'replace') return acceptedOffers.map(offer => ({ ...offer }));
  const map = new Map(existingOffers.map(offer => [`${offer.cardId}|${offer.channel}`, { ...offer }]));
  for (const offer of acceptedOffers) map.set(`${offer.cardId}|${offer.channel}`, { ...offer });
  return [...map.values()];
}

export function buildDatabaseForSave(db, meta = {}) {
  return {
    ...db,
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    dataStatus: db.offers.length ? (meta.dataStatus || db.dataStatus || 'partial') : 'seed',
    updatedBy: meta.updatedBy || 'cardtrack-admin',
    cards: db.cards.map(card => ({ ...card })),
    offers: db.offers.map(offer => ({ ...offer }))
  };
}
