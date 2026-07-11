# Package Contents — CardTrack v5.1.0

- `.github/workflows/update-and-deploy.yml` — validates and deploys GitHub Pages
- `site/index.html` — static application shell
- `site/app.js` — CardTrack views, provider/workflow Prompt Manager, publisher workflow, and save-time display
- `site/styles.css` — responsive UI, light-yellow template selector, larger Sun/Moon toggle, row shades, KPI colors, and animations
- `site/lib/schema.mjs` — migrations, validators, section imports, value calculations, and application version
- `site/lib/prompts.mjs` — category prompt resolution, ChatGPT/Gemini one-step and two-step generation, migration, editing, and validation
- `site/lib/github.mjs` — GitHub Contents API publisher
- `site/data/default-prompts.json` — package defaults and Prompt Library schema v3
- `site/data/prompts.json` — saved prompt library in the complete package only
- `site/data/cardtrack.json` — card database in the complete package only
- `site/data/tpg-valuations.json` — TPG snapshot in the complete package only
- `scripts/validate-data.mjs` — deployment validation
- `tests/run-tests.mjs` — automated tests
- `docs/UPDATE_INSTRUCTIONS.md` — beginner GitHub update directions
- `docs/RESEARCH_JSON_FORMATS.md` — accepted import structures and workflow notes
- `RELEASE_NOTES_v5.1.0.md` — v5.1 feature and compatibility details
