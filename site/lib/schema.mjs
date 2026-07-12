export const APP_VERSION = "5.2.4";
export const SCHEMA_VERSION = 5;
export const LEGACY_OFFER_SCHEMA_VERSION = 3;
export const DATABASE_COMPATIBILITY_VERSION = 2;

export const BONUS_UNITS = new Set(["points", "miles", "cash", "free-night certificate points"]);
export const CHANNELS = new Set(["public", "targeted", "referral", "branch", "mailer"]);
export const STATUSES = new Set(["standard", "elevated", "limited", "targeted", "review"]);
export const CONFIDENCE = new Set(["high", "medium", "low"]);
export const SOURCE_TYPES = new Set(["issuer", "aggregator", "news", "loyalty-program", "airline", "hotel", "payment-network", "benefit-provider", "government"]);
export const DATA_STATUSES = new Set(["seed", "live", "partial"]);
export const IMPORT_TYPES = new Set(["offers", "cardDetails", "transferPrograms", "transferBonuses", "valuations", "complete"]);

export const TRUSTED_EDITORIAL_DOMAINS = Object.freeze([
  "doctorofcredit.com", "frequentmiler.com", "onemileatatime.com",
  "thepointsguy.com", "nerdwallet.com"
]);

export const ISSUER_SOURCE_DOMAINS = Object.freeze([
  "americanexpress.com", "chase.com", "capitalone.com", "citi.com",
  "bankofamerica.com", "barclaycardus.com", "wellsfargo.com",
  "usbank.com", "discover.com", "synchrony.com", "comenity.com",
  "comenity.net", "fnbo.com", "td.com", "truist.com"
]);

export const LOYALTY_SOURCE_DOMAINS = Object.freeze([
  "aa.com", "aerlingus.com", "aeroplan.com", "aircanada.com",
  "airfrance.com", "alaskaair.com", "ana.co.jp", "avianca.com",
  "britishairways.com", "cathaypacific.com", "delta.com",
  "emirates.com", "etihad.com", "finnair.com", "flyingblue.com",
  "hawaiianairlines.com", "iberia.com", "jetblue.com", "klm.com",
  "lifemiles.com", "qantas.com", "qatarairways.com",
  "singaporeair.com", "southwest.com", "tapairportugal.com",
  "turkishairlines.com", "united.com", "virginatlantic.com",
  "accor.com", "choicehotels.com", "hilton.com", "hyatt.com",
  "ihg.com", "marriott.com", "wyndhamhotels.com", "bilt.com",
  "biltrewards.com"
]);

export const BENEFIT_SOURCE_DOMAINS = Object.freeze([
  "visa.com", "mastercard.com", "prioritypass.com",
  "plazapremiumlounge.com", "loungebuddy.com", "clearme.com",
  "tsa.gov", "cbp.gov", "resy.com", "uber.com", "lyft.com",
  "doordash.com", "instacart.com", "walmart.com", "equinox.com",
  "lululemon.com", "dunkindonuts.com", "saksfifthavenue.com",
  "disneyplus.com", "hulu.com", "peacocktv.com", "hertz.com",
  "nationalcar.com", "avis.com"
]);

function uniqueDomains(...groups) {
  return Object.freeze([...new Set(groups.flat())].sort());
}

export const SOURCE_POLICY_DOMAINS = Object.freeze({
  offers: uniqueDomains(ISSUER_SOURCE_DOMAINS, TRUSTED_EDITORIAL_DOMAINS),
  cardDetails: uniqueDomains(ISSUER_SOURCE_DOMAINS, LOYALTY_SOURCE_DOMAINS, BENEFIT_SOURCE_DOMAINS, TRUSTED_EDITORIAL_DOMAINS),
  transferPrograms: uniqueDomains(ISSUER_SOURCE_DOMAINS, LOYALTY_SOURCE_DOMAINS, TRUSTED_EDITORIAL_DOMAINS),
  transferBonuses: uniqueDomains(ISSUER_SOURCE_DOMAINS, LOYALTY_SOURCE_DOMAINS, TRUSTED_EDITORIAL_DOMAINS),
  valuations: Object.freeze(["thepointsguy.com"])
});

