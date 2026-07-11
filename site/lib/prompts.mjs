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

function databaseSummary(database = {}, selectedCards = []) {
  const ids = new Set((Array.isArray(selectedCards) ? selectedCards : []).map((card) => card.id));
  return {
    schemaVersion: database.schemaVersion,
    existingOffers: (database.offers || []).filter((item) => ids.has(item.cardId)),
    existingCardDetails: (database.cardDetails || []).filter((item) => ids.has(item.cardId)),
    transferPrograms: database.transferPrograms || [],
    transferBonuses: database.transferBonuses || []
  };
}

const VALID_SOURCE_POLICIES = new Set(["offers", "cardDetails", "transferPrograms", "transferBonuses", "valuations", "complete"]);

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
  const directRules = `SOURCE URL ENFORCEMENT
- Every URL must be a direct canonical HTTPS page.
- Never use search-result URLs, ChatGPT/Gemini citation wrappers, Google/Bing redirects, shortened URLs, affiliate redirects, cached pages, or tracking-only links.
- Use the exact page that supports the fact, partner, bonus, or valuation.
- If no approved direct source can support a required record, omit that record and add it to errors; do not substitute an unapproved URL.`;
  if (policy === "complete") {
    return `${directRules}

APPROVED DOMAINS BY DATA SECTION
WELCOME OFFERS
${domainLines("offers")}

CARD FACTS AND BENEFITS
${domainLines("cardDetails")}

TRANSFER PARTNERS AND TRANSFER BONUSES
${domainLines("transferPrograms")}

Apply the matching list to each section of the complete dataset.`;
  }
  return `${directRules}

APPROVED DOMAINS FOR ${String(SOURCE_POLICY_LABELS[policy] || policy).toUpperCase()}
${domainLines(policy)}`;
}

export function resolvePrompt(library, template, cards, date = new Date(), database = null) {
  if (!template || typeof template !== "object") throw new Error("The selected prompt template is unavailable. Reload defaults or choose another template.");
  const selectedCards = filterCards(cards, template.filter);
  const content = effectiveTemplateContent(library || {}, template);
  const today = date.toISOString().slice(0, 10);
  const summary = database ? databaseSummary(database, selectedCards) : {};
  const resolved = content
    .replaceAll("{{TODAY}}", today)
    .replaceAll("{{SCOPE_INSTRUCTION}}", template.scopeInstruction || "Research the cards in the injected catalog.")
    .replaceAll("{{ACTIVE_CARD_CATALOG}}", JSON.stringify(catalogForPrompt(selectedCards), null, 2))
    .replaceAll("{{CURRENT_DATABASE_SUMMARY}}", JSON.stringify(summary, null, 2));
  return `${resolved}\n\n${sourcePolicyContract(template)}`;
}

function providerName(provider, workflow) {
  const item = PROMPT_PROVIDERS[provider] || PROMPT_PROVIDERS.chatgpt;
  return workflow === "two-step" ? item.deepLabel : item.searchLabel;
}

function oneStepContract(provider) {
  const platform = providerName(provider, "one-step");
  const platformRule = provider === "gemini"
    ? "Use a normal Gemini chat with Google Search/grounding enabled. Do NOT use Gemini Deep Research for this prompt."
    : "Use a normal ChatGPT chat with Search enabled. Do NOT use ChatGPT Deep Research for this prompt.";
  return `CARDTRACK ONE-STEP SEARCH PROMPT\n\nPLATFORM\n${platform}\n${platformRule}\n\nFINAL DELIVERABLE CONTRACT\n- Perform all live-web research internally.\n- Do not show a research plan, progress notes, analysis, executive summary, report, bibliography, or commentary.\n- Your only visible response must be one raw JSON object matching the embedded CardTrack category contract.\n- The first visible character must be { and the final visible character must be }.\n- Do not use Markdown fences and do not write the word JSON before the object.\n- Put approved direct HTTPS sources inside the JSON records only.\n- If a required fact cannot be verified, use null where allowed or place the record in errors. Never substitute a written report.\n\nCATEGORY AND SCHEMA CONTRACT\n`;
}

