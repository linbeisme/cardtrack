# CardTrack v5.2.4 Validation Report

## Automated validation

- 132 automated tests passed.
- 80 generated prompt variants audited across 10 categories, two providers, one-step, two-step, and repair workflows.
- JavaScript syntax checks passed for app.js, schema.mjs, prompts.mjs, github.mjs, and tests.
- Saved database validation passed: 15 cards and 15 offers.
- Prompt library validation passed: 10 templates.
- TPG valuation validation passed: 11 program valuations.

## New regression coverage

- Clear Import resets Import Type to Auto-detect.
- Prompt Manager JSON tester Clear resets all test state.
- Both GitHub token fields use the dedicated light-blue token-input style.
- Current Offers card names navigate to matching Fact Sheet tombstones.
- Card Details survive apply, JSON serialization, parse, migration, and database validation.
- Database publishing includes GitHub commit read-back verification and fact-sheet count comparison.
- Save Database blocks validated or unvalidated JSON that has not been applied.

## Packaging checks

- Complete package contains all application and seed data files.
- Update-only package excludes site/data/cardtrack.json, site/data/prompts.json, and site/data/tpg-valuations.json.
- Update-only overlay test preserved an existing Card Facts record, saved prompt library, and TPG valuation file.
- The overlaid repository revalidated successfully and all 132 tests passed.
- ZIP integrity checks passed.
