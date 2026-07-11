# Repository cleanup

The only valid workflow directory is `.github/workflows`. Delete the misspelled `.hithub` directory.

CardTrack deploys the `site` folder. JavaScript modules belong in `site/lib`. Delete the stale root-level `lib` directory after confirming `site/lib/schema.mjs`, `site/lib/prompts.mjs`, and `site/lib/github.mjs` exist.

Keep these root folders: `.github`, `docs`, `scripts`, `site`, and `tests`.
