# Read This First — v4.1.1 Hotfix Update-Only Package

This hotfix updates the existing CardTrack repository and intentionally excludes all files under `site/data/`. Your saved cards, offers, prompts, and TPG valuation snapshot are preserved.

Upload the contents of this folder to the repository root and overwrite matching files. Commit to `main`, then watch the GitHub Actions run.

The startup fix is in `site/app.js`. Upload all included files so the version number and regression tests stay synchronized.
