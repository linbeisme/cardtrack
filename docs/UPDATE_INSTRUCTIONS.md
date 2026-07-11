# CardTrack v4.1.1 Hotfix Instructions

1. Back up the current GitHub repository with **Code → Download ZIP**.
2. Unzip the CardTrack v4.1.1 hotfix update-only package.
3. At the repository root, choose **Add file → Upload files**.
4. Upload the contents inside `CardTrack_v4_1_1_Update_Only`, preserving the folder paths.
5. Confirm no files under `site/data/` are in the upload list.
6. Commit directly to `main` with the message `Fix CardTrack TPG valuation startup crash`.
7. Open **Actions** and wait for **Validate and deploy CardTrack** to finish with a green check.
8. Hard refresh the CardTrack website.

The v4.1.1 hotfix assigns the loaded TPG valuation snapshot before the first render, preventing the `Cannot read properties of null (reading 'asOf')` startup crash.
