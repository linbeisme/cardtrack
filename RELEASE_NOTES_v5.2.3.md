# CardTrack v5.2.3

## Prompt reliability release

This release is based on v5.2.2 and addresses the full set of prompt/output failures observed during ChatGPT and Gemini use.

### Prompt Manager

- Adds exact, app-generated schema contracts for every category:
  - Welcome Offers
  - Card Facts & Benefits
  - Transfer Partners & Ratios
  - Active Transfer Bonuses
  - TPG CPP Valuations
  - Complete Data Refresh
- Applies the same hard category contract to ChatGPT and Gemini, in one-step and two-step modes.
- Changes final JSON transport to exactly one fenced `json` code block so literal URLs are not converted into rendered Markdown links.
- Adds provider-specific rules for ChatGPT citations and Gemini/Google grounding links.
- Changes Deep Research Step 1 into a structured evidence ledger with exact target fields and direct canonical URLs.
- Adds a provider-specific **Copy JSON Repair Prompt** for malformed or rejected responses.
- Adds a visible prompt preflight for catalog injection, schema, source policy, transport, and parse audit.
- Reduces injected stored data to the sections relevant to the selected category.

### Parser and validation

- Accepts the full fenced JSON code block, only its contents, or a single JSON object surrounded by incidental prose.
- Adds targeted parse messages for URL-encoded JSON punctuation and malformed Markdown links.
- Rejects Markdown links in plain-text benefit, source, offer, partner, and promotion fields.
- Retains direct-source normalization and category-specific hostname diagnostics from v5.2.2.

### Automation

- Adds `scripts/audit-prompts.mjs` to audit all 80 generated prompt variants across 10 categories, two providers, one-step, two-step Step 1, two-step Step 2, and repair mode.
- GitHub Actions now runs the prompt audit before deployment.