function twoStepResearchContract(provider) {
  const platform = providerName(provider, "two-step");
  const platformRule = provider === "gemini"
    ? "Run this as Gemini Deep Research."
    : "Run this as ChatGPT Deep Research.";
  return `CARDTRACK TWO-STEP DEEP RESEARCH — STEP 1 OF 2\n\nPLATFORM\n${platform}\n${platformRule}\n\nSTEP 1 PURPOSE\nConduct the research and produce a structured evidence report for the selected CardTrack category. This first step is intentionally a report, not the import JSON.\n\nSTEP 1 RULES\n- Research every card or program in the embedded scope.\n- Organize findings by the exact cardId and programId values in the contract.\n- For every required field, state the verified value or clearly mark it unverified.\n- Include direct canonical HTTPS source URLs beside the facts they support. Do not use search-result, citation-wrapper, redirect, shortened, cached, or affiliate URLs.\n- Preserve distinctions such as public versus targeted, recurring benefit versus welcome offer, standard ratio versus transfer promotion, and issuer facts versus editorial valuations.\n- Do not invent missing amounts, dates, ratios, benefits, or URLs.\n- Do NOT return the final CardTrack JSON in Step 1.\n- Ignore only the embedded instruction that says to return JSON; all scope, field, source, and validation requirements still govern the research.\n- Finish with a compact completeness checklist listing any cards or fields that could not be verified.\n\nCATEGORY AND SCHEMA CONTRACT FOR THE LATER JSON CONVERSION\n`;
}

function twoStepJsonContract(provider) {
  const platform = providerName(provider, "two-step");
  return `CARDTRACK TWO-STEP DEEP RESEARCH — STEP 2 OF 2\n\nPLATFORM\nContinue in the SAME ${platform} conversation immediately after Step 1.\n\nSTEP 2 PURPOSE\nUsing the research already completed in this conversation, convert the findings into the exact CardTrack import object required by the embedded category contract.\n\nSTRICT OUTPUT RULES\n- Do not produce another report and do not summarize the research.\n- Do not perform new research unless a direct source URL is missing or clearly unusable.\n- Return exactly one raw JSON object.\n- The first visible character must be { and the final visible character must be }.\n- Do not use Markdown fences, headings, footnotes, citations outside the object, or explanatory text.\n- Preserve exact cardId and programId values. Do not add cards outside the embedded catalog.\n- Use only direct canonical HTTPS source URLs allowed by the embedded contract.\n- Never use ChatGPT/Gemini citation-wrapper links, search-result links, redirects, shortened links, cached links, or affiliate links.\n- Use null only where the schema permits it. Put unverifiable required records in errors.\n- Recalculate all counts and silently verify that the response parses as valid JSON before returning it.\n\nCATEGORY AND SCHEMA CONTRACT\n`;
}

export function resolvePromptVariant(library, template, cards, date = new Date(), database = null, options = {}) {
  const workflow = options.workflow === "two-step" ? "two-step" : "one-step";
  const provider = options.provider === "gemini" ? "gemini" : "chatgpt";
  const stage = options.stage === "json" ? "json" : "research";
  const resolved = resolvePrompt(library, template, cards, date, database);
  if (workflow === "one-step") {
    return `${oneStepContract(provider)}${resolved}\n\nFINAL OVERRIDE\nReturn the final CardTrack import object now. Raw JSON only.`;
  }
  if (stage === "json") {
    return `${twoStepJsonContract(provider)}${resolved}\n\nFINAL OVERRIDE\nConvert the completed Step 1 research into the final CardTrack import object now. Raw JSON only.`;
  }
  return `${twoStepResearchContract(provider)}${resolved}\n\nSTEP 1 OVERRIDE\nProduce the structured evidence report now. Do not return the final JSON until Step 2.`;
}

export function promptVariantLabel(options = {}) {
  const workflow = options.workflow === "two-step" ? "two-step" : "one-step";
  const provider = options.provider === "gemini" ? "gemini" : "chatgpt";
  const stage = options.stage === "json" ? "json" : "research";
  const platform = providerName(provider, workflow);
  if (workflow === "one-step") return `${platform} · One-step JSON`;
  return `${platform} · ${stage === "json" ? "Step 2 JSON conversion" : "Step 1 research report"}`;
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
  return {library: base, migrated: changes.length > 0, changes};
}

export function validatePromptLibrary(library) {
  const errors = [];
  if (!library || typeof library !== "object" || Array.isArray(library)) return {valid: false, errors: ["Prompt library must be an object."]};
  if (![1, 2, 3].includes(library.schemaVersion)) errors.push("Prompt library schemaVersion must equal 1, 2, or 3.");
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
