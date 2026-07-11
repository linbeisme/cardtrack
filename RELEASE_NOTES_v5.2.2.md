# CardTrack v5.2.2

## Repair release

- Adds versioned browser asset URLs so GitHub Pages cannot keep an older validator module after deployment.
- Normalizes common Google redirect URLs to their direct approved HTTPS destination before validation and storage.
- Shows the rejected hostname and supplied URL when a source still fails validation.
- Adds non-blocking GitHub Actions warnings for the misspelled `.hithub` directory and stale root `/lib` directory.
- Preserves all existing CardTrack data in the update-only package.
