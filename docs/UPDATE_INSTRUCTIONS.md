# Beginner GitHub Update Instructions — CardTrack v5.2.0

Use the **Update-Only** package for an existing CardTrack repository.

1. Download and unzip `CardTrack_v5_2_0_Update_Only_Package.zip`.
2. Open the existing `cardtrack` repository on GitHub.
3. Click **Code → Add file → Upload files**.
4. Drag the contents inside the unzipped package into GitHub.
5. Confirm paths begin with `site/`, `tests/`, `docs/`, or a root documentation filename.
6. Confirm the upload does **not** include:
   - `site/data/cardtrack.json`
   - `site/data/prompts.json`
   - `site/data/tpg-valuations.json`
7. Use the commit message: `Upgrade CardTrack to v5.2.0`.
8. Commit directly to `main`.
9. Open **Actions** and wait for both `validate` and `deploy` to show green checks.
10. Open the published site and hard-refresh it.

Windows: `Ctrl + Shift + R`  
Mac: `Command + Shift + R`

## Verify the v5.2 changes

1. Confirm the app version displays **v5.2.0**.
2. Confirm every navigation tab has its own dark color.
3. Confirm the browser tab/bookmark uses the credit-card emoji.
4. Open **Admin Publisher** and confirm its four numbered panels use different background shades.
5. Open **Current Offers** and click each KPI card to filter the table.
6. Open **Transfer Bonuses** and confirm each active bonus shows a labeled expiration date and remaining time.
7. Open **Fact Sheets** and confirm:
   - each card has an offer-status badge in the upper-right corner;
   - top and unique benefits appear first;
   - all remaining imported benefits are listed below.
8. Open **Prompt Manager → Card Facts & Benefits** and save the updated Prompt Library to GitHub so future research requests include the complete-benefit and top/unique fields.
