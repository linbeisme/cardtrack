# CardTrack v5.1.0 Release Notes

## Prompt workflow redesign

- Added a category-first Prompt Manager.
- Added one-step regular-search prompts for ChatGPT and Gemini.
- Added two-step Deep Research prompts for ChatGPT and Gemini.
- Added explicit Step 1 research-report and Step 2 JSON-conversion prompts.
- Added provider-specific instructions that distinguish normal Search from Deep Research.
- Retained editable category templates while generating the selected platform/workflow wrapper automatically.
- Active card catalog, current date, and stored data continue to be injected automatically.
- Newly added or restored cards appear in all resolved prompts immediately; archived cards remain excluded.

## Prompt Library publishing

- Prompt Library schema upgraded to v3 with backward-compatible migration.
- Added `lastSavedToGitHubAt` and visible local date/time display after a successful GitHub save.
- Existing custom prompt text is preserved during migration.

## Interface changes

- Saved category/template dropdown now uses a light-yellow background.
- Day/night control is larger and uses visible Sun and Moon icons.
- Workflow, platform, and Deep Research step selectors use segmented controls.
- Added contextual instructions showing where to paste the selected prompt.

## Compatibility

- Database schema remains v5.2; no current card or offer data migration is required.
- Existing `site/data/prompts.json` files using schema v1 or v2 migrate automatically.
