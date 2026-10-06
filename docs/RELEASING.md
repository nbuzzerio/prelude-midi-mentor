# Prelude Release and Deployment Process

This document defines Prelude's release discipline and records the assumptions of the current deployment. It does not replace the automated workflow or the manual QA guidance in [`TESTING.md`](./TESTING.md).

## Versioning

Prelude uses Semantic Versioning and annotated Git tags named `vX.Y.Z`.

- `package.json` is the authoritative source for the version displayed in the application UI.
- Every product-code commit includes a version bump so the visible version can confirm deployment and installed-PWA activation. Use a patch bump by default; a minor or major bump requires explicit owner approval. Documentation-only commits are exempt only when the owner explicitly approves the exemption.
- A released package version must match its Git tag: package version `2.6.2` corresponds to tag `v2.6.2`.
- Follow the owner's patch-default policy for backward-compatible changes; propose a minor release only for explicit owner approval.
- Breaking product or compatibility changes require explicit review before selecting a major version.
- Do not describe or date a version as released until its release commit and annotated tag exist.

The owner-approved roadmap documentation consolidation intentionally retains **2.8.6**. It creates no release, tag or version bump; historical version numbers elsewhere describe their original milestones.

## Curated Product Updates and Controlled PWA Reload

PWA Update + What's New is implemented in 2.8.8. User-facing entries in `src/features/app-update/app-updates.ts` are curated product updates: several commits may form one entry, and entries are not one-to-one with commits, package versions or tags. Append unique stable IDs and strictly increasing positive sequences; do not renumber published entries. Choose a concise title, publication date and user-facing change bullets, with optional descriptive version. Git SHA may remain diagnostic-only; package version remains authoritative for the visible app version. Curated publication metadata does not assert that Git tagging/deployment has occurred.

What's New is bundled with the loaded build and checked at startup. Known browser-local history collects all newer entries newest first; missing/malformed/unknown/pruned history shows only newest. `prelude-app-updates-last-seen-v1` stores ID/sequence. Got it, Close and Escape acknowledge the newest actually displayed entry; opening/backdrop clicks do not. Re-reading before writing preserves newer acknowledgments from other tabs/rollbacks. Storage failure allows current-visit dismissal but notes may return. No backend/account or historical reconstruction is involved.

Registration uses prompt mode. Update notices offer Reload/Later without stealing focus; Later leaves a small indicator. Plugin callbacks and controller changes never themselves reload the new application. Reload always confirms possible loss of active practice, reports, pending notes and unsaved/in-memory work, then activates a waiting worker if needed and navigates only that tab once. Already-activated external updates can reload after the same confirmation. There is no global save/recovery coordinator; existing feature-owned persistence and browser unload warnings remain authoritative. Registration-time, throttled online/foreground and hourly visible/online checks do not promise immediate discovery.

Activation is shared across tabs; consent to page reload is not. A tab choosing Later stays open if another tab activates, but superseded precache assets are not retained indefinitely. Verify piano/audio availability after cross-tab activation. First rollout is different: already-running 2.8.7 clients retain legacy auto-update callbacks, the first prompt worker may wait until they close, and legacy callbacks may still reload them if activation occurs while alive. Closing all old Prelude tabs/windows and reopening may be required; new code cannot retrofit old clients.

Release/update QA must use two actual production artifacts at the same test origin and `/prelude/` scope, both containing the prompt flow; build B has a newer curated entry than build A. Exercise Later, cancelled/confirmed Reload, acknowledged/no-unseen notes, two tabs, offline/online and cached audio. Separately use the legacy 2.8.7 artifact to check the first transition into 2.8.8. Follow the detailed procedure in [TESTING.md](./TESTING.md). Unit tests and dev mode do not establish installed-PWA/device support; deployment and first-transition evidence remain owner-controlled.

## Pre-Release Validation

Keep Unreleased history accurate while a candidate is being evaluated. The package version still advances with every product-code commit. Before finalizing a release:

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
   git tag -a v2.6.0 -m "Prelude v2.6.0"
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
- the canonical `pnpm verify` gate runs lint, type-checking, the full automated test suite, and the production build before deployment;
- static output is copied with `rsync --delete` into `/var/www/prelude`;
- Nginx serves the application below `/prelude/`, matching the Vite base path, PWA scope/start URL, and navigation fallback;
- runner permissions, `rsync`, the target directory, Nginx configuration, TLS, storage, and rollback/backup procedures are operational responsibilities outside this repository.

Runner availability is required for deployment. A successful push or tag alone does not prove that production updated; inspect the workflow result and the live application.

The current workflow now invokes the same `pnpm verify` gate used for local release preparation. Broader CI redesign—such as matrices, environments, release jobs, or deployment-infrastructure changes—remains outside this cleanup phase.

## Failed or Partial Releases

If validation, deployment, or installed-PWA verification fails, stop and record the failure before taking further release actions. Prefer a new corrective commit and, when appropriate, a new SemVer release over moving or silently replacing a published tag. Never rewrite a public release marker casually.
