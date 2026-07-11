# CardTrack v5.2.2

CardTrack is a static GitHub Pages application for researching, validating, storing, and comparing U.S. credit-card welcome offers, benefits, transfer partners, active transfer bonuses, and editorial CPP valuations.

## Prompt Manager workflow

For every category, select the category first, then choose one of four provider/workflow combinations:

- ChatGPT · 1-Step Regular Search
- Gemini · 1-Step Regular Search
- ChatGPT · 2-Step Deep Research
- Gemini · 2-Step Deep Research

The one-step prompt performs research and asks for CardTrack JSON in one response. The two-step workflow provides a Step 1 research-report prompt and a Step 2 JSON-conversion prompt for use in the same Deep Research conversation.

CardTrack automatically injects today's date, the current active card catalog, relevant stored data, and the exact approved source-domain list for the selected data category. Adding or restoring a card updates every resolved prompt immediately; archived cards are excluded.

## Category-specific source validation

CardTrack applies a different URL policy to each import type:

- `offers`: approved issuer and trusted editorial domains
- `cardDetails`: issuer, airline, hotel, loyalty-program, payment-network, lounge, government, selected benefit-provider, and trusted editorial domains
- `transferPrograms`: issuer, airline, hotel, loyalty-program, and trusted editorial domains
- `transferBonuses`: issuer, airline, hotel, loyalty-program, and trusted editorial domains
- `valuations`: direct The Points Guy URLs only

All accepted URLs must be direct HTTPS pages. Search-result links, citation wrappers, redirects, shortened links, affiliate redirects, cached pages, and unapproved hosts are rejected.

## Standard workflow

1. Open **Admin Publisher → Prompt Manager**.
2. Select the data category.
3. Select one-step or two-step.
4. Select ChatGPT or Gemini.
5. Copy the resolved prompt.
6. Run it in the selected service.
7. Paste the returned JSON into the CardTrack schema tester.
8. Copy the validated JSON to Publisher, apply it, and save the appropriate file to GitHub.

## Prompt Library publishing

The Prompt Manager stores template edits in `site/data/prompts.json`. After a successful save, it displays the exact local date and time the library was last saved to GitHub. GitHub tokens are cleared after every attempt.

## Data sections

- `offers`: current public and non-public welcome offers
- `cardDetails`: recurring credits, perks, protections, earning rates, lounge access, status and airline/hotel benefits
- `transferPrograms`: standard transfer partners and ratios
- `transferBonuses`: active promotional transfer bonuses
- `tpg-valuations.json`: editorial cents-per-point estimates

## Security

Use a fine-grained GitHub personal access token limited to the CardTrack repository with only **Contents: Read and write**. CardTrack does not store the token in local storage or GitHub.
