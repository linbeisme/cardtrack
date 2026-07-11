# CardTrack v4.0 Release Notes

## Prompt Manager

The previous fixed research prompt is replaced with a managed library stored at `site/data/prompts.json`.

Included templates:

1. Full Catalog
2. Amex Only
3. Chase Only
4. Hotels
5. Airlines

Each template supports editing, syntax-highlighted placeholders, a resolved preview, copy, import/export, restore default, schema testing, and saving to GitHub.

## Data-schema extension

Research imports now require:

```json
"annualFeeWaivedFirstYear": false
```

The value must be boolean. Existing saved v3 data without this field remains readable; the UI can infer a waiver from a legacy note, but new imports must provide the explicit field.

## Table repair

The offer table header is no longer sticky. It remains inside the normal table flow and cannot cover the first result row.

## TPG valuation display

`site/data/tpg-valuations.json` contains a July 2026 CPP snapshot. CardTrack computes:

```
estimated value = bonus amount × CPP ÷ 100
```

Cash offers use face value. Companion tickets, statement credits, or mixed non-point benefits are excluded unless represented numerically in the saved bonus amount.

## Annual-fee display

Every row now includes a dedicated annual-fee column. A separate badge appears only when a first-year waiver is explicitly reported.
