# Prelude Release and Deployment Process

This document defines Prelude's release discipline and records the assumptions of the current deployment. It does not replace the automated workflow or the manual QA guidance in [`TESTING.md`](./TESTING.md).

## Versioning

Prelude uses Semantic Versioning and annotated Git tags named `vX.Y.Z`.

- `package.json` is the authoritative source for the version displayed in the application UI.
- A released package version must match its Git tag: package version `2.5.0` corresponds to tag `v2.5.0`.
- Backward-compatible feature additions generally require a minor version.
- Backward-compatible fixes generally require a patch version unless the release context warrants a different choice.
- Breaking product or compatibility changes require explicit review before selecting a major version.
- Do not describe or date a version as released until its release commit and annotated tag exist.

## Pre-Release Validation

Keep the package version and Unreleased history unchanged while a candidate is still being evaluated. Before finalizing them:

1. Confirm the working tree starts clean and the intended commits are on `master`.
2. Synchronize the README, architecture, roadmap, onboarding, testing, and release-history documentation with actual behavior.
3. Run the complete automated gate:

   ```bash
   pnpm verify
   ```

4. Inspect the production build, including its generated PWA manifest, service worker, navigation fallback, and bundled assets.
5. Complete the manual desktop, Chromebook, phone/tablet, portrait/landscape, physical-MIDI, virtual-keyboard, accessibility, audio, persistence/import/export, and installed-PWA/offline smoke checks in [`TESTING.md`](./TESTING.md).
6. Resolve confirmed release blockers and rerun proportionate automated and manual checks.
7. Only after validation passes, finalize the package version and release notes.

## Release Procedure

The repository owner performs Git and release operations:

1. Update `package.json` to the approved SemVer version and update `pnpm-lock.yaml` through pnpm so their root metadata agrees.
2. Move the relevant entries in [`DEVLOG.md`](./DEVLOG.md) from Unreleased into a dated version section and finalize user-facing release notes.
3. Run `pnpm verify` again and confirm the manual release gate remains satisfied.
4. Review the final diff, then commit the version and release documentation.
5. Create an annotated tag matching the package version, for example:

   ```bash
   git tag -a v2.5.0 -m "Prelude v2.5.0"
   ```

6. Push the release commit and annotated tag.
7. Verify the GitHub Actions deployment completes successfully.
8. Smoke-test the deployed `/prelude/` application and verify an installed PWA discovers and activates the release. Account for service-worker update timing and test a fresh install as well as an existing installation.

Do not tag or publish merely because automated tests pass; hardware, browser, responsive, accessibility, deployment, and PWA checks are part of the release gate.

## Current Deployment Reality

The current `.github/workflows/deploy.yml` workflow has these operational assumptions:

- every push to `master` starts deployment;
- the job requires an available self-hosted Linux GitHub Actions runner;
- the runner installs pnpm 10 and uses Node.js 22;
- dependencies are installed with the frozen lockfile;
- lint, type-check, and production build steps run before deployment;
- static output is copied with `rsync --delete` into `/var/www/prelude`;
- Nginx serves the application below `/prelude/`, matching the Vite base path, PWA scope/start URL, and navigation fallback;
- runner permissions, `rsync`, the target directory, Nginx configuration, TLS, storage, and rollback/backup procedures are operational responsibilities outside this repository.

Runner availability is required for deployment. A successful push or tag alone does not prove that production updated; inspect the workflow result and the live application.

The current workflow does not run the full test suite even though `pnpm verify` is Prelude's release gate. CI behavior will be tightened in a later cleanup phase; do not treat this document as evidence that the workflow has already changed.

## Failed or Partial Releases

If validation, deployment, or installed-PWA verification fails, stop and record the failure before taking further release actions. Prefer a new corrective commit and, when appropriate, a new SemVer release over moving or silently replacing a published tag. Never rewrite a public release marker casually.
