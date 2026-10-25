# Prelude Release and Deployment Process

This document defines Prelude's release discipline and records the assumptions of the current deployment. It does not replace the automated workflow or the manual QA guidance in [`TESTING.md`](./TESTING.md).

## P2A implementation review and proposed 2.9.25

P2A starts from clean `master` / `76ba6c04f1b5a06005787821893644a30baf4dd4`, package **2.9.24**. That is the inspected local baseline, not evidence of deployment or Chromebook activation. The owner explicitly holds package 2.9.24 and all What's New entries during this implementation checkpoint. After code/physical acceptance, propose **2.9.25**, next sequence **20**, announcing longer selected passages and current/upcoming grand-staff reading. Release metadata needs separate approval; no Git or deployment action is authorized here.

Rollback requires care: the unchanged version-1 A1 database can now contain 5–16-measure or 768 KiB–2 MiB records. Older app builds reject those values. Do not clear or rewrite the ledger to make an old build accept it; preserve the data, close older tabs and use a compatible build. Existing old-client validation fails closed on incompatible records, including retention/replacement. No downgrade conversion or schema migration is implemented. The full-source 256 KiB, captured-attack 2,048 and 64-record bounds remain; browser quota can fail independently. Physical MIDI timing, read-ahead comfort and actual installed-PWA activation remain owner gates.

## v2.9.24 candidate and remaining gates

This metadata-only checkpoint prepares **2.9.24** and What's New sequence **19** for owner review. The inspected baseline is clean `master` at `5e26c2a5e3601f6fb0fe7bcc1db1267a4c8d6a7a`, package 2.9.23, containing the committed, owner-reviewed A1 MIDI reliability fix. The candidate announces explicitly choosing and remembering a MIDI piano, confirming notes arrive before performing, and a clear warning when no performance notes were captured. The first 18 entries, acknowledgement storage and all musical/input/persistence behavior remain unchanged. The announcement's October 24 candidate date does not assert publication, tagging or deployment.

Real MIDI-piano acceptance, owner release review/commit/push/tag, the candidate's Actions result, and actual site/existing installed-PWA activation remain separate gates. Local release-popup and PWA checks use actual 2.9.23 and 2.9.24 production artifacts at the same isolated origin; evidence is recorded in [TESTING.md](TESTING.md). Earlier release and implementation checks retain their historical scope.

Automatic Qualification remains OFF by default. Only deliberate owner confirmation after real physical testing enables future compatible attempts; release metadata, startup and imports cannot grant acceptance or promote provisional history.

## Versioning

Prelude uses Semantic Versioning and annotated Git tags named `vX.Y.Z`.

- `package.json` is the authoritative source for the version displayed in the application UI.
- For each meaningful owner-approved deployment, increment the semantic app version, add a corresponding What's New announcement, update relevant release history, and verify the displayed version and announcement. Use a patch bump by default; a minor or major bump requires explicit owner approval. Under this owner-approved release convention, not every internal commit needs a separate version bump or announcement.
- A released package version must match its Git tag: package version `2.6.2` corresponds to tag `v2.6.2`.
- Follow the owner's patch-default policy for backward-compatible changes; propose a minor release only for explicit owner approval.
- Breaking product or compatibility changes require explicit review before selecting a major version.
- Do not describe or date a version as released until its release commit and annotated tag exist.

The owner-approved roadmap documentation consolidation intentionally retains **2.8.6**. It creates no release, tag or version bump; historical version numbers elsewhere describe their original milestones.

## Curated Product Updates and Controlled PWA Reload

PWA Update + What's New is implemented in 2.8.8. User-facing entries in `src/features/app-update/app-updates.ts` are curated product updates: several internal commits may form one meaningful release announcement. Append unique stable IDs and strictly increasing positive sequences; do not renumber published entries or erase acknowledgement history. New meaningful deployments include the corresponding package version, concise title, publication date and pianist-facing changes. Older entries retain their original optional version metadata. The normal release identity is **Prelude vX.Y.Z** from `package.json`; the embedded Git revision remains available under **Build details** for diagnostics and build verification. Curated publication metadata does not assert that Git tagging/deployment has occurred.

What's New is bundled with the loaded build and checked at startup. Known browser-local history collects all newer entries newest first; missing/malformed/unknown/pruned history shows only newest. `prelude-app-updates-last-seen-v1` stores ID/sequence. Got it, Close and Escape acknowledge the newest actually displayed entry; opening/backdrop clicks do not. Re-reading before writing preserves newer acknowledgments from other tabs/rollbacks. Storage failure allows current-visit dismissal but notes may return. No backend/account or historical reconstruction is involved.

Registration uses prompt mode. Update notices offer Reload/Later without stealing focus; Later leaves a small indicator. Plugin callbacks and controller changes never themselves reload the new application. Reload always confirms possible loss of active practice, reports, pending notes and unsaved/in-memory work, then activates a waiting worker if needed and navigates only that tab once. Already-activated external updates can reload after the same confirmation. There is no global save/recovery coordinator; existing feature-owned persistence and browser unload warnings remain authoritative. Registration-time, throttled online/foreground and hourly visible/online checks do not promise immediate discovery.

Activation is shared across tabs; consent to page reload is not. A tab choosing Later stays open if another tab activates, but superseded precache assets are not retained indefinitely. Verify piano/audio availability after cross-tab activation. First rollout is different: already-running 2.8.7 clients retain legacy auto-update callbacks, the first prompt worker may wait until they close, and legacy callbacks may still reload them if activation occurs while alive. Closing all old Prelude tabs/windows and reopening may be required; new code cannot retrofit old clients.

