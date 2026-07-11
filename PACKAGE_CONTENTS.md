# Package Contents — CardTrack v4.1.1

- GitHub Pages workflow: `.github/workflows/update-and-deploy.yml`
- App: `site/index.html`, `site/app.js`, `site/styles.css`
- Libraries: `site/lib/*.mjs`
- Data: `site/data/cardtrack.json`, `site/data/prompts.json`, `site/data/tpg-valuations.json`
- Validation: `scripts/validate-data.mjs`
- Tests: `tests/run-tests.mjs`
- Documentation and release notes

The v4.1.1 hotfix update-only package omits all data files so it cannot overwrite the live database, saved prompts, or valuation snapshot.
