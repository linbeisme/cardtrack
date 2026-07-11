# CardTrack v4 Validation Report

Validation completed during package generation.

## Automated results

- Node syntax checks passed for `site/app.js` and all `.mjs` modules.
- `node scripts/validate-data.mjs` passed.
- `node tests/run-tests.mjs` passed: **25 tests**.
- Database: 15 cards and 15 offer records validated.
- Prompt library: 5 templates validated.
- CPP library: 11 program valuations validated.

## Tested behaviors

- Current database compatibility.
- Prompt-library schema and required placeholders.
- Full, Amex, Chase, hotel, and airline card filtering.
- Automatic date and active-catalog injection.
- JSON fence removal and parsing.
- Unknown card, invalid domain, bad enum, expired offer, duplicate key, and count-mismatch rejection.
- Required `annualFeeWaivedFirstYear` boolean on new imports.
- Backward-compatible waiver inference for legacy saved offers.
- Merge and replace behavior.
- Promotional-status normalization.
- Static table header rule (`position: static`) to prevent row coverage.

## Boundary

No live GitHub write was performed because that requires the repository owner's private token. GitHub publishing code uses the Repository Contents API and clears token fields after every attempt.
