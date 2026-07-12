# Prompt Manager Workflow — v5.2.4

## One-step Search

1. Select a category.
2. Select **1-Step · Regular Search**.
3. Select ChatGPT or Gemini.
4. Confirm the Prompt Preflight chips are green.
5. Copy the prompt.
6. Run it in normal ChatGPT Search or normal Gemini with Google Search, not Deep Research.
7. The only visible response should be one fenced `json` code block.
8. Use the code-block Copy button.
9. Paste the entire code block into **Test returned JSON against CardTrack schema**.

## Two-step Deep Research

1. Select a category.
2. Select **2-Step · Deep Research**.
3. Select ChatGPT or Gemini.
4. Copy **Step 1 · Evidence Ledger** and run it in a new Deep Research conversation.
5. Wait for the complete evidence ledger.
6. Return to Prompt Manager and select **Step 2 · JSON Conversion**.
7. Copy Step 2 into the same Deep Research conversation.
8. Use the code-block Copy button on the final JSON response.
9. Paste the complete code block into CardTrack.

## JSON Repair Prompt

When a response fails parsing or validation:

1. Keep the original model conversation open.
2. In Prompt Manager, keep the same category and provider selected.
3. Click **Copy JSON Repair Prompt**.
4. Paste it into the same model conversation.
5. The repair prompt rebuilds the complete response rather than patching a fragment.
6. Copy the repaired JSON code block and retest it.

The repair prompt covers:

- Narrative reports instead of JSON
- Missing catalog/schema sections
- Markdown links inside fields
- Citation and grounding wrappers
- Google/Bing redirects
- URL-encoded JSON punctuation
- Missing commas, trailing commas, comments, smart quotes, truncation, and unescaped quotation marks
- Wrong JSON types, duplicate IDs, missing timestamps, and invalid source URLs

## Copy/paste rules

Use the model's code-block Copy button whenever available. CardTrack accepts:

- The entire fenced `json` block
- Only the content inside the block
- A single JSON object with incidental text before or after it

Do not manually copy rendered hyperlinks. Never paste a narrative research report into the JSON tester.
