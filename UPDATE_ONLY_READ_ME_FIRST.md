# CardTrack v5.2.5 Update-Only

This hotfix is based on v5.2.4 and preserves your existing live files:

- `site/data/cardtrack.json`
- `site/data/prompts.json`
- `site/data/tpg-valuations.json`

It fixes GitHub Actions failures caused by repositories that already contain Card Facts and by oversized one-step prompts.

Upload the contents of this package to the repository root. Do not upload the outer package folder.

After deployment:

1. Confirm the newest GitHub Actions run shows green checks for `validate` and `deploy`.
2. Open CardTrack in a new private/incognito window.
3. Confirm the version badge shows `App v5.2.5`.
4. Open **Admin Publisher → Prompt Manager**.
5. Use Prompt Preflight before copying a one-step or two-step prompt.
6. Save the Prompt Library to GitHub only when you have unsaved prompt edits or migration changes.

The update-only package includes `site/data/default-prompts.json` but does not replace your saved `prompts.json`.
