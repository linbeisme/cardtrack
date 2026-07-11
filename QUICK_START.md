# Quick Start

1. Create a new public GitHub repository named `cardtrack`.
2. Upload the contents of this package to the repository root.
3. If the Actions tab shows no workflow, create `.github/workflows/deploy-pages.yml` and paste `WORKFLOW_COPY_PASTE.yml`.
4. Settings -> Pages -> Source -> GitHub Actions.
5. Wait for the validation and deployment workflow to succeed.
6. Create a fine-grained personal access token restricted to `cardtrack` with Contents: Read and write.
7. Open the published site -> Admin Publisher -> Research Prompt.
8. Run the copied prompt in ChatGPT or Gemini, paste the JSON, validate, and apply it.
9. Paste the GitHub token and click Save to GitHub.
10. Wait for GitHub Pages to redeploy, then reload the site.

The token is not stored. Keep it in a password manager and use a separate token per device when practical.
