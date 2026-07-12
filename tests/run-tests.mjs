import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {
  APP_VERSION,
  SOURCE_POLICY_DOMAINS,
  approvedSourceUrl,
  applySectionImport,
  effectiveStatus,
  estimateFirstYearValue,
  migrateDatabase,
  normalizeApprovedSourceUrl,
  parseResearchJson,
  validateDatabase,
  validateSectionPayload,
  valueTier
} from "../site/lib/schema.mjs";
import {
  filterCards,
  migratePromptLibrary,
  promptPreflight,
  promptVariantLabel,
  resolvePrompt,
  resolvePromptVariant,
  resolveRepairPromptVariant,
  restoreTemplateDefault,
  updateTemplateContent,
  validatePromptLibrary
} from "../site/lib/prompts.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const savedDatabase = JSON.parse(await fs.readFile(path.join(root, "site/data/cardtrack.json"), "utf8"));
const database = migrateDatabase(savedDatabase).database;
const savedPrompts = JSON.parse(await fs.readFile(path.join(root, "site/data/prompts.json"), "utf8"));
const defaults = JSON.parse(await fs.readFile(path.join(root, "site/data/default-prompts.json"), "utf8"));
const prompts = migratePromptLibrary(savedPrompts, defaults).library;
const valuations = JSON.parse(await fs.readFile(path.join(root, "site/data/tpg-valuations.json"), "utf8"));
const appSource = await fs.readFile(path.join(root, "site/app.js"), "utf8");
const cssSource = await fs.readFile(path.join(root, "site/styles.css"), "utf8");
let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}\n${error.stack}`); process.exitCode = 1; }
}

const card = database.cards.find((item) => item.id === "chase-sapphire-preferred");
const baseOffer = {
  cardId: card.id, bonusAmount: 100000, bonusUnit: "points", channel: "public",
  spendRequirement: 5000, spendPeriodMonths: 3, annualFee: 95,
  annualFeeWaivedFirstYear: false, status: "limited", expirationDate: null,
  lastVerifiedAt: "2026-07-10T12:00:00Z", confidence: "high", note: "Limited-time offer; no supported end date was found.",
  sources: [{name: "Chase", url: "https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred", sourceType: "issuer"}]
};
const fact = {
  cardId: card.id, foreignTransactionFee: 0,
  earnRates: [{category: "Dining", rate: 3, unit: "x", cap: null, notes: null}],
  credits: [{benefitId: "hotel-credit", name: "Hotel credit", category: "travel", faceValueAnnual: 50, frequency: "annual", amountPerPeriod: 50, firstYearOnly: false, enrollmentRequired: false, conditions: "Issuer portal booking", estimatedUtilization: 1, sourceUrl: "https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred"}],
  perks: [], protections: [], loungeAccess: [], statusBenefits: [], airlineBenefits: [], hotelBenefits: [],
  lastVerifiedAt: "2026-07-10T12:00:00Z",
  sources: [{name: "Chase", url: "https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred", sourceType: "issuer"}]
};
const program = {
  programId: "chase-ultimate-rewards", programName: "Chase Ultimate Rewards", cards: [card.id],
  partners: [{partnerId: "world-of-hyatt", partnerName: "World of Hyatt", partnerType: "hotel", sourceRatio: 1, destinationRatio: 1, ratioDisplay: "1:1", notes: null, lastVerifiedAt: "2026-07-10T12:00:00Z", sources: [{name: "Chase transfer partners", url: "https://www.chase.com/personal/credit-cards/education/rewards-benefits/chase-transfer-partners", sourceType: "issuer"}]}]
};
const bonus = {
  transferBonusId: "chase-hyatt-test", sourceProgramId: "chase-ultimate-rewards", destinationProgramId: "world-of-hyatt", destinationProgramName: "World of Hyatt", bonusPercent: 20, standardRatio: "1:1", effectiveRatio: "1:1.2", publicOrTargeted: "public", startDate: "2026-07-01", endDate: "2026-12-31", enrollmentRequired: false, note: "Test bonus", lastVerifiedAt: "2026-07-10T12:00:00Z", sources: [{name: "Chase", url: "https://www.chase.com/", sourceType: "issuer"}]
};

await test("app version is v5.2.5", () => assert.equal(APP_VERSION, "5.2.5"));
await test("saved v5 database validates", () => assert.equal(validateDatabase(database, {rejectExpired: false}).valid, true));
await test("prompt library validates", () => assert.equal(validatePromptLibrary(prompts).valid, true));
await test("default library has required feature prompts", () => {
  const ids = new Set(defaults.templates.map((item) => item.id));
  for (const id of ["full-data-refresh", "full-catalog", "card-facts", "transfer-partners", "transfer-bonuses", "tpg-valuations", "american-express", "chase", "hotels", "airlines"]) assert.ok(ids.has(id));
});
await test("valuation snapshot validates", () => assert.equal(validateSectionPayload(valuations, database, {type: "valuations"}).valid, true));

await test("prompt library schema supports workflow metadata", () => {
  assert.equal(defaults.schemaVersion, 4);
  assert.equal(defaults.transportVersion, 2);
  assert.ok(Object.hasOwn(defaults, "lastSavedToGitHubAt"));
});
await test("one-step ChatGPT prompt requests Search and fenced JSON transport", () => {
  const template = prompts.templates.find((item) => item.id === "full-catalog");
  const resolved = resolvePromptVariant(prompts, template, database.cards, new Date("2026-07-11T12:00:00Z"), database, {workflow: "one-step", provider: "chatgpt", stage: "json"});
  assert.match(resolved, /normal ChatGPT chat with Search enabled/);
  assert.match(resolved, /exactly one fenced code block labeled json/);
  assert.match(resolved, /JSON\.parse/);
  assert.match(resolved, /chase-sapphire-preferred/);
});
await test("one-step Gemini prompt is provider-specific", () => {
  const template = prompts.templates.find((item) => item.id === "card-facts");
  const resolved = resolvePromptVariant(prompts, template, database.cards, new Date("2026-07-11T12:00:00Z"), database, {workflow: "one-step", provider: "gemini", stage: "json"});
  assert.match(resolved, /normal Gemini chat with Google Search/);
  assert.match(resolved, /Do NOT use Gemini Deep Research/);
});
await test("two-step deep research has separate evidence and JSON prompts", () => {
  const template = prompts.templates.find((item) => item.id === "transfer-partners");
  const research = resolvePromptVariant(prompts, template, database.cards, new Date("2026-07-11T12:00:00Z"), database, {workflow: "two-step", provider: "chatgpt", stage: "research"});
  const json = resolvePromptVariant(prompts, template, database.cards, new Date("2026-07-11T12:00:00Z"), database, {workflow: "two-step", provider: "chatgpt", stage: "json"});
  assert.match(research, /STEP 1 OF 2/);
  assert.match(research, /structured evidence ledger/);
  assert.match(json, /STEP 2 OF 2/);
  assert.match(json, /SAME ChatGPT Deep Research conversation/);
  assert.match(json, /exactly one fenced code block labeled json/);
});
await test("newly added active cards appear in every resolved prompt", () => {
  const cards = structuredClone(database.cards);
  cards.push({id: "new-test-card", name: "New Test Card", issuer: "Test Bank", program: "Test Rewards", annualFee: 0, baselineOffer: 0, historicalHigh: null, bonusUnit: "points", applyUrl: "https://example.com", isArchived: false, archivedAt: null});
  const template = prompts.templates.find((item) => item.id === "full-catalog");
  const resolved = resolvePromptVariant(prompts, template, cards, new Date("2026-07-11T12:00:00Z"), {...database, cards}, {workflow: "one-step", provider: "chatgpt"});
  assert.match(resolved, /new-test-card/);
});
await test("prompt variant labels identify workflow and platform", () => {
  assert.match(promptVariantLabel({workflow: "one-step", provider: "gemini"}), /Gemini/);
  assert.match(promptVariantLabel({workflow: "two-step", provider: "chatgpt", stage: "json"}), /Step 2 JSON conversion/);
});
await test("legacy v3 database migrates to v5", () => {
  const legacy = structuredClone(database); legacy.schemaVersion = 3; delete legacy.cardDetails; delete legacy.transferPrograms; delete legacy.transferBonuses; delete legacy.compatibilityVersion;
  for (const item of legacy.cards) { delete item.archivedAt; delete item.isArchived; }
  const migrated = migrateDatabase(legacy);
  assert.equal(migrated.database.schemaVersion, 5);
  assert.deepEqual(migrated.database.cardDetails, []);
  assert.deepEqual(migrated.database.transferPrograms, []);
  assert.deepEqual(migrated.database.transferBonuses, []);
  assert.equal(validateDatabase(migrated.database, {rejectExpired: false}).valid, true);
});
await test("fenced JSON parses", () => assert.deepEqual(parseResearchJson('```json\n{"offers":[]}\n```'), {offers: []}));
await test("welcome offer import validates", () => assert.equal(validateSectionPayload({schemaVersion: 5, dataType: "offers", offers: [baseOffer]}, database).valid, true));
await test("unknown offer card is rejected", () => {
  const result = validateSectionPayload({dataType: "offers", offers: [{...baseOffer, cardId: "not-in-catalog"}]}, database);
  assert.match(result.errors.join(" "), /not in the active catalog/);
});
await test("card fact import validates", () => assert.equal(validateSectionPayload({schemaVersion: 5, dataType: "cardDetails", cardDetails: [fact]}, database).valid, true));
await test("category-specific source policies accept official fact and loyalty domains", () => {
  assert.equal(approvedSourceUrl("https://www.marriott.com/credit-cards.mi", "cardDetails"), true);
  assert.equal(approvedSourceUrl("https://world.hyatt.com/content/gp/en/rewards.html", "transferPrograms"), true);
  assert.equal(approvedSourceUrl("https://www.delta.com/us/en/skymiles/overview", "transferBonuses"), true);
  assert.equal(approvedSourceUrl("https://thepointsguy.com/loyalty-programs/monthly-valuations/", "valuations"), true);
  assert.ok(SOURCE_POLICY_DOMAINS.cardDetails.includes("prioritypass.com"));
});
await test("welcome offers remain restricted to approved issuer and editorial domains", () => {
  assert.equal(approvedSourceUrl("https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred", "offers"), true);
  assert.equal(approvedSourceUrl("https://www.marriott.com/credit-cards.mi", "offers"), false);
  assert.equal(approvedSourceUrl("https://www.google.com/url?q=https://www.chase.com/", "offers"), true);
  assert.equal(approvedSourceUrl("https://www.google.com/url?q=https://www.marriott.com/credit-cards.mi", "offers"), false);
});
await test("card fact import accepts official benefit-provider sources", () => {
  const officialFact = structuredClone(fact);
  officialFact.sources = [{name: "Priority Pass", url: "https://www.prioritypass.com/", sourceType: "benefit-provider"}];
  officialFact.loungeAccess = [{name: "Priority Pass", summary: "Membership terms", sourceUrl: "https://www.prioritypass.com/", isTopBenefit: true, isUniqueBenefit: false, displayOrder: 1}];
  assert.equal(validateSectionPayload({schemaVersion: 5, dataType: "cardDetails", cardDetails: [officialFact]}, database).valid, true);
});
await test("Google redirect URLs are normalized to approved direct sources", () => {
  const redirected = "https://www.google.com/url?sa=t&url=https%3A%2F%2Fwww.chase.com%2Fpersonal%2Fcredit-cards%2Feducation%2Frewards-benefits%2Fchase-transfer-partners&utm_source=test";
  assert.equal(normalizeApprovedSourceUrl(redirected, "cardDetails"), "https://www.chase.com/personal/credit-cards/education/rewards-benefits/chase-transfer-partners");
  const redirectedFact = structuredClone(fact);
  redirectedFact.sources = [{name: "Chase", url: redirected, sourceType: "issuer"}];
  const result = validateSectionPayload({schemaVersion: 5, dataType: "cardDetails", cardDetails: [redirectedFact]}, database);
  assert.equal(result.valid, true);
  assert.equal(result.accepted[0].sources[0].url, "https://www.chase.com/personal/credit-cards/education/rewards-benefits/chase-transfer-partners");
});
await test("unapproved source URLs include host and supplied URL diagnostics", () => {
  const badFact = structuredClone(fact);
  badFact.sources = [{name: "Unsupported", url: "https://example.invalid/card-benefits", sourceType: "news"}];
  const result = validateSectionPayload({schemaVersion: 5, dataType: "cardDetails", cardDetails: [badFact]}, database);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /card facts and benefits/);
  assert.match(result.errors.join(" "), /example.invalid/);
  assert.match(result.errors.join(" "), /Supplied URL/);
});

await test("invalid fact card is rejected", () => {
  const result = validateSectionPayload({dataType: "cardDetails", cardDetails: [{...fact, cardId: "nope"}]}, database);
  assert.match(result.errors.join(" "), /not in the catalog/);
});
await test("transfer program import validates", () => assert.equal(validateSectionPayload({dataType: "transferPrograms", transferPrograms: [program]}, database).valid, true));
await test("transfer bonus validates after program import", () => {
  const withProgram = applySectionImport(database, validateSectionPayload({dataType: "transferPrograms", transferPrograms: [program]}, database), "merge");
  assert.equal(validateSectionPayload({dataType: "transferBonuses", transferBonuses: [bonus]}, withProgram).valid, true);
});
await test("section merge preserves unrelated data", () => {
  const beforeDetails = structuredClone(database.cardDetails || []);
  const validation = validateSectionPayload({dataType: "cardDetails", cardDetails: [fact]}, database);
  const next = applySectionImport(database, validation, "merge");
  const expectedIds = new Set(beforeDetails.map((item) => item.cardId));
  expectedIds.add(fact.cardId);
  assert.equal(next.offers.length, database.offers.length);
  assert.deepEqual(next.transferPrograms, database.transferPrograms || []);
  assert.deepEqual(next.transferBonuses, database.transferBonuses || []);
  assert.equal(next.cardDetails.length, expectedIds.size);
  assert.deepEqual(next.cardDetails.find((item) => item.cardId === fact.cardId), fact);
  for (const item of beforeDetails.filter((entry) => entry.cardId !== fact.cardId)) {
    assert.deepEqual(next.cardDetails.find((entry) => entry.cardId === item.cardId), item);
  }
});
await test("legacy data arrays are initialized before section merge", () => {
  const legacy = structuredClone(savedDatabase);
  delete legacy.cardDetails;
  delete legacy.transferPrograms;
  delete legacy.transferBonuses;
  const validation = validateSectionPayload({dataType: "cardDetails", cardDetails: [fact]}, migrateDatabase(legacy).database);
  const next = applySectionImport(legacy, validation, "merge");
  assert.equal(next.cardDetails.length, 1);
  assert.deepEqual(next.transferPrograms, []);
  assert.deepEqual(next.transferBonuses, []);
});
await test("legacy prompt library resolves added default templates", () => {
  const legacyPrompts = structuredClone(savedPrompts);
  legacyPrompts.templates = (legacyPrompts.templates || []).filter((item) => item.id !== "card-facts");
  const migrated = migratePromptLibrary(legacyPrompts, defaults).library;
  const template = migrated.templates.find((item) => item.id === "card-facts");
  const resolved = resolvePrompt(migrated, template, database.cards, new Date("2026-07-11T12:00:00Z"), database);
  assert.match(resolved, /2026-07-11/);
});
await test("offer status elevates above baseline", () => assert.equal(effectiveStatus({...baseOffer, status: "standard"}, card), "elevated"));
await test("limited status takes priority", () => assert.equal(effectiveStatus(baseOffer, card), "limited"));
await test("first-year value uses credits and fee", () => {
  const value = estimateFirstYearValue(card, baseOffer, fact, valuations.programs[card.program]);
  assert.ok(Math.abs(value.bonusValue - 2050) < 1e-9);
  assert.equal(value.creditValue, 50);
  assert.ok(Math.abs(value.total - 2005) < 1e-9);
});
await test("value tiers are deterministic", () => { assert.equal(valueTier(1600), "Platinum"); assert.equal(valueTier(1100), "Gold"); assert.equal(valueTier(700), "Silver"); assert.equal(valueTier(100), "Bronze"); });
await test("prompt migration preserves custom text and adds defaults", () => {
  const saved = structuredClone(prompts); saved.templates = saved.templates.slice(0, 2); saved.templates[0].customPrompt = `${saved.templates[0].defaultPrompt}\nCUSTOM`;
  const migrated = migratePromptLibrary(saved, defaults).library;
  assert.equal(migrated.templates.length, defaults.templates.length);
  assert.match(migrated.templates.find((item) => item.id === saved.templates[0].id).customPrompt, /CUSTOM/);
});
await test("resolved prompt injects date catalog and current data", () => {
  const template = prompts.templates.find((item) => item.id === "card-facts");
  const resolved = resolvePrompt(prompts, template, database.cards, new Date("2026-07-11T12:00:00Z"), database);
  assert.match(resolved, /2026-07-11/);
  assert.match(resolved, /chase-sapphire-preferred/);
  assert.doesNotMatch(resolved, /\{\{ACTIVE_CARD_CATALOG\}\}/);
  assert.doesNotMatch(resolved, /\{\{CURRENT_DATABASE_SUMMARY\}\}/);
});
await test("Amex and Chase filters work", () => {
  const amex = prompts.templates.find((item) => item.id === "american-express");
  const chase = prompts.templates.find((item) => item.id === "chase");
  assert.ok(filterCards(database.cards, amex.filter).every((item) => item.issuer === "American Express"));
  assert.ok(filterCards(database.cards, chase.filter).every((item) => item.issuer === "Chase"));
});
await test("custom prompt edit and restore work", () => {
  const changed = updateTemplateContent(prompts, "full-catalog", `${prompts.templates.find((item) => item.id === "full-catalog").defaultPrompt}\nCUSTOM`);
  assert.match(changed.templates.find((item) => item.id === "full-catalog").customPrompt, /CUSTOM/);
  const restored = restoreTemplateDefault(changed, "full-catalog");
  assert.equal(restored.templates.find((item) => item.id === "full-catalog").customPrompt, null);
});
await test("app contains all requested tabs", () => {
  for (const label of ["Transfer Bonuses", "Transfer Partners", "Fact Sheets", "Compare", "Admin Publisher"]) assert.match(appSource, new RegExp(label));
});
await test("app supports section import and GitHub valuation publishing", () => {
  assert.match(appSource, /validateSectionPayload/);
  assert.match(appSource, /save-valuations/);
  assert.match(appSource, /applySectionImport/);
});
await test("KPI cards have distinct backgrounds", () => {
  for (const cls of ["kpi-blue", "kpi-green", "kpi-purple", "kpi-amber"]) assert.match(cssSource, new RegExp(`\\.${cls}`));
});
await test("offer rows rotate four background shades", () => {
  for (const i of [0,1,2,3]) assert.match(cssSource, new RegExp(`\\.row-shade-${i}`));
});
await test("promotion badges are larger and flash", () => {
  assert.match(cssSource, /\.badge-large/);
  assert.match(cssSource, /@keyframes badgeFlash/);
  assert.match(cssSource, /prefers-reduced-motion/);
});
await test("header remains normal flow and table header is contained", () => {
  assert.match(cssSource, /\.site-header \{ position:relative/);
  assert.match(cssSource, /\.offer-table thead \{ position:sticky/);
});

await test("prompt manager exposes category workflow provider and step controls", () => {
  for (const text of ["1-Step · Regular Search", "2-Step · Deep Research", "ChatGPT", "Gemini", "Step 1 · Evidence Ledger", "Step 2 · JSON Conversion", "Copy JSON Repair Prompt"]) assert.ok(appSource.includes(text));
});
await test("prompt library shows GitHub save time and dynamic card update notice", () => {
  assert.match(appSource, /Last saved to GitHub/);
  assert.match(appSource, /Every resolved research prompt now includes this active card automatically/);
  assert.match(appSource, /lastSavedToGitHubAt/);
});
await test("theme toggle and yellow saved-template styling are present", () => {
  assert.match(appSource, /theme-toggle/);
  assert.match(appSource, /☀️/);
  assert.match(appSource, /🌙/);
  assert.match(cssSource, /\.saved-template-select/);
  assert.match(cssSource, /#fff6c7/);
});


await test("navigation tabs are individually dark color coded", () => {
  assert.match(appSource, /tab-\$\{id\}/);
  for (const cls of ["tab-offers", "tab-transfer-bonuses", "tab-transfer-partners", "tab-fact-sheets", "tab-compare", "tab-archived", "tab-admin", "tab-methodology"]) {
    assert.match(cssSource, new RegExp(`\.${cls}`));
  }
});
await test("credit-card emoji favicon and bookmark title are present", async () => {
  const html = await fs.readFile(path.join(root, "site/index.html"), "utf8");
  const favicon = await fs.readFile(path.join(root, "site/favicon.svg"), "utf8");
  assert.match(html, /💳 CardTrack/);
  assert.match(html, /favicon\.svg/);
  assert.match(favicon, /💳/);
});
await test("Admin Publisher sections have distinct background shades", () => {
  for (const cls of ["admin-panel-import", "admin-panel-add", "admin-panel-manage", "admin-panel-publish"]) {
    assert.match(appSource, new RegExp(cls));
    assert.match(cssSource, new RegExp(`\.${cls}`));
  }
});
await test("transfer bonuses show explicit expiration dates", () => {
  assert.match(appSource, /Expiration date/);
  assert.match(appSource, /transfer-expiration/);
  assert.match(appSource, /Expires \$/);
});
await test("fact sheets list all benefits and prioritize top unique items", () => {
  assert.match(appSource, /factBenefitRecords/);
  assert.match(appSource, /Top & unique benefits/);
  assert.match(appSource, /Other verified benefits/);
  assert.doesNotMatch(appSource, /\.slice\(0, 7\)/);
  assert.match(appSource, /isTopBenefit/);
  assert.match(appSource, /isUniqueBenefit/);
  assert.match(appSource, /fact-badges/);
});
await test("Card Facts prompt requests complete benefit inventories", () => {
  const template = defaults.templates.find((item) => item.id === "card-facts");
  const resolved = resolvePromptVariant(prompts, template, database.cards, new Date("2026-07-11T12:00:00Z"), database, {workflow: "one-step", provider: "chatgpt"});
  assert.match(template.defaultPrompt, /every currently verified recurring card fact and benefit/i);
  assert.match(resolved, /isTopBenefit/);
  assert.match(resolved, /isUniqueBenefit/);
  assert.match(resolved, /displayOrder/);
  assert.match(resolved, /Do not add estimatedAnnualValue to protections/);
});
await test("resolved prompts include category-specific approved-domain rules", () => {
  const factTemplate = prompts.templates.find((item) => item.id === "card-facts");
  const factPrompt = resolvePromptVariant(prompts, factTemplate, database.cards, new Date("2026-07-11T12:00:00Z"), database, {workflow: "one-step", provider: "chatgpt"});
  assert.match(factPrompt, /APPROVED DOMAINS FOR CARD FACTS AND BENEFITS/);
  assert.match(factPrompt, /marriott\.com/);
  assert.match(factPrompt, /prioritypass\.com/);
  const offerTemplate = prompts.templates.find((item) => item.id === "full-catalog");
  const offerPrompt = resolvePromptVariant(prompts, offerTemplate, database.cards, new Date("2026-07-11T12:00:00Z"), database, {workflow: "one-step", provider: "gemini"});
  assert.match(offerPrompt, /APPROVED DOMAINS FOR WELCOME OFFERS/);
  assert.doesNotMatch(offerPrompt, /prioritypass\.com/);
});
await test("Current Offers KPI cards are clickable filters", () => {
  assert.match(appSource, /data-action="filter-kpi"/);
  assert.match(appSource, /state\.kpiFilter === "promotional"/);
  assert.match(appSource, /state\.kpiFilter === "review"/);
  assert.match(cssSource, /\.kpi-button\.selected/);
});

await test("versioned asset URLs prevent stale browser modules", async () => {
  const indexSource = await fs.readFile(path.join(root, "site/index.html"), "utf8");
  assert.match(indexSource, /app\.js\?v=5\.2\.5/);
  assert.match(indexSource, /styles\.css\?v=5\.2\.5/);
  assert.match(appSource, /schema\.mjs\?v=5\.2\.5/);
  assert.match(appSource, /prompts\.mjs\?v=5\.2\.5/);
});


await test("parser extracts JSON from a fenced block surrounded by prose", () => {
  const parsed = parseResearchJson("Here is the result:\n```json\n{\"dataType\":\"offers\",\"offers\":[]}\n```\nDone");
  assert.deepEqual(parsed, {dataType: "offers", offers: []});
});
await test("parser gives targeted error for encoded JSON punctuation", () => {
  assert.throws(() => parseResearchJson('{%22schemaVersion%22:5}'), /URL-encoded JSON punctuation/);
});
await test("parser gives targeted error for malformed Markdown links", () => {
  assert.throws(() => parseResearchJson('{"name":"[Atmos](https://example.com)"'), /Markdown-wrapped links|could not be parsed/);
});
await test("card facts reject Markdown links in plain-text fields", () => {
  const bad = structuredClone(fact);
  bad.credits[0].name = "[Hotel credit](https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred)";
  const result = validateSectionPayload({schemaVersion: 5, dataType: "cardDetails", cardDetails: [bad]}, database);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /plain text and may not contain a Markdown link/);
});
await test("repair prompt covers all observed output failures", () => {
  const template = prompts.templates.find((item) => item.id === "card-facts");
  const repair = resolveRepairPromptVariant(prompts, template, database.cards, new Date("2026-07-11T12:00:00Z"), database, {provider: "gemini"});
  for (const pattern of [/Markdown links/, /URL-encoded JSON structure/, /missing commas/, /exactly one fenced code block/, /vertexaisearch/, /JSON\.parse/]) assert.match(repair, pattern);
});
await test("prompt manager displays transport preflight and repair controls", () => {
  assert.match(appSource, /Prompt preflight/);
  assert.match(appSource, /Reliable copy\/paste format/);
  assert.match(appSource, /copy-repair-prompt/);
  assert.match(cssSource, /\.prompt-preflight/);
  assert.match(cssSource, /\.transport-notice/);
});
await test("representative fenced welcome-offer output parses and validates", () => {
  const payload = {schemaVersion: 5, dataType: "offers", offers: [baseOffer], errors: [], validation: {acceptedCount: 1, rejectedCount: 0}};
  const parsed = parseResearchJson(`\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``);
  assert.equal(validateSectionPayload(parsed, database).valid, true);
});
await test("representative fenced card-facts output parses and validates", () => {
  const payload = {schemaVersion: 5, dataType: "cardDetails", generatedAt: "2026-07-11T12:00:00Z", cardDetails: [fact], errors: []};
  const parsed = parseResearchJson(`\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``);
  assert.equal(validateSectionPayload(parsed, database).valid, true);
});
await test("representative fenced transfer-program output parses and validates", () => {
  const payload = {schemaVersion: 5, dataType: "transferPrograms", generatedAt: "2026-07-11T12:00:00Z", transferPrograms: [program], errors: []};
  const parsed = parseResearchJson(`\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``);
  assert.equal(validateSectionPayload(parsed, database).valid, true);
});
await test("representative fenced transfer-bonus output parses and validates", () => {
  const withProgram = applySectionImport(database, validateSectionPayload({dataType: "transferPrograms", transferPrograms: [program]}, database), "merge");
  const payload = {schemaVersion: 5, dataType: "transferBonuses", generatedAt: "2026-07-11T12:00:00Z", transferBonuses: [bonus], errors: []};
  const parsed = parseResearchJson(`\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``);
  assert.equal(validateSectionPayload(parsed, withProgram).valid, true);
});
await test("representative fenced valuation output parses and validates", () => {
  const parsed = parseResearchJson(`\`\`\`json\n${JSON.stringify(valuations)}\n\`\`\``);
  assert.equal(validateSectionPayload(parsed, database, {type: "valuations"}).valid, true);
});
await test("prompt library migration upgrades transport metadata", () => {
  const legacy = structuredClone(savedPrompts);
  legacy.schemaVersion = 3;
  delete legacy.transportVersion;
  const migrated = migratePromptLibrary(legacy, defaults);
  assert.equal(migrated.library.schemaVersion, 4);
  assert.equal(migrated.library.transportVersion, 2);
  assert.match(migrated.changes.join(" "), /transport upgraded/);
});