export const SOURCE_POLICY_LABELS = Object.freeze({
  offers: "welcome offers",
  cardDetails: "card facts and benefits",
  transferPrograms: "transfer partners",
  transferBonuses: "transfer bonuses",
  valuations: "CPP valuations"
});

// Backward-compatible export used by older integrations.
export const OFFER_SOURCE_DOMAINS = SOURCE_POLICY_DOMAINS.offers;

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

function domainMatches(host, domain) {
  return host === domain || host.endsWith(`.${domain}`);
}

function sourceHost(value) {
  try { return new URL(String(value || "").trim()).hostname.toLowerCase(); }
  catch { return ""; }
}

function hasMarkdownLink(value) {
  return typeof value === "string" && /\[[^\]]*\]\(https?:\/\//i.test(value);
}

function validatePlainText(value, path, {required = false, maxLength = null} = {}) {
  const errors = [];
  if (required && (typeof value !== "string" || !value.trim())) errors.push(`${path} is required.`);
  if (value !== undefined && value !== null && typeof value !== "string") errors.push(`${path} must be text or null.`);
  if (typeof value === "string") {
    if (hasMarkdownLink(value)) errors.push(`${path} must be plain text and may not contain a Markdown link.`);
    if (/%(?:22|5B|5D|7B|7D)/i.test(value) && !/^https:\/\//i.test(value)) errors.push(`${path} contains URL-encoded JSON punctuation.`);
    if (maxLength !== null && value.length > maxLength) errors.push(`${path} must be at most ${maxLength} characters.`);
  }
  return errors;
}

const TRACKING_PARAMETERS = new Set([
  "gclid", "dclid", "fbclid", "msclkid", "mc_cid", "mc_eid", "ref", "referrer"
]);

function extractUrlCandidate(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  const markdown = trimmed.match(/^\[[^\]]*\]\((https:\/\/[^)]+)\)$/i);
  return markdown ? markdown[1].trim() : trimmed;
}

function unwrapKnownRedirect(url) {
  const host = url.hostname.toLowerCase();
  if (domainMatches(host, "google.com") && url.pathname === "/url") {
    return url.searchParams.get("url") || url.searchParams.get("q") || "";
  }
  return "";
}

export function normalizeApprovedSourceUrl(value, policy = "cardDetails") {
  const domains = SOURCE_POLICY_DOMAINS[policy];
  if (!domains) return null;
  let candidate = extractUrlCandidate(value);
  if (!candidate) return null;

  for (let pass = 0; pass < 3; pass += 1) {
    try {
      const url = new URL(candidate);
      const redirected = unwrapKnownRedirect(url);
      if (redirected) {
        candidate = redirected;
        continue;
      }
      if (url.protocol !== "https:" || url.username || url.password) return null;
      const host = url.hostname.toLowerCase();
      if (!domains.some((domain) => domainMatches(host, domain))) return null;
      url.hash = "";
      for (const key of [...url.searchParams.keys()]) {
        const lower = key.toLowerCase();
        if (lower.startsWith("utm_") || TRACKING_PARAMETERS.has(lower)) url.searchParams.delete(key);
      }
      return url.toString();
    } catch {
      return null;
    }
  }
  return null;
}

