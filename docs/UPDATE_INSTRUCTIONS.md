# Beginner GitHub Update Instructions — CardTrack v5.2.4

Use the **Update-Only** package for an existing CardTrack repository.

1. Download and unzip `CardTrack_v5_2_1_Update_Only_Package.zip`.
2. Open the existing `cardtrack` repository on GitHub.
3. Click **Code → Add file → Upload files**.
4. Drag the contents inside the unzipped package into GitHub.
5. Confirm paths begin with `site/`, `tests/`, `docs/`, or a root documentation filename.
6. Confirm the upload does **not** include:
   - `site/data/cardtrack.json`
   - `site/data/prompts.json`
   - `site/data/tpg-valuations.json`
7. It is correct for the update to include `site/data/default-prompts.json`.
8. Use the commit message: `Upgrade CardTrack to v5.2.4`.
9. Commit directly to `main`.
10. Open **Actions** and wait for both `validate` and `deploy` to show green checks.
11. Open the published site and hard-refresh it.

Windows: `Ctrl + Shift + R`  
Mac: `Command + Shift + R`

## Save the updated Prompt Library

1. Open **Admin Publisher → Prompt Manager**.
2. Select **Card Facts & Benefits**.
3. Confirm the resolved prompt contains a section titled **APPROVED DOMAINS FOR CARD FACTS AND BENEFITS**.
4. Confirm it lists official domains such as `marriott.com`, `hyatt.com`, `delta.com`, `prioritypass.com`, `visa.com`, and `mastercard.com`.
5. Paste your fine-grained GitHub token.
6. Click **Save Prompt Library to GitHub**.
7. Wait for the new GitHub Actions deployment to finish.

## Retry the rejected Card Facts JSON

The prior JSON may now validate without being regenerated when its rejected URLs are direct official pages on the newly approved domains.

1. Paste the same Card Facts JSON into **Test returned JSON against CardTrack schema**.
2. Click **Test JSON**.
3. If all records pass, click **Copy to Publisher**, use **Merge / preserve unaffected data**, validate, apply, and save the database to GitHub.
4. If a URL still fails, read the new error. It will identify the rejected hostname. Replace only that URL with a direct canonical approved page; do not use search-result or citation-wrapper links.

## Verify v5.2.4

1. Confirm the app version displays **v5.2.4**.
2. Verify a direct official hotel or airline source is accepted for Card Facts.
3. Verify Google redirect, search-result, shortened, and citation-wrapper URLs remain rejected.
4. Confirm Welcome Offers still use the stricter issuer/editorial source list.
5. Confirm Transfer Partners and Transfer Bonuses show their own approved-domain lists in Prompt Manager.


## v5.2.4 post-update checks

1. Open Admin Publisher and click Clear after selecting a non-auto import type; confirm it returns to Auto-detect.
2. Open Prompt Manager and confirm the JSON tester includes Clear.
3. Import and apply a Card Facts payload. The Publish section must show the staged Fact sheets count.
4. Save Database to GitHub. The success message must say the save was verified and report the fact-sheet count.
5. Open CardTrack in another browser or private window and confirm the Fact Sheets remain present.
6. From Current Offers, click a card name and confirm the matching Fact Sheet scrolls into view.
