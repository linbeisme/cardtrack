import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {migrateDatabase, validateDatabase, validateSectionPayload} from "../site/lib/schema.mjs";
import {migratePromptLibrary, validatePromptLibrary} from "../site/lib/prompts.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const savedDatabase = JSON.parse(await fs.readFile(path.join(root, "site/data/cardtrack.json"), "utf8"));
const databaseMigration = migrateDatabase(savedDatabase);
const database = databaseMigration.database;
const savedPrompts = JSON.parse(await fs.readFile(path.join(root, "site/data/prompts.json"), "utf8"));
const defaults = JSON.parse(await fs.readFile(path.join(root, "site/data/default-prompts.json"), "utf8"));
const prompts = migratePromptLibrary(savedPrompts, defaults).library;
const valuations = JSON.parse(await fs.readFile(path.join(root, "site/data/tpg-valuations.json"), "utf8"));

const databaseCheck = validateDatabase(database, {rejectExpired: false});
const promptCheck = validatePromptLibrary(prompts);
const valuationCheck = validateSectionPayload(valuations, database, {type: "valuations"});
const errors = [...databaseCheck.errors, ...promptCheck.errors, ...valuationCheck.errors];

if (databaseMigration.migrated) console.log(`Database compatibility normalization applied in memory (${databaseMigration.changes.length} changes).`);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Validated ${database.cards.length} cards, ${database.offers.length} offers, ${database.cardDetails.length} card fact sheets, ${database.transferPrograms.length} transfer programs, ${database.transferBonuses.length} transfer bonuses, ${prompts.templates.length} prompt templates, and ${Object.keys(valuations.programs).length} CPP valuations.`);
