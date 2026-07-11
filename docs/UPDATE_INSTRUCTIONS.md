# CardTrack v4.1 Update Instructions

1. Back up the current GitHub repository with **Code → Download ZIP**.
2. Unzip the CardTrack v4.1 update-only package.
3. At the repository root, choose **Add file → Upload files**.
4. Upload the contents inside `CardTrack_v4_1_Update_Only`, preserving the folder paths.
5. Confirm `site/data/cardtrack.json` is not in the upload list.
6. Commit directly to `main` with the message `Fix CardTrack legacy database compatibility`.
7. Open **Actions** and wait for **Validate and deploy CardTrack** to finish with a green check.
8. Hard refresh the CardTrack website.

The v4.1 validator no longer fails merely because legacy cards omit `archivedAt`. The app normalizes old records automatically in the browser.
