# CardTrack v4.0 — Prompt Manager & Valuation Upgrade

CardTrack is a dependency-free GitHub Pages application for researching, validating, staging, and publishing U.S. credit-card welcome offers.

## Major v4 changes

- Prompt Manager with Full Catalog, Amex, Chase, Hotel, and Airline templates.
- Editable prompt templates with lightweight syntax highlighting and resolved previews.
- One-click copy, import/export, restore default, and GitHub prompt-library publishing.
- Automatic `{{TODAY}}` and active-card-catalog injection.
- Prompt Manager JSON test using the same CardTrack schema as the Admin Publisher.
- Fixed table-header overlap by removing the table header's sticky positioning.
- Estimated cash value using the included July 2026 TPG CPP snapshot.
- Explicit recurring annual-fee column and first-year-waiver badge.
- New required imported field: `annualFeeWaivedFirstYear` (boolean).
- GitHub Actions upgraded to Node 24-compatible major versions.

## Repository structure

```
.github/workflows/deploy-pages.yml
site/index.html
site/styles.css
site/app.js
site/lib/schema.mjs
site/lib/prompts.mjs
site/lib/github.mjs
site/data/cardtrack.json
site/data/prompts.json
site/data/tpg-valuations.json
scripts/validate-data.mjs
tests/run-tests.mjs
```

## Deploy a complete replacement

Upload the contents of this folder to the root of the `cardtrack` repository, preserving `.github`. Commit to `main`. In repository **Settings → Pages**, keep **Source = GitHub Actions**.

## Update an existing v3 repository

Use the separate update-only ZIP. It intentionally excludes `site/data/cardtrack.json`, so uploading it does not overwrite the current live card and offer database.

## Local validation

```bash
node scripts/validate-data.mjs
node tests/run-tests.mjs
```

## Security

Use a fine-grained GitHub personal access token restricted to the CardTrack repository with **Contents: Read and write**. CardTrack does not save it in localStorage, cookies, or repository files and clears token fields after each GitHub attempt.

## Valuation note

The included dollar estimates are editorial approximations based on the TPG monthly CPP table. They are not cash guarantees, issuer values, or recommendations to apply for a card.
