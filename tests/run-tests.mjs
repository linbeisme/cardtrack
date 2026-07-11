import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {
  effectiveStatus,
  firstYearFeeWaived,
  mergeOffers,
  migrateDatabase,
  parseResearchJson,
  validateDatabase,
  validateImportPayload
} from "../site/lib/schema.mjs";
import {
  filterCards,
  resolvePrompt,
  restoreTemplateDefault,
  updateTemplateContent,
  validatePromptLibrary
} from "../site/lib/prompts.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const database = JSON.parse(await fs.readFile(path.join(root, "site/data/cardtrack.json"), "utf8"));
const prompts = JSON.parse(await fs.readFile(path.join(root, "site/data/prompts.json"), "utf8"));
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

await test("saved database validates", () => assert.equal(validateDatabase(database, {rejectExpired: false}).valid, true));
await test("saved prompt library validates", () => assert.equal(validatePromptLibrary(prompts).valid, true));
await test("legacy cards may omit archive fields", () => {
  const legacy = structuredClone(database);
  for (const item of legacy.cards) { delete item.archivedAt; delete item.isArchived; }
  assert.equal(validateDatabase(legacy, {rejectExpired: false}).valid, true);
});
await test("migration restores legacy archive fields", () => {
  const legacy = structuredClone(database);
  delete legacy.cards[0].archivedAt;
  delete legacy.cards[0].isArchived;
  delete legacy.offers[0].annualFeeWaivedFirstYear;
  delete legacy.compatibilityVersion;
  const result = migrateDatabase(legacy);
  assert.equal(result.migrated, true);
  assert.equal(result.database.cards[0].isArchived, false);
  assert.equal(result.database.cards[0].archivedAt, null);
  assert.equal(typeof result.database.offers[0].annualFeeWaivedFirstYear, "boolean");
  assert.equal(result.database.compatibilityVersion, 1);
  assert.equal(validateDatabase(result.database, {rejectExpired: false}).valid, true);
});
await test("invalid supplied archivedAt remains rejected", () => {
  const invalid = structuredClone(database);
  invalid.cards[0].archivedAt = "not-a-date";
  assert.match(validateDatabase(invalid, {rejectExpired: false}).errors.join(" "), /archivedAt/);
});
await test("fenced JSON parses", () => assert.equal(parseResearchJson('```json\n{"offers":[]}\n```').offers.length, 0));
await test("unknown card ID is rejected", () => {
  const result = validateImportPayload({schemaVersion: 3, offers: [{...baseOffer, cardId: "not-in-catalog"}]}, database.cards);
  assert.equal(result.accepted.length, 0); assert.match(result.errors[0], /not in the active catalog/);
});
await test("invalid domain is rejected", () => {
  const result = validateImportPayload({schemaVersion: 3, offers: [{...baseOffer, sources: [{name: "Bad", url: "https://evil.example/card", sourceType: "issuer"}]}]}, database.cards);
  assert.equal(result.accepted.length, 0); assert.match(result.errors.join(" "), /approved domain/);
});
await test("missing waiver boolean is rejected for imports", () => {
  const offer = {...baseOffer}; delete offer.annualFeeWaivedFirstYear;
  const result = validateImportPayload({schemaVersion: 3, offers: [offer]}, database.cards);
  assert.match(result.errors.join(" "), /annualFeeWaivedFirstYear is required/);
});
await test("invalid waiver type is rejected", () => {
  const result = validateImportPayload({schemaVersion: 3, offers: [{...baseOffer, annualFeeWaivedFirstYear: "yes"}]}, database.cards);
  assert.match(result.errors.join(" "), /must be boolean/);
});
await test("valid import is accepted", () => {
  const result = validateImportPayload({schemaVersion: 3, dataStatus: "partial", offers: [baseOffer], errors: [], validation: {acceptedCount: 1, rejectedCount: 0}}, database.cards);
  assert.equal(result.accepted.length, 1); assert.equal(result.rejected.length, 0);
});
await test("acceptedCount mismatch is rejected", () => {
  const result = validateImportPayload({schemaVersion: 3, offers: [baseOffer], errors: [], validation: {acceptedCount: 2, rejectedCount: 0}}, database.cards);
  assert.match(result.errors.join(" "), /acceptedCount/);
});
await test("duplicate card and channel is rejected", () => {
  const result = validateImportPayload({schemaVersion: 3, offers: [baseOffer, {...baseOffer}]}, database.cards);
  assert.match(result.errors.join(" "), /Duplicate cardId \+ channel/);
});
await test("non-public status normalizes to targeted", () => {
  const targeted = {...baseOffer, channel: "targeted", status: "targeted"};
  assert.equal(effectiveStatus(targeted, card), "targeted");
});
await test("public bonus above baseline normalizes elevated", () => {
  assert.equal(effectiveStatus({...baseOffer, status: "standard"}, card), "elevated");
});
await test("limited status takes priority", () => assert.equal(effectiveStatus(baseOffer, card), "limited"));
await test("explicit fee waiver is honored", () => assert.equal(firstYearFeeWaived({...baseOffer, annualFeeWaivedFirstYear: true}), true));
await test("legacy note waiver can be inferred", () => {
  const legacy = {...baseOffer, note: "The annual fee is waived for the first year."}; delete legacy.annualFeeWaivedFirstYear;
  assert.equal(firstYearFeeWaived(legacy), true);
});
await test("merge replaces same card/channel only", () => {
  const existing = [baseOffer, {...baseOffer, cardId: "chase-sapphire-reserve"}];
  const incoming = [{...baseOffer, bonusAmount: 110000}];
  const merged = mergeOffers(existing, incoming, "merge");
  assert.equal(merged.length, 2); assert.equal(merged.find((item) => item.cardId === baseOffer.cardId).bonusAmount, 110000);
});
await test("replace discards prior offers", () => assert.equal(mergeOffers([baseOffer], [{...baseOffer, bonusAmount: 1}], "replace")[0].bonusAmount, 1));
await test("full prompt selects all active cards", () => {
  const template = prompts.templates.find((item) => item.id === "full-catalog");
  assert.equal(filterCards(database.cards, template.filter).length, database.cards.filter((item) => !item.isArchived).length);
});
await test("Amex prompt selects only American Express", () => {
  const template = prompts.templates.find((item) => item.id === "american-express");
  assert.ok(filterCards(database.cards, template.filter).every((item) => item.issuer === "American Express"));
});
await test("hotel prompt selects intended programs", () => {
  const template = prompts.templates.find((item) => item.id === "hotels");
  const programs = new Set(filterCards(database.cards, template.filter).map((item) => item.program));
  assert.deepEqual([...programs].sort(), ["IHG One Rewards", "Marriott Bonvoy", "World of Hyatt"].sort());
});
await test("resolved prompt injects date and catalog", () => {
  const template = prompts.templates.find((item) => item.id === "chase");
  const resolved = resolvePrompt(prompts, template, database.cards, new Date("2026-07-10T12:00:00Z"));
  assert.match(resolved, /2026-07-10/); assert.match(resolved, /chase-sapphire-preferred/); assert.doesNotMatch(resolved, /\{\{ACTIVE_CARD_CATALOG\}\}/);
});
await test("custom template update preserves library", () => {
  const next = updateTemplateContent(prompts, "full-catalog", `${prompts.basePrompt}\nCUSTOM`);
  assert.match(next.templates.find((item) => item.id === "full-catalog").customPrompt, /CUSTOM/);
  assert.equal(prompts.templates.find((item) => item.id === "full-catalog").customPrompt, null);
});
await test("restore clears custom prompt", () => {
  const changed = updateTemplateContent(prompts, "full-catalog", `${prompts.basePrompt}\nCUSTOM`);
  const restored = restoreTemplateDefault(changed, "full-catalog");
  assert.equal(restored.templates.find((item) => item.id === "full-catalog").customPrompt, null);
});
await test("expired imported offer is rejected", () => {
  const result = validateImportPayload({schemaVersion: 3, offers: [{...baseOffer, expirationDate: "2020-01-01"}]}, database.cards);
  assert.match(result.errors.join(" "), /expired/);
});
await test("live status requires all public cards", () => {
  const result = validateImportPayload({schemaVersion: 3, dataStatus: "live", offers: [baseOffer]}, database.cards);
  assert.match(result.errors.join(" "), /public offers are missing/);
});

if (process.exitCode) process.exit(process.exitCode);
console.log(`\n${passed} tests passed.`);
