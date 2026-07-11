# Read This First — v4.1 Update-Only Package

This package updates the existing CardTrack repository and intentionally excludes `site/data/cardtrack.json`. Your saved cards and offers are preserved.

Upload the contents of this folder to the repository root and overwrite matching files. Commit to `main`, then watch the GitHub Actions run.

The required fix is in `site/lib/schema.mjs` and `scripts/validate-data.mjs`; upload all included files so the tests, UI, and documentation stay synchronized.
