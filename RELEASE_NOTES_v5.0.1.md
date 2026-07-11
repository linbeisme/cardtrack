# CardTrack v5.0.1 Release Notes

## Compatibility hotfix

This release fixes GitHub Actions failures when the v5 update-only package is installed over an older CardTrack repository whose saved database and prompt library do not yet contain the new v5 arrays and templates.

### Fixed

- Unit tests now migrate saved legacy database and prompt files before testing.
- Section imports initialize missing `cardDetails`, `transferPrograms`, and `transferBonuses` arrays automatically.
- Transfer-bonus validation tolerates a legacy database with no transfer-program array.
- Prompt resolution tolerates missing legacy arrays and gives a clear error for an unavailable template.
- Added regression tests for update-only installation over legacy data.

No existing card, offer, prompt customization, or valuation data is replaced by the update-only package.
