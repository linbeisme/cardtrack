# Security Notes

- Never commit a GitHub token or paste it into a prompt, JSON file, screenshot, issue, or chat.
- Use a fine-grained token limited to one repository and Contents read/write.
- The browser performs a GET for the current file SHA followed by a PUT to GitHub's Repository Contents API.
- Tokens are used only in memory and cleared after each test/save attempt.
- Imported source URLs are restricted to HTTPS and an approved-domain allowlist.
- Imported text is rendered with HTML escaping.
- Database and prompt-library validation run in the browser and again in GitHub Actions.
