import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {
  migratePromptLibrary,
  promptPreflight,
  resolvePromptVariant,
  resolveRepairPromptVariant,
  validatePromptLibrary
} from "../site/lib/prompts.mjs";
import {migrateDatabase} from "../site/lib/schema.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const database = migrateDatabase(JSON.parse(await fs.readFile(path.join(root, "site/data/cardtrack.json"), "utf8"))).database;
const defaults = JSON.parse(await fs.readFile(path.join(root, "site/data/default-prompts.json"), "utf8"));
const saved = JSON.parse(await fs.readFile(path.join(root, "site/data/prompts.json"), "utf8"));
const prompts = migratePromptLibrary(saved, defaults).library;
const libraryCheck = validatePromptLibrary(prompts);
if (!libraryCheck.valid) throw new Error(libraryCheck.errors.join("\n"));

const date = new Date("2026-07-11T12:00:00Z");
let audited = 0;
for (const template of prompts.templates) {
  for (const provider of ["chatgpt", "gemini"]) {
    const oneStep = resolvePromptVariant(prompts, template, database.cards, date, database, {workflow: "one-step", provider});
    const oneStepCheck = promptPreflight(oneStep);
    if (!oneStepCheck.valid) throw new Error(`${template.id}/${provider}/one-step failed: ${JSON.stringify(oneStepCheck)}`);
    const research = resolvePromptVariant(prompts, template, database.cards, date, database, {workflow: "two-step", provider, stage: "research"});
    if (!/STEP 1 OF 2/.test(research) || /\{\{[A-Z0-9_]+\}\}/.test(research)) throw new Error(`${template.id}/${provider}/research failed.`);
    const json = resolvePromptVariant(prompts, template, database.cards, date, database, {workflow: "two-step", provider, stage: "json"});
    const jsonCheck = promptPreflight(json);
    if (!jsonCheck.valid) throw new Error(`${template.id}/${provider}/two-step-json failed: ${JSON.stringify(jsonCheck)}`);
    const repair = resolveRepairPromptVariant(prompts, template, database.cards, date, database, {provider});
    if (!/JSON REPAIR PROMPT/.test(repair) || !/JSON\.parse/.test(repair)) throw new Error(`${template.id}/${provider}/repair failed.`);
    audited += 4;
  }
}
console.log(`Prompt audit passed: ${audited} generated prompt variants checked across ${prompts.templates.length} categories and 2 providers.`);
