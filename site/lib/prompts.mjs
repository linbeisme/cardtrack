function clone(value) { return JSON.parse(JSON.stringify(value)); }

export function filterCards(cards, filter) {
  const active = cards.filter((card) => !card.isArchived);
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

function catalogForPrompt(cards) {
  return cards.map((card) => ({
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

function databaseSummary(database, selectedCards) {
  const ids = new Set(selectedCards.map((card) => card.id));
  return {
    schemaVersion: database.schemaVersion,
    existingOffers: database.offers.filter((item) => ids.has(item.cardId)),
    existingCardDetails: (database.cardDetails || []).filter((item) => ids.has(item.cardId)),
    transferPrograms: database.transferPrograms || [],
    transferBonuses: database.transferBonuses || []
  };
}

export function resolvePrompt(library, template, cards, date = new Date(), database = null) {
  const selectedCards = filterCards(cards, template.filter);
  const content = effectiveTemplateContent(library, template);
  const today = date.toISOString().slice(0, 10);
  const summary = database ? databaseSummary(database, selectedCards) : {};
  return content
    .replaceAll("{{TODAY}}", today)
    .replaceAll("{{SCOPE_INSTRUCTION}}", template.scopeInstruction || "Research the cards in the injected catalog.")
    .replaceAll("{{ACTIVE_CARD_CATALOG}}", JSON.stringify(catalogForPrompt(selectedCards), null, 2))
    .replaceAll("{{CURRENT_DATABASE_SUMMARY}}", JSON.stringify(summary, null, 2));
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
  if (saved.schemaVersion !== base.schemaVersion) changes.push(`Prompt schema upgraded to ${base.schemaVersion}`);
  return {library: base, migrated: changes.length > 0, changes};
}

export function validatePromptLibrary(library) {
  const errors = [];
  if (!library || typeof library !== "object" || Array.isArray(library)) return {valid: false, errors: ["Prompt library must be an object."]};
  if (![1, 2].includes(library.schemaVersion)) errors.push("Prompt library schemaVersion must equal 1 or 2.");
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
