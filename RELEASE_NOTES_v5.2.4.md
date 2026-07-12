# CardTrack v5.2.4 Release Notes

## Requested workflow improvements

- **Clear Import** now empties the import box, clears validation, and resets **Import Type** to **Auto-detect** while preserving the selected import mode.
- Both fine-grained GitHub token fields now use a distinct light-blue background in day mode and a readable blue treatment in night mode.
- Prompt Manager's JSON tester now includes a **Clear** button that removes the entered JSON, validation result, accepted/rejected counts, and disables Copy to Publisher until a new test passes.
- Card names in **Current Offers** are now internal links to the matching tombstone in **Fact Sheets**. The destination scrolls into view and is temporarily highlighted. If no fact sheet exists, CardTrack explains how to import one.

## Card Facts & Benefits persistence repair

The complete save path was hardened:

1. A validated import must be explicitly applied to the staged database.
2. Save Database is blocked while JSON remains unapplied in the import workflow.
3. The Admin Publisher now displays staged counts for cards, offers, fact sheets, transfer programs, and transfer bonuses.
4. Saving the database writes the staged database to GitHub, then reads the exact new commit back using its commit SHA.
5. CardTrack validates the read-back JSON and requires it to match the staged database exactly, including the fact-sheet count.
6. The success message reports how many fact sheets were committed.

This makes cross-browser persistence directly verifiable rather than inferred from a successful PUT request.

## Compatibility

- Database schema remains v5 / compatibility v2.
- Existing cards, offers, prompts, valuations, transfer data, and fact sheets remain compatible.
- The update-only package excludes live data files.
