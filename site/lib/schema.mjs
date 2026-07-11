export const SCHEMA_VERSION = 3;
export const BONUS_UNITS = new Set(["points", "miles", "cash", "free-night certificate points"]);
export const CHANNELS = new Set(["public", "targeted", "referral", "branch", "mailer"]);
export const STATUSES = new Set(["standard", "elevated", "limited", "targeted", "review"]);
export const CONFIDENCE = new Set(["high", "medium", "low"]);
export const SOURCE_TYPES = new Set(["issuer", "aggregator", "news"]);
export const DATA_STATUSES = new Set(["seed", "live", "partial"]);
export const ALLOWED_SOURCE_DOMAINS = [
  "americanexpress.com", "chase.com", "capitalone.com", "citi.com",
  "bankofamerica.com", "barclaycardus.com", "wellsfargo.com",
  "doctorofcredit.com", "frequentmiler.com", "onemileatatime.com",
  "thepointsguy.com", "nerdwallet.com"
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNonNegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPositiveOrNull(value) {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value > 0);
}

function isNonNegativeOrNull(value) {
  return value === null || isFiniteNonNegative(value);
}

function isIsoUtc(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isDateOnlyOrNull(value) {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function approvedHttpsUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return ALLOWED_SOURCE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export function stripJsonFences(text) {
  if (typeof text !== "string") return "";
  return text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

export function parseResearchJson(text) {
  const cleaned = stripJsonFences(text);
  if (!cleaned) throw new Error("No JSON was provided.");
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    throw new Error(`JSON could not be parsed: ${error.message}`);
  }
}

export function effectiveStatus(offer, card) {
  if (offer.status === "review") return "review";
  if (offer.channel !== "public") return "targeted";
  if (offer.status === "limited") return "limited";
  return offer.bonusAmount > Number(card?.baselineOffer || 0) ? "elevated" : "standard";
}

export function validateCard(card, index = 0) {
  const errors = [];
  const p = `cards[${index}]`;
  if (!isPlainObject(card)) return [`${p} must be an object.`];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(card.id || "")) errors.push(`${p}.id must be a lowercase slug.`);
  for (const field of ["name", "issuer", "program", "bonusUnit", "applyUrl"]) {
    if (typeof card[field] !== "string" || !card[field].trim()) errors.push(`${p}.${field} is required.`);
  }
  for (const field of ["annualFee", "baselineOffer"]) {
    if (!isFiniteNonNegative(card[field])) errors.push(`${p}.${field} must be a non-negative number.`);
  }
  if (card.historicalHigh !== null && !isFiniteNonNegative(card.historicalHigh)) errors.push(`${p}.historicalHigh must be null or a non-negative number.`);
  if (!BONUS_UNITS.has(card.bonusUnit)) errors.push(`${p}.bonusUnit is not allowed.`);
  try {
    const url = new URL(card.applyUrl);
    if (url.protocol !== "https:") errors.push(`${p}.applyUrl must use HTTPS.`);
  } catch {
    errors.push(`${p}.applyUrl must be a valid URL.`);
  }
  if (typeof card.isArchived !== "boolean") errors.push(`${p}.isArchived must be boolean.`);
  if (card.archivedAt !== null && !isIsoUtc(card.archivedAt)) errors.push(`${p}.archivedAt must be an ISO UTC timestamp or null.`);
  return errors;
}

export function validateOffer(offer, cardsById, index = 0, options = {}) {
  const errors = [];
  const p = `offers[${index}]`;
  if (!isPlainObject(offer)) return [`${p} must be an object.`];
  const card = cardsById.get(offer.cardId);
  if (!card) errors.push(`${p}.cardId '${offer.cardId ?? ""}' is not in the active catalog.`);
  if (!isFiniteNonNegative(offer.bonusAmount)) errors.push(`${p}.bonusAmount must be a non-negative number.`);
  if (!BONUS_UNITS.has(offer.bonusUnit)) errors.push(`${p}.bonusUnit is not allowed.`);
  if (!CHANNELS.has(offer.channel)) errors.push(`${p}.channel is not allowed.`);
  if (!isNonNegativeOrNull(offer.spendRequirement)) errors.push(`${p}.spendRequirement must be a non-negative number or null.`);
  if (!isPositiveOrNull(offer.spendPeriodMonths)) errors.push(`${p}.spendPeriodMonths must be a positive number or null.`);
  if (!isFiniteNonNegative(offer.annualFee)) errors.push(`${p}.annualFee must be a non-negative number.`);
  if (offer.annualFeeWaivedFirstYear !== undefined && typeof offer.annualFeeWaivedFirstYear !== "boolean") {
    errors.push(`${p}.annualFeeWaivedFirstYear must be boolean when provided.`);
  }
  if (options.requireWaiverField && typeof offer.annualFeeWaivedFirstYear !== "boolean") {
    errors.push(`${p}.annualFeeWaivedFirstYear is required and must be boolean.`);
  }
  if (!STATUSES.has(offer.status)) errors.push(`${p}.status is not allowed.`);
  if (!isDateOnlyOrNull(offer.expirationDate)) errors.push(`${p}.expirationDate must be YYYY-MM-DD or null.`);
  if (!isIsoUtc(offer.lastVerifiedAt)) errors.push(`${p}.lastVerifiedAt must be an ISO-8601 UTC timestamp.`);
  if (!CONFIDENCE.has(offer.confidence)) errors.push(`${p}.confidence is not allowed.`);
  if (typeof offer.note !== "string" || !offer.note.trim() || offer.note.length > 500) errors.push(`${p}.note is required and must be 500 characters or fewer.`);
  if (!Array.isArray(offer.sources) || offer.sources.length === 0) {
    errors.push(`${p}.sources must contain at least one source.`);
  } else {
    offer.sources.forEach((source, sourceIndex) => {
      const sp = `${p}.sources[${sourceIndex}]`;
      if (!isPlainObject(source)) return errors.push(`${sp} must be an object.`);
      if (typeof source.name !== "string" || !source.name.trim()) errors.push(`${sp}.name is required.`);
      if (!approvedHttpsUrl(source.url)) errors.push(`${sp}.url must be HTTPS on an approved domain.`);
      if (!SOURCE_TYPES.has(source.sourceType)) errors.push(`${sp}.sourceType is not allowed.`);
    });
  }
  if (offer.expirationDate && options.rejectExpired !== false) {
    const today = options.today || new Date().toISOString().slice(0, 10);
    if (offer.expirationDate < today) errors.push(`${p} is expired (${offer.expirationDate}).`);
  }
  if (offer.channel !== "public" && !["targeted", "review"].includes(offer.status)) {
    errors.push(`${p}.status must be targeted or review for a non-public channel.`);
  }
  return errors;
}

export function validateDatabase(database, options = {}) {
  const errors = [];
  if (!isPlainObject(database)) return {valid: false, errors: ["Database must be an object."]};
  if (database.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion must equal ${SCHEMA_VERSION}.`);
  if (database.generatedAt !== null && !isIsoUtc(database.generatedAt)) errors.push("generatedAt must be an ISO-8601 UTC timestamp or null.");
  if (!DATA_STATUSES.has(database.dataStatus)) errors.push("dataStatus must be seed, live, or partial.");
  if (!Array.isArray(database.cards)) errors.push("cards must be an array.");
  if (!Array.isArray(database.offers)) errors.push("offers must be an array.");
  if (errors.length) return {valid: false, errors};

  const ids = new Set();
  database.cards.forEach((card, index) => {
    errors.push(...validateCard(card, index));
    if (ids.has(card.id)) errors.push(`Duplicate card id '${card.id}'.`);
    ids.add(card.id);
  });
  const cardsById = new Map(database.cards.map((card) => [card.id, card]));
  const keys = new Set();
  database.offers.forEach((offer, index) => {
    errors.push(...validateOffer(offer, cardsById, index, {rejectExpired: options.rejectExpired ?? false}));
    const key = `${offer.cardId}::${offer.channel}`;
    if (keys.has(key)) errors.push(`Duplicate offer key '${key}'.`);
    keys.add(key);
  });
  return {valid: errors.length === 0, errors};
}

export function validateImportPayload(payload, cards, options = {}) {
  const top = Array.isArray(payload) ? {offers: payload} : payload;
  if (!isPlainObject(top) || !Array.isArray(top.offers)) {
    return {valid: false, accepted: [], rejected: [{index: -1, errors: ["Input must be an offer array or an object containing an offers array."]}], errors: ["Input must contain an offers array."], summary: {acceptedCount: 0, rejectedCount: 1, publicCount: 0, promotionCount: 0}};
  }
  if (!Array.isArray(payload) && top.schemaVersion !== undefined && top.schemaVersion !== SCHEMA_VERSION) {
    return {valid: false, accepted: [], rejected: [{index: -1, errors: [`schemaVersion must equal ${SCHEMA_VERSION}.`]}], errors: [`schemaVersion must equal ${SCHEMA_VERSION}.`], summary: {acceptedCount: 0, rejectedCount: top.offers.length, publicCount: 0, promotionCount: 0}};
  }
  const activeCards = cards.filter((card) => !card.isArchived);
  const cardsById = new Map(activeCards.map((card) => [card.id, card]));
  const seen = new Set();
  const accepted = [];
  const rejected = [];
  top.offers.forEach((offer, index) => {
    const itemErrors = validateOffer(offer, cardsById, index, {rejectExpired: true, requireWaiverField: options.requireWaiverField ?? true});
    const key = `${offer?.cardId}::${offer?.channel}`;
    if (seen.has(key)) itemErrors.push(`Duplicate cardId + channel '${key}'.`);
    seen.add(key);
    if (itemErrors.length) rejected.push({index, offer, errors: itemErrors});
    else accepted.push({...offer, status: effectiveStatus(offer, cardsById.get(offer.cardId))});
  });

  if (!Array.isArray(payload) && top.validation) {
    if (top.validation.acceptedCount !== top.offers.length) {
      rejected.push({index: -1, errors: [`validation.acceptedCount (${top.validation.acceptedCount}) must equal offers.length (${top.offers.length}).`]});
    }
    if (Array.isArray(top.errors) && top.validation.rejectedCount !== top.errors.length) {
      rejected.push({index: -1, errors: [`validation.rejectedCount (${top.validation.rejectedCount}) must equal errors.length (${top.errors.length}).`]});
    }
  }

  if (!Array.isArray(payload) && top.dataStatus === "live") {
    const publicIds = new Set(accepted.filter((offer) => offer.channel === "public").map((offer) => offer.cardId));
    const missing = activeCards.filter((card) => !publicIds.has(card.id));
    if (missing.length) rejected.push({index: -1, errors: [`dataStatus is live but public offers are missing for: ${missing.map((card) => card.id).join(", ")}.`]});
  }

  const publicCount = accepted.filter((offer) => offer.channel === "public").length;
  const promotionCount = accepted.filter((offer) => ["elevated", "limited"].includes(offer.status)).length;
  const errors = rejected.flatMap((item) => item.errors);
  return {
    valid: accepted.length > 0 && rejected.length === 0,
    accepted,
    rejected,
    errors,
    summary: {acceptedCount: accepted.length, rejectedCount: rejected.length, publicCount, promotionCount}
  };
}

export function mergeOffers(existing, incoming, mode = "merge") {
  if (mode === "replace") return [...incoming];
  const map = new Map(existing.map((offer) => [`${offer.cardId}::${offer.channel}`, offer]));
  incoming.forEach((offer) => map.set(`${offer.cardId}::${offer.channel}`, offer));
  return [...map.values()];
}

export function firstYearFeeWaived(offer) {
  if (typeof offer?.annualFeeWaivedFirstYear === "boolean") return offer.annualFeeWaivedFirstYear;
  return /(?:annual fee|fee).{0,40}(?:waived|$0).{0,20}(?:first year|year one)|(?:first year|year one).{0,40}(?:annual fee|fee).{0,20}(?:waived|$0)/i.test(offer?.note || "");
}
