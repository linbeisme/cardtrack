# Read This First — v5.0 Update-Only Package

Use this package to upgrade an existing CardTrack repository.

The package intentionally excludes:

- `site/data/cardtrack.json`
- `site/data/prompts.json`
- `site/data/tpg-valuations.json`

Therefore, uploading the package does not replace your current cards, offers, saved prompt edits, or TPG valuation snapshot.

Upload the contents of this package into the root of the existing GitHub repository. Allow GitHub to replace files with the same paths. Do not upload the outer package folder as an extra directory.

After the commit, wait for the GitHub Actions validate and deploy jobs to turn green, then hard-refresh the published site.