await test("Clear Import resets import type to Auto-detect", () => {
  assert.match(appSource, /action === "clear-import"[\s\S]*state\.importType = "auto"/);
  assert.match(appSource, /Import type reset to Auto-detect/);
});
await test("Prompt Manager JSON tester has a complete Clear workflow", () => {
  assert.match(appSource, /data-action="clear-prompt-test"/);
  assert.match(appSource, /action === "clear-prompt-test"[\s\S]*state\.promptTestText = ""[\s\S]*state\.promptTestPayload = null[\s\S]*state\.promptTestResult = null/);
});
await test("GitHub token inputs use the light-blue token class", () => {
  assert.match(appSource, /id="github-token" class="token-input"/);
  assert.match(appSource, /id="prompt-github-token" class="token-input"/);
  assert.match(cssSource, /\.token-input \{ background:#e8f4ff/);
});
await test("Current Offers card names navigate to matching Fact Sheets", () => {
  assert.match(appSource, /data-action="open-fact-sheet"/);
  assert.match(appSource, /id="fact-sheet-\$\{escapeHtml\(card\.id\)\}"/);
  assert.match(appSource, /scrollIntoView/);
  assert.match(cssSource, /\.fact-card-focus/);
});
await test("Card facts survive JSON serialization and database reload", () => {
  const validation = validateSectionPayload({dataType: "cardDetails", cardDetails: [fact]}, database);
  const staged = applySectionImport(database, validation, "merge");
  const committedText = JSON.stringify(staged, null, 2);
  const reloaded = migrateDatabase(JSON.parse(committedText)).database;
  assert.equal(validateDatabase(reloaded, {rejectExpired: false}).valid, true);
  assert.deepEqual(reloaded.cardDetails.find((item) => item.cardId === fact.cardId), fact);
});
await test("database publishing verifies the committed GitHub snapshot", async () => {
  const githubSource = await fs.readFile(path.join(root, "site/lib/github.mjs"), "utf8");
  assert.match(githubSource, /export async function getJsonFile/);
  assert.match(appSource, /GitHub read-back verification failed/);
  assert.match(appSource, /verifiedCounts\.cardDetails/);
  assert.match(appSource, /Database saved and verified/);
  assert.match(appSource, /Fact sheets/);
});
await test("Save Database blocks imports that were not applied", () => {
  assert.match(appSource, /A validated import is waiting to be applied/);
  assert.match(appSource, /JSON is still present in the import box/);
  assert.match(appSource, /Apply Validated Import to Staged Database/);
});

for (const template of prompts.templates) {
  for (const provider of ["chatgpt", "gemini"]) {
    await test(`one-step prompt preflight ${template.id} ${provider}`, () => {
      const resolved = resolvePromptVariant(prompts, template, database.cards, new Date("2026-07-11T12:00:00Z"), database, {workflow: "one-step", provider});
      const preflight = promptPreflight(resolved);
      assert.equal(preflight.valid, true, JSON.stringify(preflight));
      assert.match(resolved, /exactly one fenced code block labeled json/);
      assert.match(resolved, /FINAL CARDTRACK SCHEMA/);
      assert.match(resolved, /APPROVED DOMAINS/);
      assert.doesNotMatch(resolved, /\{\{[A-Z0-9_]+\}\}/);
      assert.ok(resolved.length < 140000, `resolved prompt too large: ${resolved.length}`);
    });
    await test(`two-step research prompt ${template.id} ${provider}`, () => {
      const resolved = resolvePromptVariant(prompts, template, database.cards, new Date("2026-07-11T12:00:00Z"), database, {workflow: "two-step", provider, stage: "research"});
      assert.match(resolved, /STEP 1 OF 2/);
      assert.match(resolved, /evidence ledger/);
      assert.match(resolved, /direct canonical HTTPS source URL/);
      assert.doesNotMatch(resolved, /\{\{[A-Z0-9_]+\}\}/);
    });
    await test(`two-step JSON prompt preflight ${template.id} ${provider}`, () => {
      const resolved = resolvePromptVariant(prompts, template, database.cards, new Date("2026-07-11T12:00:00Z"), database, {workflow: "two-step", provider, stage: "json"});
      const preflight = promptPreflight(resolved);
      assert.equal(preflight.valid, true, JSON.stringify(preflight));
      assert.match(resolved, /STEP 2 OF 2/);
      assert.match(resolved, /exactly one fenced code block labeled json/);
      assert.match(resolved, /JSON\.parse/);
    });
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`\n${passed} tests passed.`);
