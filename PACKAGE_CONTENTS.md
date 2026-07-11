# Package Contents

- `.github/workflows/update-and-deploy.yml` — validates and deploys GitHub Pages
- `site/index.html` — static application shell
- `site/app.js` — CardTrack views and publisher workflow
- `site/styles.css` — responsive UI, rotating row shades, KPI colors, and promotion animations
- `site/lib/schema.mjs` — migrations, validators, section imports, and value calculations
- `site/lib/prompts.mjs` — prompt resolution, migration, editing, and validation
- `site/lib/github.mjs` — GitHub Contents API publisher
- `site/data/default-prompts.json` — package defaults for all v5 research templates
- `site/data/prompts.json` — saved prompt library in the complete package only
- `site/data/cardtrack.json` — card database in the complete package only
- `site/data/tpg-valuations.json` — TPG snapshot in the complete package only
- `scripts/validate-data.mjs` — deployment validation
- `tests/run-tests.mjs` — automated tests
- `docs/UPDATE_INSTRUCTIONS.md` — GitHub update directions
- `docs/RESEARCH_JSON_FORMATS.md` — accepted import structures
