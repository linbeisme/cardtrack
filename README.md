# CardTrack v5.2.3

CardTrack is a static GitHub Pages application for researching, validating, storing, and comparing U.S. credit-card welcome offers, recurring benefits, transfer partners, active transfer bonuses, and editorial CPP valuations.

## Prompt Manager workflow

For each category, select the category first, then choose one of four provider/workflow combinations:

- ChatGPT · 1-Step Regular Search
- Gemini · 1-Step Regular Search
- ChatGPT · 2-Step Deep Research
- Gemini · 2-Step Deep Research

CardTrack automatically injects today's date, the current active card catalog, relevant stored data, the exact CardTrack schema, and the approved source-domain policy for the selected category. Adding or restoring a card updates every resolved prompt immediately; archived cards are excluded.

## Reliable JSON transport

All final-output prompts now require exactly one fenced `json` code block. This prevents chat interfaces from converting literal URLs into rendered Markdown links. CardTrack accepts either the complete code block or only its contents and removes the outer fence automatically.

The generated prompts prohibit:

- Markdown links inside JSON values
- ChatGPT citation wrappers and Gemini/Google grounding links
- Search-result and redirect URLs
- URL-encoded JSON punctuation such as `%22` or `%7B`
- Smart quotes, comments, trailing commas, prose outside the JSON, and truncated arrays

A built-in prompt preflight confirms that the catalog, schema, source policy, transport contract, and parse audit are present before copying. A **Copy JSON Repair Prompt** button provides a provider-specific correction prompt when a returned response still fails parsing or validation.

## Category-specific source validation

CardTrack applies a separate URL policy to each import type:

- `offers`: approved issuer and trusted editorial domains
- `cardDetails`: issuer, airline, hotel, loyalty-program, payment-network, lounge, government, selected benefit-provider, and trusted editorial domains
- `transferPrograms`: issuer, airline, hotel, loyalty-program, and trusted editorial domains
- `transferBonuses`: issuer, airline, hotel, loyalty-program, and trusted editorial domains
- `valuations`: direct The Points Guy URLs only

All accepted URLs must be direct HTTPS pages. Common Google redirects are normalized when the destination is approved; unapproved or unresolvable wrappers are rejected with the received host and supplied URL.

## Standard workflow

1. Open **Admin Publisher → Prompt Manager**.
2. Select the data category.
3. Select one-step or two-step.
4. Select ChatGPT or Gemini.
5. Confirm Prompt Preflight is green.
6. Copy the resolved prompt.
7. Run it in the selected service.
8. Use the response code-block Copy button.
9. Paste the complete code block into CardTrack's schema tester.
10. Copy validated JSON to Publisher, apply it, and save the appropriate file to GitHub.

For two-step Deep Research, Step 1 creates a structured evidence ledger with direct canonical URLs. Step 2, used in the same conversation, converts that ledger into the final JSON code block.

## Prompt Library publishing

The Prompt Manager stores template edits in `site/data/prompts.json`. After a successful save, it displays the local date and time the library was last saved to GitHub. GitHub tokens are cleared after every attempt.

## Security

Use a fine-grained GitHub personal access token limited to the CardTrack repository with only **Contents: Read and write**. CardTrack does not store the token in local storage or GitHub.
