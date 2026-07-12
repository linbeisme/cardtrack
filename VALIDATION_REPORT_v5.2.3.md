# Validation Report — CardTrack v5.2.3

## Automated validation

- Saved database validation passed.
- Prompt Library schema v4 and transport contract v2 validation passed.
- JavaScript syntax checks passed for application, schema, prompts, GitHub publisher, tests, and prompt-audit script.
- 125 automated tests passed.
- 80 generated prompt variants passed deterministic preflight across:
  - 10 categories
  - ChatGPT and Gemini
  - One-step Search
  - Two-step Deep Research Step 1
  - Two-step Deep Research Step 2
  - JSON Repair mode
- Representative fenced outputs parsed and validated for welcome offers, card facts, transfer partners, transfer bonuses, and CPP valuations.
- Malformed Markdown links, URL-encoded JSON punctuation, unapproved hosts, and invalid plain-text links produced targeted failures.
- Prompt migration from schema v3 to v4 preserved custom prompt text and added transport metadata.
- Newly added active cards remained automatically injected into resolved prompts.
- Update-only overlay testing preserved live card, prompt, and valuation data files.

## Important test boundary

The package deterministically validates the prompts it generates and representative outputs that satisfy those prompts. It does not make live calls to ChatGPT or Gemini during automated testing, because no vendor API keys are embedded or required. CardTrack's schema tester remains the final authority for each live model response.
