# CardTrack v5.2.5 Release Notes

## GitHub Actions hotfix

- Fixed the section-merge unit test so it works when the preserved live repository already contains Card Facts for multiple cards.
- The test now verifies that unrelated offers, transfer programs, transfer bonuses, and existing fact sheets remain unchanged.
- Compact current-data summaries are now injected into Card Facts and Complete Refresh prompts instead of the full nested fact-sheet database.
- This keeps one-step ChatGPT and Gemini prompts below the configured provider-size guard while preserving identifiers, freshness, counts, top-benefit names, and source-host context.
- No live database, prompt library, or TPG valuation file is replaced by the update-only package.
