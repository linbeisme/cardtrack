import {SOURCE_POLICY_DOMAINS, SOURCE_POLICY_LABELS} from "./schema.mjs";

function clone(value) { return JSON.parse(JSON.stringify(value)); }

export const PROMPT_PROVIDERS = Object.freeze({
  chatgpt: {label: "ChatGPT", searchLabel: "ChatGPT Search", deepLabel: "ChatGPT Deep Research"},
  gemini: {label: "Gemini", searchLabel: "Gemini with Google Search", deepLabel: "Gemini Deep Research"}
});

export const PROMPT_WORKFLOWS = Object.freeze({
  "one-step": {label: "1-Step · Regular Search"},
  "two-step": {label: "2-Step · Deep Research"}
});

const VALID_SOURCE_POLICIES = new Set(["offers", "cardDetails", "transferPrograms", "transferBonuses", "valuations", "complete"]);

export function filterCards(cards = [], filter) {
  const active = (Array.isArray(cards) ? cards : []).filter((card) => !card.isArchived);
  if (!filter || filter.type === "all") return active;
  const values = new Set(filter.values || []);
  if (filter.type === "issuer") return active.filter((card) => values.has(card.issuer));
  if (filter.type === "program") return active.filter((card) => values.has(card.program));
  if (filter.type === "cardId") return active.filter((card) => values.has(card.id));
  return active;
}

export function effectiveTemplateContent(library, template) {
  return template.customPrompt || template.defaultPrompt || library.basePrompt || "";
}

