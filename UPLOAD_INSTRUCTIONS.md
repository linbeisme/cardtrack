# CardTrack v5.0.1 Hotfix Upload

This package fixes the GitHub Actions unit-test failures seen after installing v5 over preserved v4 data.

Upload the contents of this folder to the root of the existing GitHub repository and allow GitHub to replace matching files.

Included files:

- `site/lib/schema.mjs`
- `site/lib/prompts.mjs`
- `tests/run-tests.mjs`
- `VERSION`
- `RELEASE_NOTES_v5.0.1.md`

The package does not contain any files under `site/data/`, so it cannot replace cards, offers, prompt customizations, or valuations.
