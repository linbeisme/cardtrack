# CardTrack v5.2.3 Update-Only

This package is based on v5.2.2 and preserves your existing live files:

- `site/data/cardtrack.json`
- `site/data/prompts.json`
- `site/data/tpg-valuations.json`

Upload the contents of this package to the repository root. Do not upload the outer package folder.

After deployment:

1. Open CardTrack in a new private/incognito window.
2. Confirm the version badge shows `App v5.2.3`.
3. Open **Admin Publisher → Prompt Manager**.
4. Click **Restore Default** for a category only when you want to discard a prior custom category body.
5. Click **Save Prompt Library to GitHub** once so the Prompt Library schema and transport metadata are saved.
6. Use the code-block Copy button on model output and paste the complete block into CardTrack.

The update-only package includes `site/data/default-prompts.json` because it supplies the new default category tasks and hard output contracts. It does not replace your saved `prompts.json`; migration preserves custom prompt text and appends the new non-editable schema, source, transport, and repair contracts automatically.
