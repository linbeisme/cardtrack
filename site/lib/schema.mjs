export const APP_VERSION = "5.0.1";
export const SCHEMA_VERSION = 5;
export const LEGACY_OFFER_SCHEMA_VERSION = 3;
export const DATABASE_COMPATIBILITY_VERSION = 2;

export const BONUS_UNITS = new Set(["points", "miles", "cash", "free-night certificate points"]);
export const CHANNELS = new Set(["public", "targeted", "referral", "branch", "mailer"]);
export const STATUSES = new Set(["standard", "elevated", "limited", "targeted", "review"]);
export const CONFIDENCE = new Set(["high", "medium", "low"]);
export const SOURCE_TYPES = new Set(["issuer", "aggregator", "news", "loyalty-program"]);
export const DATA_STATUSES = new Set(["seed", "live", "partial"]);
export const IMPORT_TYPES = new Set(["offers", "cardDetails", "transferPrograms", "transferBonuses", "valuations", "complete"]);

export const OFFER_SOURCE_DOMAINS = [
  "americanexpress.com", "chase.com", "capitalone.com", "citi.com",
  "bankofamerica.com", "barclaycardus.com", "wellsfargo.com",
  "doctorofcredit.com", "frequentmiler.com", "onemileatatime.com",
  "thepointsguy.com", "nerdwallet.com"
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNonNegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function finitePositive(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function positiveOrNull(value) {
  return value === null || finitePositive(value);
}

function nonNegativeOrNull(value) {
  return value === null || finiteNonNegative(value);
}

export function isIsoUtc(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function isDateOnlyOrNull(value) {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isHttps(value) {
  try { return new URL(value).protocol === "https:"; }
  catch { return false; }
}

function approvedOfferUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return OFFER_SOURCE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function stripJsonFences(text) {
  if (typeof text !== "string") return "";
  return text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

export function parseResearchJson(text) {
  const cleaned = stripJsonFences(text);
  if (!cleaned) throw new Error("No JSON was provided.");
  try { return JSON.parse(cleaned); }
  catch (error) { throw new Error(`JSON could not be parsed: ${error.message}`); }
}

export function effectiveStatus(offer, card) {
  if (offer?.status === "review") return "review";
  if (offer?.channel !== "public") return "targeted";
  if (offer?.status === "limited") return "limited";
  return Number(offer?.bonusAmount || 0) > Number(card?.baselineOffer || 0) ? "elevated" : "standard";
}

export function firstYearFeeWaived(offer) {
  if (typeof offer?.annualFeeWaivedFirstYear === "boolean") return offer.annualFeeWaivedFirstYear;
  return /(?:annual fee|fee).{0,40}(?:waived|\$0).{0,20}(?:first year|year one)|(?:first year|year one).{0,40}(?:annual fee|fee).{0,20}(?:waived|\$0)/i.test(offer?.note || "");
}

export function estimateFirstYearValue(card, offer, details, valuation) {
  const bonusValue = offer?.bonusUnit === "cash"
    ? Number(offer?.bonusAmount || 0)
    : Number(offer?.bonusAmount || 0) * Number(valuation?.cpp || 0) / 100;
  const creditValue = (details?.credits || []).reduce((sum, credit) => {
    const face = Number(credit.faceValueAnnual ?? credit.amount ?? 0);
    const utilization = Number.isFinite(credit.estimatedUtilization) ? credit.estimatedUtilization : 1;
    return sum + face * Math.max(0, Math.min(1, utilization));
  }, 0);
  const perkValue = (details?.perks || []).reduce((sum, perk) => sum + Number(perk.estimatedAnnualValue || 0), 0);
  const firstYearFee = firstYearFeeWaived(offer) ? 0 : Number(offer?.annualFee ?? card?.annualFee ?? 0);
  return {bonusValue, creditValue, perkValue, annualFee: firstYearFee, total: bonusValue + creditValue + perkValue - firstYearFee};
}

export function valueTier(value) {
  if (value >= 1500) return "Platinum";
  if (value >= 1000) return "Gold";
  if (value >= 600) return "Silver";
  return "Bronze";
}

export function validateCard(card, index = 0) {
  const errors = [];
  const p = `cards[${index}]`;
  if (!isPlainObject(card)) return [`${p} must be an object.`];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(card.id || "")) errors.push(`${p}.id must be a lowercase slug.`);
  for (const field of ["name", "issuer", "program", "bonusUnit", "applyUrl"]) {
    if (typeof card[field] !== "string" || !card[field].trim()) errors.push(`${p}.${field} is required.`);
  }
  for (const field of ["annualFee", "baselineOffer"]) if (!finiteNonNegative(card[field])) errors.push(`${p}.${field} must be a non-negative number.`);
  if (card.historicalHigh !== null && card.historicalHigh !== undefined && !finiteNonNegative(card.historicalHigh)) errors.push(`${p}.historicalHigh must be null or non-negative.`);
  if (!BONUS_UNITS.has(card.bonusUnit)) errors.push(`${p}.bonusUnit is not allowed.`);
  if (!isHttps(card.applyUrl)) errors.push(`${p}.applyUrl must be a valid HTTPS URL.`);
  if (card.isArchived !== undefined && typeof card.isArchived !== "boolean") errors.push(`${p}.isArchived must be boolean when provided.`);
  if (card.archivedAt !== undefined && card.archivedAt !== null && !isIsoUtc(card.archivedAt)) errors.push(`${p}.archivedAt must be ISO UTC, null, or omitted.`);
  return errors;
}

function validateSource(source, path, {strictOfferDomain = false} = {}) {
  const errors = [];
  if (!isPlainObject(source)) return [`${path} must be an object.`];
  if (typeof source.name !== "string" || !source.name.trim()) errors.push(`${path}.name is required.`);
  if (!(strictOfferDomain ? approvedOfferUrl(source.url) : isHttps(source.url))) errors.push(`${path}.url must be an approved HTTPS URL.`);
  if (!SOURCE_TYPES.has(source.sourceType)) errors.push(`${path}.sourceType is not allowed.`);
  return errors;
}

export function validateOffer(offer, cardsById, index = 0, options = {}) {
  const errors = [];
  const p = `offers[${index}]`;
  if (!isPlainObject(offer)) return [`${p} must be an object.`];
  const card = cardsById.get(offer.cardId);
  if (!card) errors.push(`${p}.cardId '${offer.cardId ?? ""}' is not in the active catalog.`);
  if (!finiteNonNegative(offer.bonusAmount)) errors.push(`${p}.bonusAmount must be non-negative.`);
  if (!BONUS_UNITS.has(offer.bonusUnit)) errors.push(`${p}.bonusUnit is not allowed.`);
  if (!CHANNELS.has(offer.channel)) errors.push(`${p}.channel is not allowed.`);
  if (!nonNegativeOrNull(offer.spendRequirement)) errors.push(`${p}.spendRequirement must be non-negative or null.`);
  if (!positiveOrNull(offer.spendPeriodMonths)) errors.push(`${p}.spendPeriodMonths must be positive or null.`);
  if (!finiteNonNegative(offer.annualFee)) errors.push(`${p}.annualFee must be non-negative.`);
  if (offer.annualFeeWaivedFirstYear !== undefined && typeof offer.annualFeeWaivedFirstYear !== "boolean") errors.push(`${p}.annualFeeWaivedFirstYear must be boolean.`);
  if (options.requireWaiverField && typeof offer.annualFeeWaivedFirstYear !== "boolean") errors.push(`${p}.annualFeeWaivedFirstYear is required.`);
  if (!STATUSES.has(offer.status)) errors.push(`${p}.status is not allowed.`);
  if (!isDateOnlyOrNull(offer.expirationDate)) errors.push(`${p}.expirationDate must be YYYY-MM-DD or null.`);
  if (!isIsoUtc(offer.lastVerifiedAt)) errors.push(`${p}.lastVerifiedAt must be ISO UTC.`);
  if (!CONFIDENCE.has(offer.confidence)) errors.push(`${p}.confidence is not allowed.`);
  if (typeof offer.note !== "string" || !offer.note.trim() || offer.note.length > 500) errors.push(`${p}.note is required and must be at most 500 characters.`);
  if (!Array.isArray(offer.sources) || offer.sources.length === 0) errors.push(`${p}.sources must contain at least one source.`);
  else offer.sources.forEach((source, sourceIndex) => errors.push(...validateSource(source, `${p}.sources[${sourceIndex}]`, {strictOfferDomain: true})));
  if (offer.expirationDate && options.rejectExpired !== false) {
    const today = options.today || new Date().toISOString().slice(0, 10);
    if (offer.expirationDate < today) errors.push(`${p} is expired (${offer.expirationDate}).`);
  }
  if (offer.channel !== "public" && !["targeted", "review"].includes(offer.status)) errors.push(`${p}.status must be targeted or review for a non-public channel.`);
  return errors;
}

export function validateCardDetail(item, cardsById, index = 0) {
  const errors = [];
  const p = `cardDetails[${index}]`;
  if (!isPlainObject(item)) return [`${p} must be an object.`];
  if (!cardsById.has(item.cardId)) errors.push(`${p}.cardId '${item.cardId ?? ""}' is not in the catalog.`);
  if (!isIsoUtc(item.lastVerifiedAt)) errors.push(`${p}.lastVerifiedAt must be ISO UTC.`);
  if (!nonNegativeOrNull(item.foreignTransactionFee)) errors.push(`${p}.foreignTransactionFee must be non-negative or null.`);
  for (const field of ["earnRates", "credits", "perks", "protections", "loungeAccess", "statusBenefits", "airlineBenefits", "hotelBenefits", "sources"]) {
    if (!Array.isArray(item[field])) errors.push(`${p}.${field} must be an array.`);
  }
  (item.credits || []).forEach((credit, i) => {
    const cp = `${p}.credits[${i}]`;
    if (!isPlainObject(credit) || typeof credit.name !== "string" || !credit.name.trim()) errors.push(`${cp}.name is required.`);
    if (!nonNegativeOrNull(credit.faceValueAnnual)) errors.push(`${cp}.faceValueAnnual must be non-negative or null.`);
    if (credit.estimatedUtilization !== undefined && (typeof credit.estimatedUtilization !== "number" || credit.estimatedUtilization < 0 || credit.estimatedUtilization > 1)) errors.push(`${cp}.estimatedUtilization must be 0 through 1.`);
  });
  (item.sources || []).forEach((source, i) => errors.push(...validateSource(source, `${p}.sources[${i}]`)));
  return errors;
}

export function validateTransferProgram(item, cardsById, index = 0) {
  const errors = [];
  const p = `transferPrograms[${index}]`;
  if (!isPlainObject(item)) return [`${p} must be an object.`];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.programId || "")) errors.push(`${p}.programId must be a lowercase slug.`);
  if (typeof item.programName !== "string" || !item.programName.trim()) errors.push(`${p}.programName is required.`);
  if (!Array.isArray(item.cards)) errors.push(`${p}.cards must be an array.`);
  else item.cards.forEach((cardId) => { if (!cardsById.has(cardId)) errors.push(`${p}.cards contains unknown cardId '${cardId}'.`); });
  if (!Array.isArray(item.partners)) errors.push(`${p}.partners must be an array.`);
  else item.partners.forEach((partner, i) => {
    const pp = `${p}.partners[${i}]`;
    if (!isPlainObject(partner)) return errors.push(`${pp} must be an object.`);
    for (const field of ["partnerId", "partnerName", "partnerType", "ratioDisplay"]) if (typeof partner[field] !== "string" || !partner[field].trim()) errors.push(`${pp}.${field} is required.`);
    if (!isIsoUtc(partner.lastVerifiedAt)) errors.push(`${pp}.lastVerifiedAt must be ISO UTC.`);
    if (!Array.isArray(partner.sources) || !partner.sources.length) errors.push(`${pp}.sources must contain at least one source.`);
    else partner.sources.forEach((source, sourceIndex) => errors.push(...validateSource(source, `${pp}.sources[${sourceIndex}]`)));
  });
  return errors;
}

export function validateTransferBonus(item, programIds, index = 0, options = {}) {
  const errors = [];
  const p = `transferBonuses[${index}]`;
  if (!isPlainObject(item)) return [`${p} must be an object.`];
  if (typeof item.transferBonusId !== "string" || !item.transferBonusId.trim()) errors.push(`${p}.transferBonusId is required.`);
  if (!programIds.has(item.sourceProgramId)) errors.push(`${p}.sourceProgramId is not in transferPrograms.`);
  for (const field of ["destinationProgramId", "destinationProgramName", "standardRatio", "effectiveRatio", "publicOrTargeted"]) if (typeof item[field] !== "string" || !item[field].trim()) errors.push(`${p}.${field} is required.`);
  if (!finiteNonNegative(item.bonusPercent)) errors.push(`${p}.bonusPercent must be non-negative.`);
  if (!isDateOnlyOrNull(item.startDate) || item.startDate === null) errors.push(`${p}.startDate must be YYYY-MM-DD.`);
  if (!isDateOnlyOrNull(item.endDate) || item.endDate === null) errors.push(`${p}.endDate must be YYYY-MM-DD.`);
  if (!isIsoUtc(item.lastVerifiedAt)) errors.push(`${p}.lastVerifiedAt must be ISO UTC.`);
  if (!Array.isArray(item.sources) || !item.sources.length) errors.push(`${p}.sources must contain at least one source.`);
  else item.sources.forEach((source, i) => errors.push(...validateSource(source, `${p}.sources[${i}]`)));
  if (item.endDate && options.rejectExpired !== false) {
    const today = options.today || new Date().toISOString().slice(0, 10);
    if (item.endDate < today) errors.push(`${p} is expired (${item.endDate}).`);
  }
  return errors;
}

export function migrateDatabase(input) {
  if (!isPlainObject(input)) return {database: input, migrated: false, changes: [], compatibilityVersion: DATABASE_COMPATIBILITY_VERSION};
  const database = clone(input);
  const changes = [];
  if (!Array.isArray(database.cards)) database.cards = [];
  if (!Array.isArray(database.offers)) database.offers = [];
  for (const field of ["cardDetails", "transferPrograms", "transferBonuses"]) {
    if (!Array.isArray(database[field])) { database[field] = []; changes.push(`${field} initialized`); }
  }
  database.cards.forEach((card, index) => {
    if (!isPlainObject(card)) return;
    if (typeof card.isArchived !== "boolean") { card.isArchived = false; changes.push(`cards[${index}].isArchived defaulted`); }
    if (card.archivedAt === undefined || card.archivedAt === "") { card.archivedAt = null; changes.push(`cards[${index}].archivedAt defaulted`); }
  });
  database.offers.forEach((offer, index) => {
    if (!isPlainObject(offer)) return;
    if (typeof offer.annualFeeWaivedFirstYear !== "boolean") { offer.annualFeeWaivedFirstYear = firstYearFeeWaived(offer); changes.push(`offers[${index}].annualFeeWaivedFirstYear normalized`); }
  });
  if (database.schemaVersion !== SCHEMA_VERSION) { database.schemaVersion = SCHEMA_VERSION; changes.push(`schemaVersion upgraded to ${SCHEMA_VERSION}`); }
  if (database.compatibilityVersion !== DATABASE_COMPATIBILITY_VERSION) { database.compatibilityVersion = DATABASE_COMPATIBILITY_VERSION; changes.push(`compatibilityVersion set to ${DATABASE_COMPATIBILITY_VERSION}`); }
  return {database, migrated: changes.length > 0, changes, compatibilityVersion: DATABASE_COMPATIBILITY_VERSION};
}

export function validateDatabase(database, options = {}) {
  const errors = [];
  if (!isPlainObject(database)) return {valid: false, errors: ["Database must be an object."]};
  if (database.schemaVersion !== SCHEMA_VERSION && database.schemaVersion !== LEGACY_OFFER_SCHEMA_VERSION) errors.push(`schemaVersion must equal ${SCHEMA_VERSION} or legacy ${LEGACY_OFFER_SCHEMA_VERSION}.`);
  if (database.generatedAt !== null && !isIsoUtc(database.generatedAt)) errors.push("generatedAt must be ISO UTC or null.");
  if (!DATA_STATUSES.has(database.dataStatus)) errors.push("dataStatus must be seed, live, or partial.");
  for (const field of ["cards", "offers"]) if (!Array.isArray(database[field])) errors.push(`${field} must be an array.`);
  if (errors.length) return {valid: false, errors};
  const cards = database.cards;
  const ids = new Set();
  cards.forEach((card, index) => { errors.push(...validateCard(card, index)); if (ids.has(card.id)) errors.push(`Duplicate card id '${card.id}'.`); ids.add(card.id); });
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const offerKeys = new Set();
  database.offers.forEach((offer, index) => { errors.push(...validateOffer(offer, cardsById, index, {rejectExpired: options.rejectExpired ?? false})); const key = `${offer.cardId}::${offer.channel}`; if (offerKeys.has(key)) errors.push(`Duplicate offer key '${key}'.`); offerKeys.add(key); });
  (database.cardDetails || []).forEach((item, index) => errors.push(...validateCardDetail(item, cardsById, index)));
  const programIds = new Set();
  (database.transferPrograms || []).forEach((item, index) => { errors.push(...validateTransferProgram(item, cardsById, index)); if (programIds.has(item.programId)) errors.push(`Duplicate transfer program '${item.programId}'.`); programIds.add(item.programId); });
  const bonusIds = new Set();
  (database.transferBonuses || []).forEach((item, index) => { errors.push(...validateTransferBonus(item, programIds, index, {rejectExpired: options.rejectExpired ?? false})); if (bonusIds.has(item.transferBonusId)) errors.push(`Duplicate transfer bonus '${item.transferBonusId}'.`); bonusIds.add(item.transferBonusId); });
  return {valid: errors.length === 0, errors};
}

function result(type, accepted, rejected, extra = {}) {
  const errors = rejected.flatMap((item) => item.errors || []);
  return {type, valid: accepted.length > 0 && rejected.length === 0, accepted, rejected, errors, summary: {acceptedCount: accepted.length, rejectedCount: rejected.length, ...extra}};
}

function detectImportType(payload) {
  if (payload?.dataType && IMPORT_TYPES.has(payload.dataType)) return payload.dataType;
  if (Array.isArray(payload?.offers)) return "offers";
  if (Array.isArray(payload?.cardDetails)) return "cardDetails";
  if (Array.isArray(payload?.transferPrograms)) return "transferPrograms";
  if (Array.isArray(payload?.transferBonuses)) return "transferBonuses";
  if (payload?.programs && payload?.sourceName) return "valuations";
  if (Array.isArray(payload?.cards) && (payload.offers || payload.cardDetails || payload.transferPrograms)) return "complete";
  return null;
}

export function validateSectionPayload(payload, database, options = {}) {
  const type = options.type && options.type !== "auto" ? options.type : detectImportType(payload);
  if (!type) return result("unknown", [], [{index: -1, errors: ["Could not determine import type."]}]);
  const cards = (database?.cards || []).filter((card) => !card.isArchived);
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const accepted = [];
  const rejected = [];
  if (type === "offers") {
    const items = Array.isArray(payload) ? payload : payload.offers;
    if (!Array.isArray(items)) return result(type, [], [{index: -1, errors: ["offers must be an array."]}]);
    const seen = new Set();
    items.forEach((item, index) => {
      const errors = validateOffer(item, cardsById, index, {rejectExpired: true, requireWaiverField: true});
      const key = `${item?.cardId}::${item?.channel}`;
      if (seen.has(key)) errors.push(`Duplicate cardId + channel '${key}'.`);
      seen.add(key);
      if (errors.length) rejected.push({index, item, errors}); else accepted.push({...item, status: effectiveStatus(item, cardsById.get(item.cardId))});
    });
    if (payload?.validation?.acceptedCount !== undefined && payload.validation.acceptedCount !== items.length) rejected.push({index: -1, errors: [`validation.acceptedCount (${payload.validation.acceptedCount}) must equal offers.length (${items.length}).`]});
    return result(type, accepted, rejected, {publicCount: accepted.filter((x) => x.channel === "public").length, promotionCount: accepted.filter((x) => ["elevated", "limited"].includes(x.status)).length});
  }
  if (type === "cardDetails") {
    const items = payload.cardDetails;
    if (!Array.isArray(items)) return result(type, [], [{index: -1, errors: ["cardDetails must be an array."]}]);
    const seen = new Set();
    items.forEach((item, index) => { const errors = validateCardDetail(item, cardsById, index); if (seen.has(item?.cardId)) errors.push(`Duplicate cardDetails cardId '${item?.cardId}'.`); seen.add(item?.cardId); if (errors.length) rejected.push({index, item, errors}); else accepted.push(item); });
    return result(type, accepted, rejected);
  }
  if (type === "transferPrograms") {
    const items = payload.transferPrograms;
    if (!Array.isArray(items)) return result(type, [], [{index: -1, errors: ["transferPrograms must be an array."]}]);
    const seen = new Set();
    items.forEach((item, index) => { const errors = validateTransferProgram(item, cardsById, index); if (seen.has(item?.programId)) errors.push(`Duplicate programId '${item?.programId}'.`); seen.add(item?.programId); if (errors.length) rejected.push({index, item, errors}); else accepted.push(item); });
    return result(type, accepted, rejected);
  }
  if (type === "transferBonuses") {
    const items = payload.transferBonuses;
    if (!Array.isArray(items)) return result(type, [], [{index: -1, errors: ["transferBonuses must be an array."]}]);
    const programIds = new Set((database?.transferPrograms || []).map((x) => x.programId));
    const seen = new Set();
    items.forEach((item, index) => { const errors = validateTransferBonus(item, programIds, index, {rejectExpired: true}); if (seen.has(item?.transferBonusId)) errors.push(`Duplicate transferBonusId '${item?.transferBonusId}'.`); seen.add(item?.transferBonusId); if (errors.length) rejected.push({index, item, errors}); else accepted.push(item); });
    return result(type, accepted, rejected, {activeCount: accepted.length});
  }
  if (type === "valuations") {
    const errors = [];
    if (payload.schemaVersion !== 1) errors.push("Valuation schemaVersion must equal 1.");
    if (typeof payload.sourceName !== "string" || !payload.sourceName.trim()) errors.push("sourceName is required.");
    if (typeof payload.asOf !== "string" || !payload.asOf.trim()) errors.push("asOf is required.");
    if (!isHttps(payload.sourceUrl)) errors.push("sourceUrl must be HTTPS.");
    if (!isPlainObject(payload.programs)) errors.push("programs must be an object.");
    else Object.entries(payload.programs).forEach(([name, value]) => { if (!isPlainObject(value) || !finiteNonNegative(value.cpp)) errors.push(`Invalid CPP for '${name}'.`); });
    return result(type, errors.length ? [] : [payload], errors.length ? [{index: -1, errors}] : []);
  }
  if (type === "complete") {
    const migration = migrateDatabase(payload);
    const check = validateDatabase(migration.database, {rejectExpired: true});
    return result(type, check.valid ? [migration.database] : [], check.valid ? [] : [{index: -1, errors: check.errors}]);
  }
  return result(type, [], [{index: -1, errors: [`Unsupported import type '${type}'.`]}]);
}

export function validateImportPayload(payload, cards, options = {}) {
  const database = {schemaVersion: SCHEMA_VERSION, generatedAt: null, dataStatus: "partial", cards, offers: [], cardDetails: [], transferPrograms: [], transferBonuses: []};
  return validateSectionPayload(payload, database, {type: "offers", ...options});
}

function mergeByKey(existing = [], incoming = [], keyFn, mode) {
  const safeExisting = Array.isArray(existing) ? existing : [];
  const safeIncoming = Array.isArray(incoming) ? incoming : [];
  if (mode === "replace") return clone(safeIncoming);
  const map = new Map(safeExisting.map((item) => [keyFn(item), item]));
  safeIncoming.forEach((item) => map.set(keyFn(item), item));
  return [...map.values()];
}

export function mergeOffers(existing, incoming, mode = "merge") {
  return mergeByKey(existing, incoming, (item) => `${item.cardId}::${item.channel}`, mode);
}

export function applySectionImport(database, validation, mode = "merge") {
  const next = migrateDatabase(database).database;
  const type = validation.type;
  if (!validation.valid) throw new Error("Only a fully valid import can be applied.");
  if (type === "offers") next.offers = mergeOffers(next.offers || [], validation.accepted, mode);
  else if (type === "cardDetails") next.cardDetails = mergeByKey(next.cardDetails || [], validation.accepted, (item) => item.cardId, mode);
  else if (type === "transferPrograms") next.transferPrograms = mergeByKey(next.transferPrograms || [], validation.accepted, (item) => item.programId, mode);
  else if (type === "transferBonuses") next.transferBonuses = mergeByKey(next.transferBonuses || [], validation.accepted, (item) => item.transferBonusId, mode);
  else if (type === "complete") return clone(validation.accepted[0]);
  next.generatedAt = new Date().toISOString();
  next.updatedBy = "cardtrack-admin-publisher";
  return next;
}
