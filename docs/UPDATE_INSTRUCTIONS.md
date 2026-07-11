# Update an Existing CardTrack v3 Repository

Use `CardTrack_v4_Update_Only.zip` for the safest upgrade.

1. Download and extract the update-only ZIP.
2. Open the `linbeisme/cardtrack` repository and choose **Add file → Upload files**.
3. Upload the extracted contents to the repository root. Preserve the folder paths.
4. Confirm that `site/data/cardtrack.json` is **not** included in the upload. This protects the currently published offers.
5. Commit directly to `main` with a message such as `Upgrade CardTrack to v4 Prompt Manager`.
6. Open **Actions → Validate and deploy CardTrack** and wait for both jobs to turn green.
7. Open the CardTrack site and perform a hard refresh.
8. Open **Admin Publisher → Prompt Manager** and confirm the five templates appear.

The update creates two new files:

- `site/data/prompts.json`
- `site/data/tpg-valuations.json`

It updates the application, schema validator, tests, workflow, and documentation.

## Important compatibility note

New researched offer JSON must include `annualFeeWaivedFirstYear` as `true` or `false`. Existing saved offers continue to load even when the field is absent.
