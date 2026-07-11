# CardTrack v5.2.1 Release Notes

## Category-specific source validation
- Welcome offers remain restricted to approved issuer and trusted editorial domains.
- Card facts and benefits now accept direct official sources from issuers, airlines, hotels, loyalty programs, payment networks, lounge programs, government benefit pages, and selected benefit providers.
- Transfer partners and transfer bonuses now accept direct official issuer, airline, hotel, and loyalty-program sources, with trusted editorial sources available as secondary confirmation.
- TPG CPP valuation imports remain restricted to direct `thepointsguy.com` URLs.

## Safer URL handling
- Search-result links, ChatGPT/Gemini citation wrappers, redirects, shortened links, cached links, affiliate redirects, and unapproved domains remain rejected.
- Validation errors now identify the rejected hostname and the applicable data category.
- Benefit-level `sourceUrl` fields are validated using the Card Facts source policy.

## Prompt Manager updates
- Every one-step and two-step prompt now includes the exact approved-domain list for its selected category.
- The source policy is injected even when a user has customized the underlying saved prompt.
- Full Data Refresh prompts include separate domain rules for offers, card facts, transfer partners, and transfer bonuses.

## Compatibility
- Database schema remains v5.
- Prompt Library schema remains v3.
- Existing cards, offers, saved prompts, transfer data, fact sheets, and valuations do not require migration.
