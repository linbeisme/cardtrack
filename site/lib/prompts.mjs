function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

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
  return template.customPrompt || library.basePrompt;
}

export function resolvePrompt(library, template, cards, date = new Date()) {
  const selectedCards = filterCards(cards, template.filter);
  const content = effectiveTemplateContent(library, template);
  const today = date.toISOString().slice(0, 10);
  const catalog = selectedCards.map((card) => ({
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
  return content
    .replaceAll("{{TODAY}}", today)
    .replaceAll("{{SCOPE_INSTRUCTION}}", template.scopeInstruction || "Research the cards in the injected catalog.")
    .replaceAll("{{ACTIVE_CARD_CATALOG}}", JSON.stringify(catalog, null, 2));
}

export function validatePromptLibrary(library) {
  const errors = [];
  if (!library || typeof library !== "object" || Array.isArray(library)) return {valid: false, errors: ["Prompt library must be an object."]};
  if (library.schemaVersion !== 1) errors.push("Prompt library schemaVersion must equal 1.");
  if (typeof library.basePrompt !== "string" || !library.basePrompt.includes("{{ACTIVE_CARD_CATALOG}}")) errors.push("basePrompt must include {{ACTIVE_CARD_CATALOG}}.");
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
    if (typeof template.customPrompt === "string" && !template.customPrompt.includes("{{ACTIVE_CARD_CATALOG}}")) errors.push(`${p}.customPrompt must include {{ACTIVE_CARD_CATALOG}}.`);
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
