import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  SCHEMA_VERSION,
  slugify,
  isAllowedSourceUrl,
  normalizeOfferStatus,
  validateDatabase,
  parseImportPayload,
  validateImportPayload,
  mergeOffers,
  buildDatabaseForSave
} from '../site/lib/schema.mjs';

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}\n${error.stack}`); process.exitCode = 1; }
}

const dbPath = new URL('../site/data/cardtrack.json', import.meta.url);
const seed = JSON.parse(await fs.readFile(dbPath, 'utf8'));
const card = seed.cards[0];
const baseOffer = {
  cardId: card.id,
  bonusAmount: 100000,
  bonusUnit: 'points',
  channel: 'public',
  spendRequirement: 8000,
  spendPeriodMonths: 6,
  annualFee: card.annualFee,
  status: 'elevated',
  expirationDate: null,
  lastVerifiedAt: '2026-07-10T12:00:00Z',
  confidence: 'high',
  note: 'Verified test record.',
  sources: [{ name: 'American Express', url: 'https://www.americanexpress.com/us/credit-cards/', sourceType: 'issuer' }]
};

test('seed database validates', () => assert.equal(validateDatabase(seed).valid, true));
test('slugify creates stable IDs', () => assert.equal(slugify('Example Rewards Card!'), 'example-rewards-card'));
test('approved source accepts issuer subdomain', () => assert.equal(isAllowedSourceUrl('https://creditcards.chase.com/example'), true));
test('unapproved source is rejected', () => assert.equal(isAllowedSourceUrl('https://example.com/card'), false));
test('public offer above baseline normalizes to elevated', () => assert.equal(normalizeOfferStatus({ ...baseOffer, status: 'standard' }, card, new Date('2026-07-10T00:00:00Z')), 'elevated'));
test('limited status is preserved', () => assert.equal(normalizeOfferStatus({ ...baseOffer, status: 'limited', expirationDate: '2026-08-01' }, card, new Date('2026-07-10T00:00:00Z')), 'limited'));
test('targeted channel cannot appear as public standard', () => assert.equal(normalizeOfferStatus({ ...baseOffer, channel: 'targeted', status: 'standard' }, card), 'targeted'));
test('expired offer is identified', () => assert.equal(normalizeOfferStatus({ ...baseOffer, expirationDate: '2026-01-01' }, card, new Date('2026-07-10T00:00:00Z')), 'expired'));
test('import parser accepts fenced JSON', () => assert.equal(parseImportPayload('```json\n{"offers":[],"dataStatus":"partial","generatedAt":"2026-07-10T00:00:00Z"}\n```').offers.length, 0));
test('valid offer import is accepted', () => {
  const payload = { schemaVersion: SCHEMA_VERSION, generatedAt: '2026-07-10T12:00:00Z', dataStatus: 'partial', offers: [baseOffer] };
  const result = validateImportPayload(payload, seed.cards, { now: new Date('2026-07-10T12:00:00Z') });
  assert.equal(result.valid, true);
  assert.equal(result.accepted.length, 1);
});
test('expired import is rejected', () => {
  const payload = { schemaVersion: SCHEMA_VERSION, generatedAt: '2026-07-10T12:00:00Z', dataStatus: 'partial', offers: [{ ...baseOffer, expirationDate: '2026-01-01' }] };
  const result = validateImportPayload(payload, seed.cards, { now: new Date('2026-07-10T12:00:00Z') });
  assert.equal(result.valid, false);
  assert.equal(result.rejected.length, 1);
});
test('duplicate card and channel is rejected', () => {
  const payload = { schemaVersion: SCHEMA_VERSION, generatedAt: '2026-07-10T12:00:00Z', dataStatus: 'partial', offers: [baseOffer, { ...baseOffer }] };
  const result = validateImportPayload(payload, seed.cards, { now: new Date('2026-07-10T12:00:00Z') });
  assert.equal(result.rejected.length, 1);
});
test('merge replaces matching channel but preserves other channels', () => {
  const targeted = { ...baseOffer, channel: 'targeted', status: 'targeted', bonusAmount: 150000 };
  const merged = mergeOffers([baseOffer, targeted], [{ ...baseOffer, bonusAmount: 120000 }], 'merge');
  assert.equal(merged.length, 2);
  assert.equal(merged.find(o => o.channel === 'public').bonusAmount, 120000);
});

test('live import requires public offers for every active card', () => {
  const payload = { schemaVersion: SCHEMA_VERSION, generatedAt: '2026-07-10T12:00:00Z', dataStatus: 'live', validation: { acceptedCount: 1 }, offers: [baseOffer] };
  const result = validateImportPayload(payload, seed.cards, { now: new Date('2026-07-10T12:00:00Z') });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.path === 'dataStatus'));
});

test('acceptedCount mismatch blocks import', () => {
  const payload = { schemaVersion: SCHEMA_VERSION, generatedAt: '2026-07-10T12:00:00Z', dataStatus: 'partial', validation: { acceptedCount: 99 }, offers: [baseOffer] };
  const result = validateImportPayload(payload, seed.cards, { now: new Date('2026-07-10T12:00:00Z') });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.path === 'validation.acceptedCount'));
});

test('database save updates generated timestamp without mutating source', () => {
  const original = structuredClone(seed);
  const saved = buildDatabaseForSave(seed, { updatedBy: 'test' });
  assert.equal(saved.schemaVersion, SCHEMA_VERSION);
  assert.equal(saved.updatedBy, 'test');
  assert.equal(seed.generatedAt, original.generatedAt);
});

if (!process.exitCode) console.log(`All ${passed} tests passed.`);
