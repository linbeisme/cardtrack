# CardTrack Option A - GitHub Publisher v3

CardTrack is a GitHub-only static website for tracking credit-card welcome offers. It does **not** call Gemini or ChatGPT APIs. Instead, the owner:

1. Opens the built-in research prompt.
2. Runs the prompt manually in ChatGPT or Gemini with live web research.
3. Pastes the returned JSON into CardTrack.
4. Validates the data in the browser.
5. Publishes the unified database to GitHub with a restricted fine-grained personal access token.
6. GitHub Actions validates and redeploys the site.

## Main features

- Elevated and limited-time promotion badges
- Expiration dates when supported
- Separate public, targeted, referral, branch, and mailer channels
- Prompt pop-up with one-click clipboard copy
- JSON validation and preview before publishing
- Add new cards
- Hide/archive active cards
- Separate Archived Cards tab with restore controls
- GitHub Contents API publishing
- Token is entered only when publishing and is never stored
- No npm, Vite, React, Cloudflare, Gemini API key, or paid search API

## Repository structure

```text
.github/workflows/deploy-pages.yml
site/
  index.html
  styles.css
  app.js
  lib/schema.mjs
  lib/github.mjs
  data/cardtrack.json
scripts/validate-data.mjs
tests/run-tests.mjs
docs/
README.md
WORKFLOW_COPY_PASTE.yml
```

## Quick start

1. Create a new public GitHub repository named `cardtrack`.
2. Upload the contents of this package to the repository root.
3. If `.github` is skipped, create `.github/workflows/deploy-pages.yml` manually and paste the contents of `WORKFLOW_COPY_PASTE.yml`.
4. Go to **Settings -> Pages** and set **Source** to **GitHub Actions**.
5. Wait for the validation/deployment workflow to finish.
6. Create a fine-grained GitHub token limited to the `cardtrack` repository with **Contents: Read and write**.
7. Open CardTrack -> **Admin Publisher**.
8. Use the Research Prompt, validate the returned JSON, enter the token, and click **Save to GitHub**.

See `docs/CardTrack_Option_A_User_Setup_Guide.docx` for beginner instructions with screenshots.

## Security model

The public site contains no secret. The GitHub token:

- is typed into a password field only when publishing;
- is held only in page memory;
- is cleared after the test/save attempt;
- is never placed in localStorage, cookies, the repository, or the JSON database;
- should be restricted to one repository with only Contents read/write permission;
- should have an expiration date.

## Validation

Run locally with Node.js:

```bash
node scripts/validate-data.mjs
node tests/run-tests.mjs
```

The GitHub Pages workflow runs both commands before deployment.

## Important limitation

A fine-grained personal access token can update repository contents, but it remains a credential. Use it only on trusted devices and browsers. For multi-user or commercial deployment, replace the browser token design with a GitHub App or a server-side authorization layer.