function catalogForPrompt(cards = []) {
  return (Array.isArray(cards) ? cards : []).map((card) => ({
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
}

function databaseSummary(database = {}, selectedCards = [], policy = "complete") {
  const ids = new Set((Array.isArray(selectedCards) ? selectedCards : []).map((card) => card.id));
  const offers = (database.offers || []).filter((item) => ids.has(item.cardId));
  const details = (database.cardDetails || []).filter((item) => ids.has(item.cardId));
  const compactFeeStatus = offers.map((item) => ({
    cardId: item.cardId,
    channel: item.channel,
    annualFee: item.annualFee,
    annualFeeWaivedFirstYear: item.annualFeeWaivedFirstYear,
    lastVerifiedAt: item.lastVerifiedAt
  }));
  if (policy === "offers") return {schemaVersion: database.schemaVersion, existingOffers: offers};
  if (policy === "cardDetails") return {schemaVersion: database.schemaVersion, existingFeeStatus: compactFeeStatus, existingCardDetails: details};
  if (policy === "transferPrograms") return {schemaVersion: database.schemaVersion, transferPrograms: database.transferPrograms || []};
  if (policy === "transferBonuses") return {schemaVersion: database.schemaVersion, transferPrograms: database.transferPrograms || [], transferBonuses: database.transferBonuses || []};
  if (policy === "valuations") return {schemaVersion: database.schemaVersion, representedPrograms: [...new Set((selectedCards || []).map((card) => card.program))]};
  return {schemaVersion: database.schemaVersion, existingOffers: offers, existingCardDetails: details, transferPrograms: database.transferPrograms || [], transferBonuses: database.transferBonuses || []};
}

function sourcePolicyForTemplate(template = {}) {
  if (VALID_SOURCE_POLICIES.has(template.sourcePolicy)) return template.sourcePolicy;
  if (["full-catalog", "american-express", "chase"].includes(template.id)) return "offers";
  if (["card-facts", "hotels", "airlines"].includes(template.id)) return "cardDetails";
  if (template.id === "transfer-partners") return "transferPrograms";
  if (template.id === "transfer-bonuses") return "transferBonuses";
  if (template.id === "tpg-valuations") return "valuations";
  if (template.id === "full-data-refresh") return "complete";
  return "cardDetails";
}

function domainLines(policy) {
  const domains = SOURCE_POLICY_DOMAINS[policy] || [];
  return domains.join("\n");
}

function sourcePolicyContract(template) {
  const policy = sourcePolicyForTemplate(template);
  const directRules = `SOURCE URL HARD RULES
- Every URL must be a JSON string containing one direct canonical HTTPS page.
- Never use a search-result URL, ChatGPT citation link, Gemini grounding link, Google/Bing redirect, URL shortener, affiliate redirect, cached page, session URL, or tracking-only URL.
- Open the original source page and use its final canonical URL.
- Never use Markdown-link syntax inside JSON. A name stays plain text and its URL belongs in the separate URL field.
- Do not URL-encode JSON punctuation. The JSON structure must use literal ASCII braces, brackets, commas, colons and double quotation marks.
- If no approved direct source supports an optional fact, omit that optional fact. If a required record cannot be supported, put it in errors.`;
  if (policy === "complete") {
    return `${directRules}

APPROVED DOMAINS BY DATA SECTION
WELCOME OFFERS
${domainLines("offers")}

CARD FACTS AND BENEFITS
${domainLines("cardDetails")}

TRANSFER PARTNERS AND TRANSFER BONUSES
${domainLines("transferPrograms")}

CPP VALUATIONS
${domainLines("valuations")}

Apply the matching list to each section of the complete dataset.`;
  }
  return `${directRules}

APPROVED DOMAINS FOR ${String(SOURCE_POLICY_LABELS[policy] || policy).toUpperCase()}
${domainLines(policy)}`;
}

function commonJsonRules() {
  return `JSON SYNTAX HARD RULES
- Use standard JSON only: double-quoted property names and string values, commas between properties and array elements, no comments and no trailing commas.
- Do not use smart quotes.
- Do not place literal line breaks inside a JSON string.
- Do not use Markdown links such as [Label](https://example.com) anywhere inside the JSON.
- Do not use encoded JSON punctuation such as %22, %5B, %5D, %7B or %7D in place of JSON syntax.
- Every URL field must contain only a plain URL string beginning with https://.
- Before responding, internally run the equivalent of JSON.parse on the exact content that will appear inside the output code block. Repair every parse error before sending.
- Silently search the final JSON text for these forbidden fragments and remove or repair them: ](, [https://, %22, %5B, %5D, %7B, %7D, vertexaisearch, google.com/url, bing.com/search.`;
}

function offersSchemaContract() {
  return `FINAL CARDTRACK SCHEMA — WELCOME OFFERS
Return this top-level shape:
{
  "schemaVersion": 5,
  "dataType": "offers",
  "generatedAt": "ISO-8601 UTC timestamp",
  "dataStatus": "live or partial",
  "collector": {"provider": "provider used", "model": "model used"},
  "offers": [],
  "errors": [],
  "validation": {"acceptedCount": 0, "rejectedCount": 0}
}

Each offers item must be:
{
  "cardId": "exact catalog cardId",
  "bonusAmount": 75000,
  "bonusUnit": "points, miles, cash, or free-night certificate points",
  "channel": "public, targeted, referral, branch, or mailer",
  "spendRequirement": 4000,
  "spendPeriodMonths": 3,
  "annualFee": 95,
  "annualFeeWaivedFirstYear": false,
  "status": "standard, elevated, limited, targeted, or review",
  "expirationDate": null,
  "lastVerifiedAt": "ISO-8601 UTC timestamp",
  "confidence": "high, medium, or low",
  "note": "Plain text, no Markdown, maximum 500 characters",
  "sources": [{"name": "Source name", "url": "https://direct-approved-page", "sourceType": "issuer, aggregator, or news"}]
}

Each errors item must be:
{"cardId": "exact catalog cardId", "reason": "Plain-text reason", "attemptedSources": ["https://direct-approved-page"]}

Offer rules:
- Research only catalog cards. One record per cardId plus channel.
- Every catalog card needs a verified public record or an errors entry.
- Public above baseline is elevated unless explicitly time-limited; explicit limited status takes priority.
- Non-public channels use targeted unless material conflict requires review.
- expirationDate is YYYY-MM-DD or null; never invent it.
- Numeric fields are JSON numbers without commas or currency symbols.
- acceptedCount equals offers.length and rejectedCount equals errors.length.`;
}

function cardDetailsSchemaContract() {
  return `FINAL CARDTRACK SCHEMA — CARD FACTS AND BENEFITS
Return this top-level shape:
{
  "schemaVersion": 5,
  "dataType": "cardDetails",
  "generatedAt": "ISO-8601 UTC timestamp",
  "cardDetails": [],
  "errors": []
}

Each cardDetails item must be:
{
  "cardId": "exact catalog cardId",
  "foreignTransactionFee": 0,
  "earnRates": [{"category": "Dining", "rate": 4, "unit": "x", "cap": null, "notes": null}],
  "credits": [{"benefitId": "stable-lowercase-slug", "name": "Credit name", "category": "travel", "faceValueAnnual": 120, "frequency": "monthly", "amountPerPeriod": 10, "firstYearOnly": false, "enrollmentRequired": true, "conditions": "Plain-text restrictions", "estimatedUtilization": 1, "isTopBenefit": true, "isUniqueBenefit": false, "displayOrder": 1, "sourceUrl": "https://direct-approved-page"}],
  "perks": [{"name": "Perk name", "category": "travel", "summary": "Plain-text verified summary", "estimatedAnnualValue": 0, "isTopBenefit": false, "isUniqueBenefit": true, "displayOrder": 2, "sourceUrl": "https://direct-approved-page"}],
  "protections": [{"name": "Protection name", "summary": "Plain-text coverage summary", "isTopBenefit": false, "isUniqueBenefit": false, "displayOrder": 10, "sourceUrl": "https://direct-approved-page"}],
  "loungeAccess": [{"name": "Lounge benefit", "summary": "Plain-text access and guest terms", "isTopBenefit": true, "isUniqueBenefit": false, "displayOrder": 3, "sourceUrl": "https://direct-approved-page"}],
  "statusBenefits": [{"name": "Status benefit", "summary": "Plain-text status terms", "isTopBenefit": false, "isUniqueBenefit": true, "displayOrder": 4, "sourceUrl": "https://direct-approved-page"}],
  "airlineBenefits": [{"name": "Airline benefit", "summary": "Plain-text terms", "isTopBenefit": false, "isUniqueBenefit": false, "displayOrder": 5, "sourceUrl": "https://direct-approved-page"}],
  "hotelBenefits": [{"name": "Hotel benefit", "summary": "Plain-text terms", "isTopBenefit": false, "isUniqueBenefit": false, "displayOrder": 6, "sourceUrl": "https://direct-approved-page"}],
  "lastVerifiedAt": "ISO-8601 UTC timestamp",
  "sources": [{"name": "Source name", "url": "https://direct-approved-page", "sourceType": "issuer, loyalty-program, airline, hotel, payment-network, benefit-provider, government, aggregator, or news"}]
}

Each errors item must be:
{"cardId": "exact catalog cardId", "reason": "Plain-text reason", "attemptedSources": ["https://direct-approved-page"]}

Card-facts rules:
- Every catalog card appears exactly once in cardDetails or errors.
- All nine arrays shown above must exist, even when empty.
- Do not add annualFee or annualFeeWaivedFirstYear to cardDetails; those live in the catalog and welcome-offer records.
- Return all verified recurring benefits, but omit any optional benefit that lacks a direct approved source.
- Separate each monetary credit. Correctly represent monthly, quarterly, semiannual, annual, anniversary, one-time, per-visit and per-stay frequency.
- foreignTransactionFee is 0, a numeric percentage, or null; never a string.
- Only perks may use estimatedAnnualValue. Do not add estimatedAnnualValue to protections, loungeAccess, statusBenefits, airlineBenefits or hotelBenefits.
- Mark only the most important 3 to 5 items per card as isTopBenefit true. Use isUniqueBenefit only for genuinely differentiating benefits.
- No URL may appear in name, summary, conditions, category or notes; use sourceUrl only.`;
}

function transferProgramsSchemaContract() {
  return `FINAL CARDTRACK SCHEMA — TRANSFER PARTNERS
Return this top-level shape:
{
  "schemaVersion": 5,
  "dataType": "transferPrograms",
  "generatedAt": "ISO-8601 UTC timestamp",
  "transferPrograms": [],
  "errors": []
}

Each transferPrograms item must be:
{
  "programId": "stable-lowercase-slug",
  "programName": "Program name",
  "cards": ["exact catalog cardId"],
  "partners": [{
    "partnerId": "stable-lowercase-slug",
    "partnerName": "Partner name",
    "partnerType": "airline or hotel",
    "sourceRatio": 1,
    "destinationRatio": 1,
    "ratioDisplay": "1:1",
    "notes": null,
    "lastVerifiedAt": "ISO-8601 UTC timestamp",
    "sources": [{"name": "Source name", "url": "https://direct-approved-page", "sourceType": "issuer, loyalty-program, airline, hotel, aggregator, or news"}]
  }]
}

Each errors item must be:
{"programId": "stable-lowercase-slug", "reason": "Plain-text reason", "attemptedSources": ["https://direct-approved-page"]}

Transfer-partner rules:
- Only include flexible rewards programs earned by the injected active cards.
- Every cards entry must be an exact catalog cardId.
- Record standard, non-promotional transfer ratios only.
- Do not place temporary transfer bonuses in this section.
- Use one unique partnerId per program partner and no duplicate programId.
- ratioDisplay must match sourceRatio and destinationRatio.`;
}

function transferBonusesSchemaContract() {
  return `FINAL CARDTRACK SCHEMA — ACTIVE TRANSFER BONUSES
Return this top-level shape:
{
  "schemaVersion": 5,
  "dataType": "transferBonuses",
  "generatedAt": "ISO-8601 UTC timestamp",
  "transferBonuses": [],
  "errors": []
}

Each transferBonuses item must be:
{
  "transferBonusId": "stable-unique-lowercase-slug",
  "sourceProgramId": "exact existing transferPrograms programId",
  "destinationProgramId": "stable-lowercase-slug",
  "destinationProgramName": "Destination program name",
  "bonusPercent": 20,
  "standardRatio": "1:1",
  "effectiveRatio": "1:1.2",
  "publicOrTargeted": "public or targeted",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "enrollmentRequired": false,
  "note": "Plain-text terms",
  "lastVerifiedAt": "ISO-8601 UTC timestamp",
  "sources": [{"name": "Source name", "url": "https://direct-approved-page", "sourceType": "issuer, loyalty-program, airline, hotel, aggregator, or news"}]
}

Each errors item must be:
{"sourceProgramId": "programId", "destinationProgramId": "partnerId", "reason": "Plain-text reason", "attemptedSources": ["https://direct-approved-page"]}

Transfer-bonus rules:
- Include only currently active bonuses. Do not include an item whose endDate is before today.
- startDate and endDate are required and must be supported; if no end date can be verified, omit the item and record an error.
- sourceProgramId must exactly match an existing transferPrograms programId from CURRENT STORED DATA.
- effectiveRatio must correctly reflect standardRatio plus bonusPercent.
- Separate targeted from public promotions.`;
}

function valuationsSchemaContract() {
  return `FINAL CARDTRACK SCHEMA — TPG CPP VALUATIONS
Return exactly this shape:
{
  "schemaVersion": 1,
  "dataType": "valuations",
  "sourceName": "The Points Guy",
  "sourceUrl": "https://thepointsguy.com/direct-monthly-valuations-page",
  "asOf": "YYYY-MM-DD",
  "disclaimer": "Editorial estimates only; not cash or issuer guarantees.",
  "programs": {
    "Exact CardTrack program name": {"cpp": 2.05}
  }
}

Valuation rules:
- Use only the current The Points Guy monthly valuations page.
- sourceUrl must be a direct thepointsguy.com HTTPS page.
- cpp is cents per point or mile as a non-negative JSON number.
- Use exact CardTrack program names from the catalog. Do not add unrelated programs.
- Do not calculate or infer missing CPP values; omit unsupported programs.`;
}

function completeSchemaContract() {
  return `FINAL CARDTRACK SCHEMA — COMPLETE DATABASE
Return this top-level shape:
{
  "schemaVersion": 5,
  "compatibilityVersion": 2,
  "generatedAt": "ISO-8601 UTC timestamp",
  "dataStatus": "live or partial",
  "updatedBy": "research-provider",
  "cards": [],
  "offers": [],
  "cardDetails": [],
  "transferPrograms": [],
  "transferBonuses": []
}

Each cards item must preserve the injected catalog and use:
{
  "id": "exact catalog cardId",
  "name": "Card name",
  "issuer": "Issuer",
  "program": "Rewards program",
  "annualFee": 95,
  "baselineOffer": 60000,
  "historicalHigh": 100000,
  "bonusUnit": "points, miles, cash, or free-night certificate points",
  "applyUrl": "https://direct-issuer-page",
  "isArchived": false,
  "archivedAt": null
}

Each offers item must use the exact fields and allowed values from the Welcome Offers contract:
cardId, bonusAmount, bonusUnit, channel, spendRequirement, spendPeriodMonths, annualFee, annualFeeWaivedFirstYear, status, expirationDate, lastVerifiedAt, confidence, note, sources.

Each cardDetails item must use the exact fields from the Card Facts contract:
cardId, foreignTransactionFee, earnRates, credits, perks, protections, loungeAccess, statusBenefits, airlineBenefits, hotelBenefits, lastVerifiedAt, sources.
All required cardDetails arrays must exist even when empty.

Each transferPrograms item must use:
programId, programName, cards, partners.
Each partner must use partnerId, partnerName, partnerType, sourceRatio, destinationRatio, ratioDisplay, notes, lastVerifiedAt, sources.

Each transferBonuses item must use:
transferBonusId, sourceProgramId, destinationProgramId, destinationProgramName, bonusPercent, standardRatio, effectiveRatio, publicOrTargeted, startDate, endDate, enrollmentRequired, note, lastVerifiedAt, sources.

Complete-database rules:
- Preserve every injected active card exactly once and do not invent catalog cards.
- Do not include TPG CPP valuations in this object; valuations are stored and imported separately.
- Do not remove an existing active card because one research section is unverifiable.
- For unverifiable optional sections, preserve the card and omit the unsupported section record rather than inventing facts.
- Use one unique offer key per cardId plus channel, one cardDetails record per cardId, one transfer program per programId and one transfer bonus per transferBonusId.
- Every source and nested sourceUrl must comply with the section-specific source policy.`;
}

function schemaContractForTemplate(template) {
  const policy = sourcePolicyForTemplate(template);
  if (policy === "offers") return offersSchemaContract();
  if (policy === "cardDetails") return cardDetailsSchemaContract();
  if (policy === "transferPrograms") return transferProgramsSchemaContract();
  if (policy === "transferBonuses") return transferBonusesSchemaContract();
  if (policy === "valuations") return valuationsSchemaContract();
  return completeSchemaContract();
}

function providerOneStepInstructions(provider) {
  if (provider === "gemini") {
    return `PLATFORM-SPECIFIC EXECUTION — GEMINI
Use a normal Gemini chat with Google Search enabled. Do NOT use Gemini Deep Research for this one-step prompt.
Gemini may expose Google grounding or redirect URLs. Never copy those links into JSON. Open the original destination page and use the final direct canonical URL.
Do not transform plain URL strings into Markdown links.`;
  }
  return `PLATFORM-SPECIFIC EXECUTION — CHATGPT
Use a normal ChatGPT chat with Search enabled. Do NOT use ChatGPT Deep Research for this one-step prompt.
ChatGPT citations are for the chat interface only. Never copy citation wrappers into JSON. Open the cited source and use the final direct canonical URL.
Do not transform plain URL strings into Markdown links.`;
}

function providerResearchInstructions(provider) {
  if (provider === "gemini") {
    return `PLATFORM-SPECIFIC EXECUTION — GEMINI DEEP RESEARCH
Run this as Gemini Deep Research. Ground the report in original pages, but record direct canonical destination URLs, never Gemini/Google grounding wrappers or vertexaisearch links.`;
  }
  return `PLATFORM-SPECIFIC EXECUTION — CHATGPT DEEP RESEARCH
Run this as ChatGPT Deep Research. Use citations for verification during research, but also record the direct canonical source URL for every fact so Step 2 does not copy chat citation wrappers.`;
}

function outputTransportContract() {
  return `OUTPUT TRANSPORT — REQUIRED
Return exactly one fenced code block labeled json and no other visible text.
The outer code fence is transport only. CardTrack automatically removes it when pasted.
Inside the code block, place exactly one valid JSON object. Do not place another code fence, commentary, citations, headings or prose inside or outside it.
Use the code-block Copy button when available; do not manually copy rendered hyperlinks.
The response must look like this transport pattern:
\`\`\`json
{"schemaVersion":5}
\`\`\`
The example above is only the transport pattern; return the complete category object required below.`;
}

function oneStepContract(provider) {
  return `CARDTRACK ONE-STEP SEARCH PROMPT

${providerOneStepInstructions(provider)}

ONE-STEP PURPOSE
Perform the live-web research and produce the final import object in this single response. Do not show the research process.

${outputTransportContract()}`;
}

function twoStepResearchContract(provider) {
  return `CARDTRACK TWO-STEP DEEP RESEARCH — STEP 1 OF 2

${providerResearchInstructions(provider)}

STEP 1 PURPOSE
Conduct the research and create a structured evidence ledger for later JSON conversion. This step is deliberately not the final import JSON.

STEP 1 OUTPUT RULES
- Organize findings by exact cardId, programId or valuation program name required by the category contract.
- Map each finding to the exact target JSON field.
- Beside each fact, record the direct canonical HTTPS source URL that supports it.
- Keep names and descriptions as plain text; never embed Markdown links in a future JSON value.
- Explicitly identify missing required fields, conflicting sources, unsupported dates and records that must go to errors.
- Include a final conversion-readiness checklist covering every scoped card/program.
- Do not return the final CardTrack JSON in Step 1, even if the embedded category body asks for JSON. This Step 1 instruction overrides that output request.
- Do not use Google/Gemini grounding links, ChatGPT citation wrappers, search URLs or redirects as the canonical URL ledger.`;
}

function twoStepJsonContract(provider) {
  const platform = provider === "gemini" ? "Gemini Deep Research" : "ChatGPT Deep Research";
  return `CARDTRACK TWO-STEP DEEP RESEARCH — STEP 2 OF 2

CONTINUATION RULE
Paste this into the SAME ${platform} conversation immediately after Step 1 completes.

STEP 2 PURPOSE
Using only the completed Step 1 evidence ledger, convert the findings into the final CardTrack import object. Do not produce another report. Do not repeat analysis.
Only perform a narrow source-page check when a direct URL is missing, malformed, wrapped, redirected or unapproved.

${outputTransportContract()}`;
}

function finalAuditContract() {
  return `FINAL PRE-SEND AUDIT — MANDATORY
1. Extract the exact text intended for the inside of the json code block and internally run JSON.parse on it.
2. Confirm the first character inside the fence is { and the last character inside the fence is }.
3. Confirm no text exists outside the one code block.
4. Confirm no Markdown-link fragment ]( exists anywhere inside the JSON.
5. Confirm no URL-encoded JSON punctuation (%22, %5B, %5D, %7B, %7D) is used as structure.
6. Confirm every URL field is a plain string beginning exactly with https:// and contains only the direct URL.
7. Confirm every ID exactly matches the injected catalog or stored program IDs.
8. Confirm every required array and required field exists and uses the correct JSON type.
9. Confirm no duplicate record keys exist.
10. Confirm all counts, ratios, totals and dates are internally consistent.
Repair every failure before sending.`;
}

function resolveCategoryBody(library, template, cards, date = new Date(), database = null) {
  if (!template || typeof template !== "object") throw new Error("The selected prompt template is unavailable. Reload defaults or choose another template.");
  const selectedCards = filterCards(cards, template.filter);
  const content = effectiveTemplateContent(library || {}, template);
  const today = date.toISOString().slice(0, 10);
  const summary = database ? databaseSummary(database, selectedCards, sourcePolicyForTemplate(template)) : {};
  const resolved = content
    .replaceAll("{{TODAY}}", today)
    .replaceAll("{{SCOPE_INSTRUCTION}}", template.scopeInstruction || "Research the cards in the injected catalog.")
    .replaceAll("{{ACTIVE_CARD_CATALOG}}", JSON.stringify(catalogForPrompt(selectedCards), null, 2))
    .replaceAll("{{CURRENT_DATABASE_SUMMARY}}", JSON.stringify(summary, null, 2));
  return `${resolved}

FINAL HARD CONTRACT — OVERRIDES ANY CONFLICTING EARLIER OUTPUT INSTRUCTION
${schemaContractForTemplate(template)}

${sourcePolicyContract(template)}

${commonJsonRules()}`;
}

export function resolvePrompt(library, template, cards, date = new Date(), database = null) {
  return resolveCategoryBody(library, template, cards, date, database);
}

export function resolvePromptVariant(library, template, cards, date = new Date(), database = null, options = {}) {
  const workflow = options.workflow === "two-step" ? "two-step" : "one-step";
  const provider = options.provider === "gemini" ? "gemini" : "chatgpt";
  const stage = options.stage === "json" ? "json" : "research";
  const body = resolveCategoryBody(library, template, cards, date, database);
  if (workflow === "one-step") {
    return `${oneStepContract(provider)}

CATEGORY, SCOPE AND SCHEMA
${body}

${finalAuditContract()}

FINAL COMMAND
Perform the research now and return the complete category object in exactly one json code block.`;
  }
  if (stage === "json") {
    return `${twoStepJsonContract(provider)}

CATEGORY, SCOPE AND SCHEMA
${body}

${finalAuditContract()}

FINAL COMMAND
Convert the completed Step 1 evidence into the complete category object now and return it in exactly one json code block.`;
  }
  return `${twoStepResearchContract(provider)}

CATEGORY, SCOPE AND LATER JSON SCHEMA
${body}

STEP 1 FINAL COMMAND
Produce the structured evidence ledger now. Do not return the final JSON until Step 2.`;
}

export function resolveRepairPromptVariant(library, template, cards, date = new Date(), database = null, options = {}) {
  const provider = options.provider === "gemini" ? "gemini" : "chatgpt";
  const platform = provider === "gemini" ? "Gemini" : "ChatGPT";
  const body = resolveCategoryBody(library, template, cards, date, database);
  return `CARDTRACK JSON REPAIR PROMPT — ${platform.toUpperCase()}

Use this in the SAME conversation after a response fails CardTrack parsing or validation.
Do not redo the research except to replace a missing, wrapped, redirected or unapproved source URL.
Rebuild the entire response from the already completed research; do not patch fragments.

REPAIR THE FOLLOWING COMMON FAILURES
- prose or a report instead of the required object
- missing catalog, schema or required arrays
- Markdown links inside names, notes, summaries, conditions or URL fields
- Google/Gemini grounding links, ChatGPT citation wrappers, redirects or search-result URLs
- URL-encoded JSON structure such as %22, %5B, %5D, %7B or %7D
- missing commas, trailing commas, comments, smart quotes, truncated arrays or unescaped quotation marks
- a URL stored as an array instead of a string
- invalid IDs, duplicate IDs, wrong types, missing timestamps or counts

${outputTransportContract()}

CATEGORY, SCOPE AND SCHEMA
${body}

${finalAuditContract()}

FINAL COMMAND
Return the fully rebuilt and corrected complete category object now in exactly one json code block. No explanation.`;
}

export function promptVariantLabel(options = {}) {
  const workflow = options.workflow === "two-step" ? "two-step" : "one-step";
  const provider = options.provider === "gemini" ? "gemini" : "chatgpt";
  const stage = options.stage === "json" ? "json" : "research";
  const platform = provider === "gemini" ? (workflow === "two-step" ? "Gemini Deep Research" : "Gemini with Google Search") : (workflow === "two-step" ? "ChatGPT Deep Research" : "ChatGPT Search");
  if (workflow === "one-step") return `${platform} · One-step JSON code block`;
  return `${platform} · ${stage === "json" ? "Step 2 JSON conversion" : "Step 1 evidence ledger"}`;
}

export function promptPreflight(text) {
  const unresolved = [...new Set(String(text || "").match(/\{\{[A-Z0-9_]+\}\}/g) || [])];
  const checks = {
    valid: unresolved.length === 0,
    unresolved,
    hasCatalog: /"cardId"\s*:\s*"/.test(text),
    hasSchema: /FINAL CARDTRACK SCHEMA/.test(text),
    hasSourcePolicy: /APPROVED DOMAINS/.test(text),
    hasTransport: /exactly one fenced code block labeled json/.test(text),
    hasParseAudit: /JSON\.parse/.test(text)
  };
  checks.valid = checks.valid && checks.hasCatalog && checks.hasSchema && checks.hasSourcePolicy && checks.hasParseAudit;
  return checks;
}

export function migratePromptLibrary(saved, defaults) {
  const base = clone(defaults);
  const changes = [];
  if (!saved || typeof saved !== "object") return {library: base, migrated: true, changes: ["Default prompt library restored"]};
  const savedById = new Map((saved.templates || []).map((item) => [item.id, item]));
  base.templates = base.templates.map((template) => {
    const prior = savedById.get(template.id);
    if (!prior) { changes.push(`Added template ${template.id}`); return template; }
    return {...template, customPrompt: prior.customPrompt ?? null};
  });
  const extra = (saved.templates || []).filter((item) => !base.templates.some((template) => template.id === item.id));
  base.templates.push(...extra);
  base.defaultTemplateId = saved.defaultTemplateId && base.templates.some((item) => item.id === saved.defaultTemplateId) ? saved.defaultTemplateId : base.defaultTemplateId;
  base.updatedAt = saved.updatedAt || base.updatedAt;
  base.lastSavedToGitHubAt = saved.lastSavedToGitHubAt || null;
  if (saved.schemaVersion !== base.schemaVersion) changes.push(`Prompt schema upgraded to ${base.schemaVersion}`);
  if (saved.transportVersion !== base.transportVersion) changes.push(`Prompt transport upgraded to ${base.transportVersion}`);
  return {library: base, migrated: changes.length > 0, changes};
}

export function validatePromptLibrary(library) {
  const errors = [];
  if (!library || typeof library !== "object" || Array.isArray(library)) return {valid: false, errors: ["Prompt library must be an object."]};
  if (![1, 2, 3, 4].includes(library.schemaVersion)) errors.push("Prompt library schemaVersion must equal 1, 2, 3, or 4.");
  if (library.transportVersion !== undefined && (!Number.isInteger(library.transportVersion) || library.transportVersion < 1)) errors.push("transportVersion must be a positive integer.");
  if (library.lastSavedToGitHubAt !== null && library.lastSavedToGitHubAt !== undefined && Number.isNaN(Date.parse(library.lastSavedToGitHubAt))) errors.push("lastSavedToGitHubAt must be an ISO timestamp or null.");
  if (!Array.isArray(library.templates) || !library.templates.length) errors.push("templates must be a non-empty array.");
  const ids = new Set();
  (library.templates || []).forEach((template, index) => {
    const p = `templates[${index}]`;
    if (!template || typeof template !== "object" || Array.isArray(template)) return errors.push(`${p} must be an object.`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(template.id || "")) errors.push(`${p}.id must be a lowercase slug.`);
    if (ids.has(template.id)) errors.push(`Duplicate template id '${template.id}'.`);
    ids.add(template.id);
    if (typeof template.name !== "string" || !template.name.trim()) errors.push(`${p}.name is required.`);
    if (typeof template.description !== "string") errors.push(`${p}.description must be text.`);
    if (!template.filter || typeof template.filter !== "object") errors.push(`${p}.filter is required.`);
    if (typeof template.scopeInstruction !== "string" || !template.scopeInstruction.trim()) errors.push(`${p}.scopeInstruction is required.`);
    if (template.sourcePolicy !== undefined && !VALID_SOURCE_POLICIES.has(template.sourcePolicy)) errors.push(`${p}.sourcePolicy is not allowed.`);
    if (template.customPrompt !== null && typeof template.customPrompt !== "string") errors.push(`${p}.customPrompt must be text or null.`);
    const content = effectiveTemplateContent(library, template);
    if (!content.includes("{{ACTIVE_CARD_CATALOG}}")) errors.push(`${p} prompt must include {{ACTIVE_CARD_CATALOG}}.`);
    if (!content.includes("{{TODAY}}")) errors.push(`${p} prompt must include {{TODAY}}.`);
  });
  if (!ids.has(library.defaultTemplateId)) errors.push("defaultTemplateId must match a template id.");
  return {valid: errors.length === 0, errors};
}

export function updateTemplateContent(library, templateId, content) {
  const next = clone(library);
  const template = next.templates.find((item) => item.id === templateId);
  if (!template) throw new Error(`Unknown template '${templateId}'.`);
  template.customPrompt = content;
  next.updatedAt = new Date().toISOString();
  return next;
}

export function restoreTemplateDefault(library, templateId) {
  const next = clone(library);
  const template = next.templates.find((item) => item.id === templateId);
  if (!template) throw new Error(`Unknown template '${templateId}'.`);
  template.customPrompt = null;
  next.updatedAt = new Date().toISOString();
  return next;
}
