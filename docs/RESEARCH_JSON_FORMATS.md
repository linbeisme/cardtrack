# CardTrack v5.1 Research JSON Formats

The Prompt Manager now generates four workflow variants for every category:

1. ChatGPT one-step regular Search
2. Gemini one-step regular Search
3. ChatGPT two-step Deep Research
4. Gemini two-step Deep Research

For two-step Deep Research, run Step 1 first, then paste Step 2 into the same conversation. The final response must be one raw JSON object without Markdown fences.

## Welcome offers

```json
{
  "schemaVersion": 5,
  "dataType": "offers",
  "generatedAt": "2026-07-11T12:00:00Z",
  "dataStatus": "partial",
  "offers": [],
  "errors": [],
  "validation": {"acceptedCount": 0, "rejectedCount": 0}
}
```

## Card facts and benefits

```json
{
  "schemaVersion": 5,
  "dataType": "cardDetails",
  "generatedAt": "2026-07-11T12:00:00Z",
  "cardDetails": [],
  "errors": []
}
```

## Transfer partners

```json
{
  "schemaVersion": 5,
  "dataType": "transferPrograms",
  "generatedAt": "2026-07-11T12:00:00Z",
  "transferPrograms": [],
  "errors": []
}
```

## Active transfer bonuses

```json
{
  "schemaVersion": 5,
  "dataType": "transferBonuses",
  "generatedAt": "2026-07-11T12:00:00Z",
  "transferBonuses": [],
  "errors": []
}
```

## TPG valuations

```json
{
  "schemaVersion": 1,
  "dataType": "valuations",
  "sourceName": "The Points Guy",
  "sourceUrl": "https://thepointsguy.com/loyalty-programs/monthly-valuations/",
  "asOf": "2026-07",
  "updatedAt": "2026-07-11T12:00:00Z",
  "disclaimer": "Estimated editorial values, not issuer guarantees.",
  "programs": {}
}
```
