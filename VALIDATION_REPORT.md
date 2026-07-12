# CardTrack v5.2.5 Validation Report

## Automated validation

- 132 automated tests passed on the complete package.
- The same 132 tests passed on a simulated live upgrade containing 15 existing Card Facts records.
- 80 generated prompt variants passed preflight in both the seed-data and populated-fact-sheet scenarios.
- JavaScript syntax checks passed for app.js, schema.mjs, prompts.mjs, github.mjs, and tests.
- Saved database validation passed for 15 cards and 15 offers.
- Populated upgrade validation passed for 15 cards, 15 offers, and 15 card fact sheets.
- Prompt library validation passed for 10 templates.
- TPG valuation validation passed for 11 program valuations.

## v5.2.5 regression fixes

- Section-merge testing now supports repositories that already contain Card Facts for all active cards.
- The merge test verifies that unrelated offers, transfer programs, transfer bonuses, and existing fact sheets remain unchanged.
- Card Facts prompts inject compact current-data summaries rather than every nested saved benefit record.
- Complete Data Refresh prompts inject compact summaries of offers, fact sheets, transfer programs, and transfer bonuses.
- One-step ChatGPT and Gemini prompts remain below the 140,000-character guard with 15 populated fact sheets.
- Existing identifiers, verification dates, counts, top-benefit names, and source-host context remain available to the research prompt.

## Existing v5.2.4 regression coverage retained

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
- Update-only overlay testing preserved existing live data.
- ZIP integrity checks passed.
