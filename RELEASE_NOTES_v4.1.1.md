# CardTrack v4.1.1 Hotfix

## Startup crash fixed

CardTrack v4.1 loaded the TPG valuation file but did not assign it to application state before the first render. The dashboard then attempted to read `state.valuations.asOf` while `state.valuations` was still `null`, producing:

`Cannot read properties of null (reading 'asOf')`

Version 4.1.1 assigns the validated valuation snapshot before rendering the interface.

## Regression coverage

The test suite now confirms that:

- The TPG valuation snapshot contains the required fields.
- The application assigns loaded valuations before calling the first render.
- Existing database compatibility, prompt-manager, schema, and import tests continue to pass.

## Data safety

The update-only package does not contain `site/data/cardtrack.json`, `site/data/prompts.json`, or `site/data/tpg-valuations.json`, so it cannot overwrite the live database, saved prompt library, or valuation snapshot.
