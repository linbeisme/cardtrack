import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {validateDatabase} from "../site/lib/schema.mjs";
import {validatePromptLibrary} from "../site/lib/prompts.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const database = JSON.parse(await fs.readFile(path.join(root, "site/data/cardtrack.json"), "utf8"));
const prompts = JSON.parse(await fs.readFile(path.join(root, "site/data/prompts.json"), "utf8"));
const valuations = JSON.parse(await fs.readFile(path.join(root, "site/data/tpg-valuations.json"), "utf8"));

const databaseCheck = validateDatabase(database, {rejectExpired: false});
const promptCheck = validatePromptLibrary(prompts);
const errors = [...databaseCheck.errors, ...promptCheck.errors];
if (!valuations || valuations.schemaVersion !== 1 || !valuations.programs || typeof valuations.programs !== "object") errors.push("TPG valuations file is invalid.");
for (const [program, value] of Object.entries(valuations.programs || {})) {
  if (typeof value.cpp !== "number" || !Number.isFinite(value.cpp) || value.cpp < 0) errors.push(`Invalid CPP for ${program}.`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Validated ${database.cards.length} cards, ${database.offers.length} offers, ${prompts.templates.length} prompt templates, and ${Object.keys(valuations.programs).length} CPP valuations.`);
