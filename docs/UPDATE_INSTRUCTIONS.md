# Beginner GitHub Update Instructions — CardTrack v5.1.0

Use the **Update-Only** package for an existing CardTrack repository.

1. Download and unzip `CardTrack_v5_1_0_Update_Only_Package.zip`.
2. Open the existing `cardtrack` repository on GitHub.
3. Click **Code → Add file → Upload files**.
4. Drag the contents inside the unzipped package into GitHub.
5. Confirm paths begin with `site/`, `tests/`, `docs/`, or a root documentation filename.
6. Confirm the upload does **not** include:
   - `site/data/cardtrack.json`
   - `site/data/prompts.json`
   - `site/data/tpg-valuations.json`
7. Use the commit message: `Upgrade CardTrack to v5.1.0`.
8. Commit directly to `main`.
9. Open **Actions** and wait for both `validate` and `deploy` to show green checks.
10. Open the published site and hard-refresh it.

Windows: `Ctrl + Shift + R`  
Mac: `Command + Shift + R`

## First v5.1 prompt test

1. Open **Admin Publisher → Prompt Manager**.
2. Confirm the category dropdown has a light-yellow background.
3. Select **Welcome Offers — Full Catalog**.
4. Select **1-Step · Regular Search** and **ChatGPT**.
5. Confirm the resolved preview says ChatGPT Search and includes the active card catalog.
6. Switch to **2-Step · Deep Research**.
7. Confirm both **Step 1 · Research Report** and **Step 2 · JSON Conversion** are available.
8. Switch the platform to **Gemini** and confirm the resolved prompt changes.
9. Save the Prompt Library to GitHub. The displayed **Last saved to GitHub** time should update.

Adding a new active card automatically inserts it into all resolved category prompts; no separate prompt edit is required.