export function approvedSourceUrl(value, policy = "cardDetails") {
  return Boolean(normalizeApprovedSourceUrl(value, policy));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function stripJsonFences(text) {
  if (typeof text !== "string") return "";
  const normalized = text.replace(/^\uFEFF/, "").trim();
  const fenced = normalized.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();
  if (normalized.startsWith("{") || normalized.startsWith("[")) return normalized;
  const firstObject = normalized.indexOf("{");
  const lastObject = normalized.lastIndexOf("}");
  if (firstObject >= 0 && lastObject > firstObject) return normalized.slice(firstObject, lastObject + 1).trim();
  return normalized;
}

export function parseResearchJson(text) {
  const cleaned = stripJsonFences(text);
  if (!cleaned) throw new Error("No JSON was provided.");
  try { return JSON.parse(cleaned); }
  catch (error) {
    if (/%(?:22|5B|5D|7B|7D)/i.test(cleaned)) {
      throw new Error("JSON could not be parsed because URL-encoded JSON punctuation was found (for example %22 or %7B). Copy the content from the model's JSON code-block Copy button, or use Prompt Manager's JSON Repair Prompt.");
    }
    if (/\[[^\]]*\]\(https?:\/\//i.test(cleaned) || /\[https?:\/\//i.test(cleaned)) {
      throw new Error("JSON could not be parsed because Markdown-wrapped links were found. Use plain URL strings or run Prompt Manager's JSON Repair Prompt.");
    }
    throw new Error(`JSON could not be parsed: ${error.message}`);
  }
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

function validateSource(source, path, {policy = "cardDetails"} = {}) {
  const errors = [];
  if (!isPlainObject(source)) return [`${path} must be an object.`];
  errors.push(...validatePlainText(source.name, `${path}.name`, {required: true}));
  const normalizedUrl = normalizeApprovedSourceUrl(source.url, policy);
  if (!normalizedUrl) {
    const host = sourceHost(source?.url);
    const received = host ? ` Received host '${host}'.` : "";
    const supplied = typeof source?.url === "string" && source.url.trim() ? ` Supplied URL: '${source.url.trim()}'.` : "";
    errors.push(`${path}.url must be a direct approved HTTPS URL for ${SOURCE_POLICY_LABELS[policy] || policy}.${received}${supplied}`);
  } else {
    source.url = normalizedUrl;
  }
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
  errors.push(...validatePlainText(offer.note, `${p}.note`, {required: true, maxLength: 500}));
  if (!Array.isArray(offer.sources) || offer.sources.length === 0) errors.push(`${p}.sources must contain at least one source.`);
  else offer.sources.forEach((source, sourceIndex) => errors.push(...validateSource(source, `${p}.sources[${sourceIndex}]`, {policy: "offers"})));
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
  const benefitArrays = ["credits", "perks", "protections", "loungeAccess", "statusBenefits", "airlineBenefits", "hotelBenefits"];
  benefitArrays.forEach((field) => (item[field] || []).forEach((benefit, i) => {
    const bp = `${p}.${field}[${i}]`;
    if (!isPlainObject(benefit)) {
      errors.push(`${bp} must be an object.`);
      return;
    }
    errors.push(...validatePlainText(benefit.name, `${bp}.name`, {required: true}));
    for (const fieldName of ["category", "summary", "conditions", "notes"]) {
      if (benefit[fieldName] !== undefined) errors.push(...validatePlainText(benefit[fieldName], `${bp}.${fieldName}`));
    }
    if (benefit.isTopBenefit !== undefined && typeof benefit.isTopBenefit !== "boolean") errors.push(`${bp}.isTopBenefit must be boolean when provided.`);
    if (benefit.isUniqueBenefit !== undefined && typeof benefit.isUniqueBenefit !== "boolean") errors.push(`${bp}.isUniqueBenefit must be boolean when provided.`);
    if (benefit.displayOrder !== undefined && (!Number.isInteger(benefit.displayOrder) || benefit.displayOrder < 0)) errors.push(`${bp}.displayOrder must be a non-negative integer when provided.`);
    if (benefit.sourceUrl !== undefined && benefit.sourceUrl !== null) {
      const normalizedUrl = normalizeApprovedSourceUrl(benefit.sourceUrl, "cardDetails");
      if (!normalizedUrl) {
        const host = sourceHost(benefit.sourceUrl);
        const received = host ? ` Received host '${host}'.` : "";
        const supplied = typeof benefit.sourceUrl === "string" && benefit.sourceUrl.trim() ? ` Supplied URL: '${benefit.sourceUrl.trim()}'.` : "";
        errors.push(`${bp}.sourceUrl must be a direct approved HTTPS URL for card facts and benefits.${received}${supplied}`);
      } else {
        benefit.sourceUrl = normalizedUrl;
      }
    }
  }));
  (item.credits || []).forEach((credit, i) => {
    const cp = `${p}.credits[${i}]`;
    if (!nonNegativeOrNull(credit.faceValueAnnual)) errors.push(`${cp}.faceValueAnnual must be non-negative or null.`);
    if (credit.estimatedUtilization !== undefined && (typeof credit.estimatedUtilization !== "number" || credit.estimatedUtilization < 0 || credit.estimatedUtilization > 1)) errors.push(`${cp}.estimatedUtilization must be 0 through 1.`);
  });
  (item.sources || []).forEach((source, i) => errors.push(...validateSource(source, `${p}.sources[${i}]`, {policy: "cardDetails"})));
  return errors;
}

export function validateTransferProgram(item, cardsById, index = 0) {
  const errors = [];
  const p = `transferPrograms[${index}]`;
  if (!isPlainObject(item)) return [`${p} must be an object.`];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.programId || "")) errors.push(`${p}.programId must be a lowercase slug.`);
  errors.push(...validatePlainText(item.programName, `${p}.programName`, {required: true}));
  if (!Array.isArray(item.cards)) errors.push(`${p}.cards must be an array.`);
  else item.cards.forEach((cardId) => { if (!cardsById.has(cardId)) errors.push(`${p}.cards contains unknown cardId '${cardId}'.`); });
  if (!Array.isArray(item.partners)) errors.push(`${p}.partners must be an array.`);
  else item.partners.forEach((partner, i) => {
    const pp = `${p}.partners[${i}]`;
    if (!isPlainObject(partner)) return errors.push(`${pp} must be an object.`);
    for (const field of ["partnerId", "partnerName", "partnerType", "ratioDisplay"]) errors.push(...validatePlainText(partner[field], `${pp}.${field}`, {required: true}));
    if (partner.notes !== undefined) errors.push(...validatePlainText(partner.notes, `${pp}.notes`));
    if (!isIsoUtc(partner.lastVerifiedAt)) errors.push(`${pp}.lastVerifiedAt must be ISO UTC.`);
    if (!Array.isArray(partner.sources) || !partner.sources.length) errors.push(`${pp}.sources must contain at least one source.`);
    else partner.sources.forEach((source, sourceIndex) => errors.push(...validateSource(source, `${pp}.sources[${sourceIndex}]`, {policy: "transferPrograms"})));
  });
  return errors;
}

