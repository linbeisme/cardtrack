# CardTrack v4.1 Release Notes

## Backward-compatible database validation

CardTrack now accepts legacy v3 card records where `isArchived` and/or `archivedAt` are omitted. A provided invalid value is still rejected.

## Automatic compatibility normalization

On load and during GitHub Actions validation, CardTrack normalizes legacy data in memory:

- Missing `isArchived` becomes `false`.
- Missing `archivedAt` becomes `null`.
- Missing `annualFeeWaivedFirstYear` is converted to an explicit boolean using the existing note-based fallback.
- `compatibilityVersion` is set to `1`.

The website works immediately without editing `site/data/cardtrack.json`. The Admin Publisher displays a notice when normalization occurred. Saving the database once writes the normalized fields permanently.

## Version visibility

The header now shows the application version and the data schema/compatibility version on desktop.

## Workflow filename

The package uses `.github/workflows/update-and-deploy.yml`, matching the workflow already used by the existing CardTrack repository.

## Scope

All CardTrack v4 Prompt Manager, TPG valuation, annual-fee, first-year-waiver, and table-header fixes remain included.
