# CardTrack v4.1 — Backward-Compatible Prompt Manager Upgrade

CardTrack is a dependency-free GitHub Pages application for researching, validating, staging, and publishing U.S. credit-card welcome offers.

## Major features

- Prompt Manager with Full Catalog, Amex, Chase, Hotel, and Airline templates.
- Editable prompts, resolved previews, copy, import/export, restore defaults, schema testing, and GitHub prompt publishing.
- Automatic current-date and active-card-catalog insertion.
- Estimated welcome-offer value using the included TPG CPP snapshot.
- Dedicated annual-fee display and first-year-waiver badge.
- Non-sticky offer-table header that does not cover the first result.
- Backward-compatible validation for legacy databases missing archive fields.
- Automatic in-memory normalization of legacy archive and fee-waiver fields.
- Application and data-compatibility version indicator.

## Existing repository update

Use the update-only ZIP. It intentionally excludes `site/data/cardtrack.json`, so it preserves the live card and offer database. Upload the package contents to the repository root and overwrite matching files.

The critical v4.1 files are:

```text
site/lib/schema.mjs
site/app.js
site/styles.css
scripts/validate-data.mjs
tests/run-tests.mjs
.github/workflows/update-and-deploy.yml
```

## Compatibility behavior

Old databases may omit `isArchived` and `archivedAt`. The validator accepts those omissions, while CardTrack normalizes them to `false` and `null` before use. A malformed value remains an error.

## Local validation

```bash
node scripts/validate-data.mjs
node tests/run-tests.mjs
```

## Security

Use a fine-grained GitHub personal access token restricted to the CardTrack repository with **Contents: Read and write**. CardTrack does not save it in localStorage, cookies, or repository files and clears token fields after each GitHub attempt.
