# Beginner GitHub Update Instructions

1. Download and unzip the CardTrack v5.0 Update-Only package.
2. Open the existing CardTrack repository on GitHub.
3. Click **Code**, then **Add file**, then **Upload files**.
4. Drag the contents inside the unzipped package into GitHub.
5. Confirm paths begin with `site/`, `scripts/`, `tests/`, `.github/`, or `docs/`.
6. Confirm the upload does not include `site/data/cardtrack.json`, `site/data/prompts.json`, or `site/data/tpg-valuations.json`.
7. Enter the commit message `Upgrade CardTrack to v5.0`.
8. Commit directly to the `main` branch.
9. Open **Actions** and wait for both `validate` and `deploy` to show green checks.
10. Open the published site and hard-refresh it.

On Windows use `Ctrl + Shift + R`. On Mac use `Command + Shift + R`.