Release/update QA must use two actual production artifacts at the same test origin and `/prelude/` scope, both containing the prompt flow; build B has a newer curated entry than build A. Exercise Later, cancelled/confirmed Reload, acknowledged/no-unseen notes, two tabs, offline/online and cached audio. Separately use the legacy 2.8.7 artifact to check the first transition into 2.8.8. Follow the detailed procedure in [TESTING.md](./TESTING.md). Unit tests and dev mode do not establish installed-PWA/device support; deployment and first-transition evidence remain owner-controlled.

## Pre-Release Validation

Keep Unreleased history accurate while a candidate is being evaluated. Before finalizing a meaningful release:

1. Inspect branch, HEAD, index and worktree; preserve and account for any owner-approved uncommitted work in the cumulative review.
2. Synchronize the README, architecture, roadmap, onboarding, testing, and release-history documentation with actual behavior.
3. Run the complete automated gate:

   ```bash
   pnpm verify
   ```

4. Inspect the production build, including its generated PWA manifest, service worker, navigation fallback, and bundled assets.
5. Complete the manual desktop, Chromebook, phone/tablet, portrait/landscape, physical-MIDI, virtual-keyboard, accessibility, audio, persistence/import/export, and installed-PWA/offline smoke checks in [`TESTING.md`](./TESTING.md).
6. Resolve confirmed release blockers and rerun proportionate automated and manual checks.
7. Verify the approved package version and corresponding What's New entry in a fresh profile and a profile that acknowledged the previous release; check dismissal, reload and offline/PWA activation. Let the owner decide staging, commits, pushes, tags and deployment.

## Release Procedure

The repository owner performs Git and release operations:

1. Update `package.json` to the approved SemVer version and inspect lockfile metadata. The current pnpm lockfile v9 root importer contains dependency metadata, not the application version; a version-only bump requires no lockfile change or install. Do not regenerate it for release metadata.
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
- the `build` job uses `ubuntu-latest`, pnpm 10 and Node.js 22;
- only the dependent `deploy` job requires an available self-hosted Linux runner;
- dependencies are installed with the frozen lockfile;
- the canonical `pnpm verify` gate runs lint, type-checking, the full automated test suite, and the production build before deployment;
- the build uploads `prelude-dist` with one-day retention, and deploy downloads it;
- static output is copied with `rsync --delete` into `/var/www/prelude`;
- Nginx serves the application below `/prelude/`, matching the Vite base path, PWA scope/start URL, and navigation fallback;
- runner permissions, `rsync`, the target directory, Nginx configuration, TLS, storage, and rollback/backup procedures are operational responsibilities outside this repository.

Runner availability is required for deployment. A successful push or tag alone does not prove that production updated; inspect the workflow result and the live application.

The current workflow now invokes the same `pnpm verify` gate used for local release preparation. Broader CI redesign—such as matrices, environments, release jobs, or deployment-infrastructure changes—remains outside this cleanup phase.

## Failed or Partial Releases

If validation, deployment, or installed-PWA verification fails, stop and record the failure before taking further release actions. Prefer a new corrective commit and, when appropriate, a new SemVer release over moving or silently replacing a published tag. Never rewrite a public release marker casually.


## Build identity, compatibility and safe rollback

The primary UI identity derives its semantic version from `package.json`; the collapsed Build details disclosure retains the embedded revision and full diagnostic explanation. `build/build-revision.ts` independently verifies checkout metadata; CI supplies `PRELUDE_BUILD_REVISION` and requires a matching clean checkout. Never hardcode a release SHA in application source or retrieve Git data at runtime. Local uncommitted builds may show local changes or explicitly unavailable metadata. Verify both version and actual running revision after deployment; a reload prompt alone proves neither.

PWA registration remains prompt-based at `/prelude/`, with hashed assets and generated precache revisions. No manual cache-version edit is needed. What's New snapshots the bundled catalog at startup; service-worker events never open it mid-performance. Sequence 19 has a candidate publication date, not a claim of tagging/deployment. Got it, Close and Escape acknowledge the displayed notice; normal revisits suppress acknowledged entries, while storage failure can cause them to reappear. Reload/Later retains the existing active-work confirmation. Complete/save work and download temporary recordings before a deliberate reload.

Staff Builder Score V4 and `.prelude.json`, blocking Piece Practice records, strict Weekly Plan schema 1 / Weekly Program schema 2 and native V2 attempts retain their contracts. Rolodex stores full frozen music and keeps native A1 evidence independent from its date/progress acknowledgements. These are separate database transactions, not an atomic multi-store save; a crash between acknowledgements can leave A1 valid without a Rolodex update. In-memory Retry is not guaranteed after page termination.

Rolodex keeps database name `prelude-practice-rolodex-v1` at IndexedDB version 2. Existing schema-1 entries normalize to schema 2 without read-time rewriting. Backup v2 exports bounded history and prescriptions; imports accept v1/v2, mark restored history and do not enable physical acceptance or create native A1 acknowledgements. Raw A1 records are not included in Rolodex backups. Arbitrary pre-D binaries opening database version 1 cannot be assumed to read an already upgraded database.

Before an owner-controlled release push, retain a known-good **schema-compatible** production artifact beyond the one-day Actions retention and export important authored pieces/Rolodex entries. These exports do not back up all native history or physical-acceptance settings. This repository supplies no automated server backup, rollback or deployed-site smoke procedure. Infrastructure recovery remains an owner operation.

If deployment or acceptance fails, stop release activity, preserve browser data and use an owner-approved compatible artifact or a corrective forward commit. Do not delete/downgrade IndexedDB, clear site data, rewrite evidence, move published tags or deploy an arbitrary old binary as recovery. After recovery verify the served revision, existing-PWA activation and saved data. A push to `master` automatically starts verification and deployment: defer it until the owner explicitly authorizes going live.
