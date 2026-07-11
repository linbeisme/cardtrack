# CardTrack v5.1.0 Update-Only Package

Upload the contents of this folder into the root of the existing GitHub repository.

This package intentionally excludes:

- `site/data/cardtrack.json`
- `site/data/prompts.json`
- `site/data/tpg-valuations.json`

Your cards, offers, saved prompt edits, transfer data, and valuations remain intact. The new `site/data/default-prompts.json` is included so the saved Prompt Library can be migrated safely to schema v3.

Suggested commit message: `Upgrade CardTrack to v5.1.0`
