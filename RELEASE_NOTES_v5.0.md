# CardTrack v5.0.0 Release Notes

## New research and data capabilities

- Added separate views for Current Offers, Transfer Bonuses, Transfer Partners, Fact Sheets, and Compare.
- Added section-based JSON imports for welcome offers, card facts and benefits, transfer partners, transfer bonuses, TPG CPP valuations, and complete datasets.
- Added backward-compatible migration from the existing schemaVersion 3 database to schemaVersion 5.
- Added a default prompt library that is merged with the user's saved prompt customizations in the browser.
- Added Prompt Manager templates for Full Data Refresh, Welcome Offers, Card Facts, Transfer Partners, Transfer Bonuses, TPG Valuations, Amex, Chase, Hotels, and Airlines.
- Added automatic insertion of today's date, the active card catalog, and a current-data summary into prompts.

## New interface features

- Different background colors for Active Cards, Verified Offers, Elevated/Limited, and Needs Review KPI cards.
- Four rotating row background shades for easier card-line identification.
- Larger Promotion text and status badges.
- Elevated and Limited Time badge text uses a subtle flashing pulse. The pulse is disabled automatically when the user's device requests reduced motion.
- Added card fact-sheet cards with bonus value, annual fee, first-year waiver, credits, perks, estimated first-year value, and value tier.
- Added side-by-side comparison for up to four cards.
- Added transfer partners by program and by card.
- Added transfer-bonus countdowns based on imported end dates.

## Safety and compatibility

- The update-only package does not contain `site/data/cardtrack.json`, `site/data/prompts.json`, or `site/data/tpg-valuations.json`.
- Existing offers, saved prompt edits, and valuations are preserved during upload.
- Existing v3 data is normalized in memory before validation or display.
- Partial imports update only the chosen section and preserve unrelated data.
