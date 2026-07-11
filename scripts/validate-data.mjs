import fs from 'node:fs/promises';
import { validateDatabase } from '../site/lib/schema.mjs';

const path = new URL('../site/data/cardtrack.json', import.meta.url);
const raw = await fs.readFile(path, 'utf8');
const db = JSON.parse(raw);
const result = validateDatabase(db);
if (!result.valid) {
  console.error('CardTrack data validation failed:');
  for (const error of result.errors) console.error(`- ${error.path}: ${error.message}`);
  process.exit(1);
}
console.log(`CardTrack data valid: ${db.cards.length} card(s), ${db.offers.length} offer record(s), status=${db.dataStatus}.`);