export function validateTransferBonus(item, programIds, index = 0, options = {}) {
  const errors = [];
  const p = `transferBonuses[${index}]`;
  if (!isPlainObject(item)) return [`${p} must be an object.`];
  if (typeof item.transferBonusId !== "string" || !item.transferBonusId.trim()) errors.push(`${p}.transferBonusId is required.`);
  if (!programIds.has(item.sourceProgramId)) errors.push(`${p}.sourceProgramId is not in transferPrograms.`);
  for (const field of ["destinationProgramId", "destinationProgramName", "standardRatio", "effectiveRatio", "publicOrTargeted"]) errors.push(...validatePlainText(item[field], `${p}.${field}`, {required: true}));
  if (item.note !== undefined) errors.push(...validatePlainText(item.note, `${p}.note`));
  if (!finiteNonNegative(item.bonusPercent)) errors.push(`${p}.bonusPercent must be non-negative.`);
  if (!isDateOnlyOrNull(item.startDate) || item.startDate === null) errors.push(`${p}.startDate must be YYYY-MM-DD.`);
  if (!isDateOnlyOrNull(item.endDate) || item.endDate === null) errors.push(`${p}.endDate must be YYYY-MM-DD.`);
  if (!isIsoUtc(item.lastVerifiedAt)) errors.push(`${p}.lastVerifiedAt must be ISO UTC.`);
  if (!Array.isArray(item.sources) || !item.sources.length) errors.push(`${p}.sources must contain at least one source.`);
  else item.sources.forEach((source, i) => errors.push(...validateSource(source, `${p}.sources[${i}]`, {policy: "transferBonuses"})));
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
    if (!approvedSourceUrl(payload.sourceUrl, "valuations")) errors.push("sourceUrl must be a direct approved The Points Guy HTTPS URL.");
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
