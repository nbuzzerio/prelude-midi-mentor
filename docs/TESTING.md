# Prelude: MIDI Mentor — Testing

## Local QA directory layout

Generated browser profiles and disposable historical runs belong in `.dev/qa-runs/`. Local QA scripts use `.dev/qa-run-paths.mjs` to create unique run directories there. Source fixtures, scripts, logs, review manifests and source companions stay directly under `.dev` where applicable. The primary CxR artifact remains **`.dev/_git-diff.txt`**, with the existing `.dev/cxdu.sh` and `.dev/export-git-diff.cmd` workflow unchanged. Existing `.gitignore` rules already ignore run artifacts; this housekeeping does not change application versions or dependencies.

Historical evidence files retain their exact contents, including recorded absolute paths. **`.dev/qa-runs-relocations.json`** maps each former `.dev/<run-name>/` to `.dev/qa-runs/<run-name>/`; apply that prefix substitution when locating an old screenshot, downloaded fixture or profile. QA readers that consume recorded profile/session paths use `resolveQaPath()` from the local helper. `.dev/qa-runs-housekeeping.txt` records before/after counts, retained directories, verification and changed local scripts; `.dev/qa-runs-source.txt` contains the local-script companion. These local artifacts follow the existing ignored QA convention.

Do not move dependency stores, reusable build baselines, fixture/source directories, ambiguous fixed-name profiles or directories used by running Chrome/Node processes. The current migration leaves the active `preferred-export-interactive-cezWbw` session, `pnpm-store`, `microphone-spike`, `bundle-baseline-2.9.17`, `ledger-browser`, `ledger-chrome-profile` and `ledger-chrome-profile-2` at the `.dev` root. The microphone-spike sources, production baseline and ledger build remain reusable at their established paths; the fixed-name ledger profiles have ambiguous reuse. Future generated microphone-spike profiles also go under `qa-runs`, while its source and existing nested profiles remain untouched. Close active QA sessions before considering a later move, then add any relocation to the mapping without rewriting evidence.

Current pending package/application version is **2.9.21**; committed **2.9.20** is at `1003fa1a`. Test inventories below describe coverage; historical counts are labeled as historical. Report exact files/tests from a fresh `pnpm verify` in each validation handoff rather than treating an older count as current. Implementation, automated validation and physical support evidence are separate facts; the [rolling roadmap](./ROADMAP.md) preserves physical QA as a continuing lane.

## Export counters and PDF titles (pending 2.9.21 checkpoint 1)

Counter regressions cover name/format separation, shared sanitized/Unicode identities, reloads, manual high/low overrides, 000 rejection, 999 exhaustion and deliberate reuse, unavailable/corrupt/read-blocked/write-blocked storage and cross-tab re-reading. Mounted dialogs cover automatic Name changes versus explicit Number edits, storage-event refresh, retry, ordinary initiation versus native close, cancellation/denial/picker/create/write/close/extension failures, native renaming, duplicate requests and Strict Mode/unmount fences. Existing serialization, native Blob and recorder/evidence tests remain compatibility checks.

Print-title tests cover piece/preset/fallback sanitization, duplicate report suffixes, no `.pdf` or remembered PDF counter, mounted-before-print timing, afterprint/cancellation, thrown print, fallback/repeat, print-media exit, pagehide/pageshow/freeze, Strict Mode/unmount, overlapping ownership and independent application-title changes. Staff Builder library/Study View retain their shared flow; Piece Practice recovered reports and Practice Session reports have title assertions alongside existing content/options/pagination coverage. A mocked print function cannot prove Chrome's native suggested filename or saving.

Focused validation passes **18 files / 300 tests**; full `pnpm verify` passes **260 files / 3,785 tests**, plus lint, TypeScript and production build. Three new suites contribute to **56 additional tests** over the documented 2.9.20 baseline. Logs: `.dev/qol-checkpoint1-focused.log` and `.dev/qol-checkpoint1-verify.log`. Validation uses process-local `CI=true`, `pnpm_config_verify_deps_before_run=warn` and `pnpm_config_offline=true`: pnpm reports stale workspace metadata after the version bump, but existing pinned dependencies run without installation, external network access or lockfile changes. The existing acoustic-ref lint warning, jsdom Canvas/media notices and bundle-size/plugin timing warnings remain.

Local **Chrome 155.0.8059.40** passes **11 actual ordinary downloads** and **10 controlled native-save exports**, byte-identical to captured MIDI/JSON/audio Blobs or current serializers. Actual App/Strict Mode, synthetic physical MIDI, native oscillator microphone streams and real IndexedDB/OPFS streams cover all six export routes. Reload suggests 002 after 001; a manual JSON 009 makes the same-named scalar analysis suggest 010, demonstrating cross-activity identity sharing. Native cancellation/stale selection/failed close do not advance; existing explicit normal/elsewhere destination behavior and retained original Take 1 remain. Modal keyboard/focus and 44px actions fit desktop, Chromebook-sized, tablet, 375px and 320px views. Evidence: `.dev/qol-checkpoint1-download-results.json`, `.dev/qol-checkpoint1-native-results.json`, and corresponding screenshots/logs. Native Windows replacement/overwrite behavior was not repeated; picker selection is controlled in these stream tests.

Actual desktop Chrome print preview receives `bells_of_notre_dame_001` for library and Study View, `hallelujah_001` for Piece Practice, and `weekly_practice_report_001` for Practice Sessions. Native cancellation restores the original application title for each. Headless/native and separately controlled synchronous/error/fallback/unmount checks pass, with compact report-options layout checks down to 320px. Evidence: `.dev/qol-checkpoint1-print-preview-results.json`, `.dev/qol-checkpoint1-print-results.json` and `.dev/qol-checkpoint1-print-layouts.json`; per-preview data remains in its organized QA run. This validates suggested document/preview titles, not the OS PDF-save filename field, actual PDF saving or universal browser behavior.

Production inspection passes: main **1,000,972 bytes** (growth **4,234**), unchanged VexFlow **1,119,962 bytes**, with **1,096,180 / 977,190 bytes** headroom under the unchanged Workbox 2 MiB cap. React stays in one runtime, static chunk imports are acyclic, Improv and Study View stay lazy, and all application JS is present in the **35-entry** precache. Actual production service-worker offline reload restores the preferred folder and next suffix; online 001 and offline 002 OPFS score saves both match the expected **1,028 bytes**. Evidence: `.dev/qol-checkpoint1-inspection-results.json` and `.dev/qol-checkpoint1-offline-results.json`. No physical-instrument, other-browser, screen-reader or OS-installed-PWA-shell support is inferred. Source/untracked companion: `.dev/qol-checkpoint1-source.txt`; manifest: `.dev/qol-checkpoint1-review-manifest.json`. Protected housekeeping lines and historical QA artifacts are preserved.

## Violin calibration tolerance (pending 2.9.21 checkpoint 2)

Focused preference, collector, calibration/analysis, preflight, acoustic hook/Strict Mode and grading regressions cover the unchanged ±10 default; valid/invalid/blocked persistence; 1–30 step-1 native control semantics and ±1 buttons; exact signed boundaries and just-outside medians; identical measurement gates; stopped-state candidate/revision reset; preserved completed and unfinished evidence metadata; disabled listening/accepted edits; no settings-triggered microphone allocation/start; and detached setters. Existing precise v1, fixed beginner v3 and historical v2 export cases retain their shapes and meanings. V4 effective tolerances validate additively in scalar schema 1; invalid v4 metadata is rejected. Ocarina remains direct practice with its existing grading configuration.

Focused validation passes **17 files / 405 tests**; full `pnpm verify` passes **261 files / 3,828 tests**, adding **one suite / 43 tests** over owner-reviewed Checkpoint 1. Coverage also records the current effective context when analysis is enabled after a stopped adjustment. Lint, TypeScript and production build pass using the same process-local offline/warn settings, without installation, dependency/lockfile changes or external network access. Logs: `.dev/qol-checkpoint2-focused.log`, `.dev/qol-checkpoint2-verify.log`.

Actual App/Strict Mode in **Chrome 155.0.8059.40** passes native ArrowLeft/ArrowRight/Home/End and ±1 button interaction, default 10, reload persistence at 5, disabled listening edits, and a stopped adjustment to 30 with zero new streams. Native capture/detector processing of an oscillator measures approximately **+12.00 cents**, rejected at ±5, then **+26.00 cents**, accepted at ±30 while fixed tuning-quality guidance remains red. The same run rejects approximately +28 cents under Piece Practice's independent ±25 grading tolerance, exports valid scalar schema-1 v4 metadata alongside fixed v3, and confirms no ocarina calibration control. Calibration controls fit 1366/1024/375/320px; slider and adjustment buttons provide 44px targets. The 320px screenshot is visually inspected. Evidence: `.dev/qol-checkpoint2-browser-results.json`; its isolated `.dev/qa-runs/` profile contains the screenshot and scalar JSON fixture. This is synthetic browser evidence, not physical violin intonation/device support or actual Chromebook/touch/screen-reader QA.

Production inspection retains one VexFlow vendor chunk, singleton React, lazy Improv/Study View, acyclic static chunk imports and all application JS in the **35-entry** PWA precache. Current exact chunk sizes/headroom are recorded in `.dev/qol-checkpoint2-inspection-results.json`. Physical violin intonation, microphone/device accuracy and OS-installed-PWA behavior remain owner QA; a ±1 setting does not establish one-cent measurement precision. Preserve Checkpoint 1 evidence and all eight housekeeping additions above. Checkpoint 2 source/QA companion and review manifest are `.dev/qol-checkpoint2-source.txt` and `.dev/qol-checkpoint2-review-manifest.json`.

## Improv replay playhead (pending 2.9.21 checkpoint 3)

The cumulative baseline matches all 40 owner-reviewed pending files at committed HEAD `1003fa1a`, committed version 2.9.20 and pending version 2.9.21; the index is empty. The eight original housekeeping lines, including CRLF bytes, remain protected. No capture, durable Improv evidence, storage, MIDI export, detector or grading implementation changes are included. Calibration's only final delta is accessible singular “Plus or minus 1 cent”; existing pending What's New entry 16 covers all four features.

Deterministic replay regressions cover scheduler-anchor position, monotonic/invalid reads, leading/trailing silence, terminal duration, Stop/failure freeze and restart. Existing chord, release, sustain, voice-limit and capture-pause scheduling cases pass. Mounted renderer/hook/workspace tests verify indexed 512-note bounds, zero per-frame queries or React commits, ten-Hz archived slices, 12/6-second windows and the 80% threshold, unchanged saved trail lengths, reduced-motion updates, navigation disable/restore, selected-take fencing, replacement/collection/background/departure/Strict Mode/unmount cleanup, stale callbacks and unchanged collection JSON. Existing full capture/MIDI/export histories remain compatibility checks.

Final combined focused validation passes **46 files / 1,178 tests**. Full `pnpm verify` passes **262 files / 3,843 tests**, with lint, TypeScript and production build; Checkpoint 3 adds **one suite / 15 tests** over Checkpoint 2. Logs: `.dev/qol-checkpoint3-focused.log`, `.dev/qol-checkpoint3-replay-focused.log` and `.dev/qol-checkpoint3-verify.log`. Process-local offline/warn dependency settings avoid installation, network or lockfile changes. The existing acoustic-ref lint warning, jsdom media/Canvas notices and bundle/plugin-timing warnings remain.

Actual local **Chrome 155.0.8059.40**, App/Strict Mode and native HTMLAudio samples verify short/40-second takes, visible cursor position against the read-only transport, automatic scrolling, Stop/restart/natural completion, reduced motion, transport failure, replacement/deletion/collection switching/navigation and an actual capture with an intentional Pause/Resume break. That captured break is absent once from replay duration; MIDI/JSON bytes match before/after replay and original Take 1/history retain their identities. Six layout checks cover 1366, 1024, 768, 375 and 320px plus 200% CSS reflow; cursor geometry stays visible and note output bounded. Desktop/320px screenshots are visually inspected; CSS reflow does not establish actual browser-zoom/device support. Evidence: `.dev/qol-checkpoint3-browser-results.json`, isolated screenshots under its `.dev/qa-runs/` profile.

Dense native-sample startup can fail when rapid releases/pedal cleanup precede HTMLAudio startup. The unchanged adapter/transport reports failure, freezes the cursor and restores navigation; this is recorded rather than treated as successful audio playback. Dense 512-note visualization and reduced motion are checked with Prelude's existing volume=0 setting, retaining the actual scheduler. No sample-accurate acoustic alignment, subjective listening, physical piano, physical Chromebook/touch or screen-reader support is inferred.

Production inspection passes: main **1,007,290 bytes**, lazy Improv **115,975 bytes**, unchanged Study View **7,053 bytes** and VexFlow **1,119,962 bytes**. Main/VexFlow headroom remains **1,089,862 / 977,190 bytes** below the unchanged 2 MiB cap. Singleton React, acyclic static chunk imports, vendor preload and lazy Improv/Study View remain, with all JS in the **35-entry** PWA precache. Actual production offline reload opens saved Take 1, loads lazy Improv and local piano samples through the service worker, moves/completes/restarts/stops the replay cursor, and leaves native IndexedDB records/chunks byte-equivalent. Evidence: `.dev/qol-checkpoint3-inspection-results.json` and `.dev/qol-checkpoint3-offline-results.json`; the 375px production screenshot is inspected. An OS-installed PWA shell and physical audible alignment remain owner QA.

Final checkpoint/source inventory and complete untracked-source companion are `.dev/qol-checkpoint3-review-manifest.json` and `.dev/qol-checkpoint3-source.txt`. The established CxR path stays `.dev/_git-diff.txt`; earlier review artifacts and the reviewed baseline copy remain intact. All three checkpoints remain unstaged/uncommitted for final owner review.

## Preferred Export Folder (pending 2.9.20)

Clean baseline `e0c4f237b4d71b05fdbbe700e5edf588b96bcd69`, committed 2.9.19. Focused tests pass **33 files / 798 tests**; `pnpm verify` passes **257 files / 3,729 tests**, including **3 new files / 51 additional cases**, lint/types/build. The approved package-version bump invalidates pnpm's workspace metadata; validation uses process-local `CI=true`, `pnpm_config_verify_deps_before_run=warn` and `pnpm_config_offline=true`. This permits checks using the repaired pinned dependencies without implicit installation, downloads or lockfile edits. Evidence: `.dev/preferred-folder-focused.log`, `.dev/preferred-folder-verify.log`.

Ten mounted keyboard correction cases verify direct synchronous picker invocation with edited filenames and the original Blob, duplicate-submission fencing, explicit normal delivery, unconfigured/unsupported fallback, denied/prompt/stale/pending access and native cancellation/failure without automatic downloading. Real Chrome Input.dispatchKeyEvent checks confirm Enter in the filename field preserves active user activation, a focused Download Normally button uses only normal delivery, unavailable access refuses implicit delivery, and unsupported/unconfigured states download normally. Permission/API failure states remain controlled test inputs; this is not new native OS overwrite evidence.

Regressions cover the independent database identity, opaque handle selection/reload, current permission rechecks on cached handles before reuse without startup prompts, explicit renewal/forgetting, clone/storage failures, late/blocked database opens, unsupported/restricted APIs, native cancellation and rejected/stale startIn, exact supported extension proposals/refusal, captured Blob bytes, write/close failure and cleanup, rapid clicks, Strict Mode/unmount fences, keyboard focus and background shortcut isolation. Native integration covers score JSON, MIDI, committed backup JSON, room audio, Piece Practice segments and Acoustic Analysis notices; musical evidence, temporary recordings/URLs, actual Take 1 identity and departure guards remain intact. App tests verify Settings does not remount hosts or lose retained builder/recording guard state. Mocked picker tests cannot prove native overwrite behavior or disk durability.

Preserved **owner-operated Windows Chrome 154** native QA already PASSED. The owner explicitly accepted replacement, verified isSameEntry and directory membership, observed original **388 bytes truncated to 0 before application writing**, then successful write/close and exact **404-byte** readback. Node independently compared final bytes/hash. Declining replacement and canceling Save As preserved the earlier original fixture. Full raw event JSON was not supplied; owner-reported dialog/API observations and independent disk checks are labeled separately. Evidence: `.dev/preferred-export-final-handoff.txt`, `.dev/preferred-export-final-native-browser.json`, `.dev/preferred-export-final-native-disk.json`. This destructive native QA is not repeated during implementation. It establishes consent and successful completion on that setup, not atomic replacement or restoration after failure; current UI discloses the limitation before selection and on failures.

Implementation **Chrome 154** QA passes **10 recorded byte-identical exports** spanning all six pathways, including Unicode score naming, Improv MIDI/backup/room audio, piano/violin/ocarina microphone containers and both scalar-analysis branches. This uses the actual App/controllers, synthetic MIDI and a real oscillator microphone stream. Picker selection is controlled; actual IndexedDB structured cloning/reload of an OPFS directory handle, real OPFS write/close/readback, current Settings controls and modals are exercised. Settings opens/closes without replacing the active score DOM. Native top-layer modality blocks background focus, including after picker failures. Tab/Shift+Tab/Enter/Escape/focus return and dialog bounds pass at 320px/375px plus larger sizes. Inspected 320px screenshots show readable wrapped content and scrollable export actions without internal horizontal overflow; pre-existing page overflow behind Staff Builder is outside this modal change. Controlled canceled/stale/close-failing picker cases request no automatic normal download, and explicit Save As elsewhere omits startIn. Forget restores the ordinary-download-only dialog. No runtime exceptions were recorded. Evidence: `.dev/preferred-folder-browser-results.json`, `.dev/preferred-folder-settings-320.png`, `.dev/preferred-folder-dialog-320.png`.

A separate unmodified Chrome API probe accepts all six helper-generated MIME/extension proposals (including `.prelude.json`) through format validation; a deliberately invalid extension produces TypeError. No target is selected or written. Headless AbortError results are used only for option validation, never as overwrite evidence. Evidence: `.dev/preferred-folder-format-results.json`.

The final emitted production build passes worker-cached offline startup, IndexedDB preference restoration with no startup picker call, and one additional exact **1,028-byte** OPFS score save through the controlled native selector. All loaded application JS responses come from the service worker. Evidence: `.dev/preferred-folder-offline-results.json`. This is actual offline UI/storage/stream behavior, not a second native Windows overwrite test. Desktop local-directory permission expiration/renewal after app restarts, other browsers, physical ChromeOS/Android devices, screen readers/touch keyboards, physical instruments and OS-installed PWA shell interaction remain owner QA; no broad File System Access support guarantee is made.

Production inspection passes: main **996,738 bytes**, unchanged VexFlow **1,119,962 bytes**, with **1,100,414 / 977,190 bytes** headroom under the unchanged Workbox 2 MiB cap. All JS chunks are precached in the unchanged **35-entry** strategy, React remains a singleton, static chunks are acyclic and Improv/Study View remain lazy. Evidence: `.dev/preferred-folder-inspection-results.json`. Existing warnings remain; no application tests are weakened.

## App-controlled download naming (committed 2.9.19; historical validation)

Verified clean committed **2.9.18** at `20f9e0f543fa72a23000274ff06b63d63612b6a5`. Focused file/dialog, Staff Builder, Improv, Piece Practice, Acoustic Analysis, app-update/App and PWA/configuration regressions pass **127 files / 2,183 tests**. Full `pnpm verify` passes **254 files / 3,678 tests**, including **46 new cases**, lint, types and production build. Logs: `.dev/download-focused.log`, `.dev/download-verify.log`.

Tests cover NFC Unicode/combining marks, unsafe/control characters, empty/activity fallbacks, UTF-8 length bounds, exact extensions, default 001, reserved 000 and manual 001-999. Mounted dialogs preserve a captured Blob through filename edits/parent changes, trap focus, restore the opener, cancel on Escape, block invalid numbers and retain exports after failure/retry. Snapshot regressions compare Staff Builder canonical text, Improv MIDI bytes and full JSON against unchanged serializers; collection/take identity remains unchanged. Acoustic snapshots survive later collected evidence without regeneration. Native `.webm`/`.m4a`/`.ogg` segments deliver the same Blob while preserving preview URLs and temporary-audio guards. Strict Mode/unmount recording cleanup remains covered; jsdom's zero-delay selection-event tasks are drained before asserting no leaked capture intervals. Repeated/failing delivery and post-unmount URL cleanup are exercised.

Production inspection passes: main **982,028 bytes** (growth 6,148), unchanged VexFlow **1,119,962 bytes**, with **1,115,124 / 977,190 bytes** of headroom under the unchanged 2 MiB cap. All application chunks remain in the **35-entry precache**, imports/preloads resolve, React remains one runtime and the static chunk graph is acyclic. Improv/Study View remain lazy. Evidence: `.dev/download-inspection-results.json`. Only existing acoustic-ref lint, jsdom Canvas/media and over-500-kB chunk warnings remain. No package installation or external network is used.

Local **Chrome 154.0.8037.98** QA downloads **10 actual files** across all six export paths, including Unicode score filenames, two Staff Builder exports, MIDI, collection JSON, Improv room audio, piano/violin/ocarina microphone recordings and both scalar-analysis branches. Downloaded bytes match their existing serializer or captured immutable source Blob exactly. Synthetic physical-MIDI events exercise Pause/Resume and a later take without changing original Take 1. Native oscillator microphone streams produce real Chrome WebM containers; this is not physical-instrument/acoustic fidelity certification. Cancel keeps audio and requests no file; repeated dialogs reset to 001. Keyboard Tab/Shift+Tab, Enter submission, Escape and focus return pass. Dialog bounds/44px buttons pass at 1366, 1024, 768, 375 and 320px; its inspected 320px screenshot has no internal horizontal overflow. Existing page-layout issues behind the modal are outside this change.

A separate emitted-production smoke passes offline service-worker reload and an **11th actual score download**, byte-identical to the canonical source. Main/vendor assets load from the worker; required lazy chunks are present in cache. Headless facilities do not certify OS-installed PWA download UI, ChromeOS/physical hardware, other browsers, actual touchscreen/mobile-keyboard behavior or screen readers. Native `.m4a`/`.ogg` mappings are tested deterministically; this Chrome browser generated WebM. Evidence: `.dev/download-browser-results.json`, `.dev/download-offline-results.json`, `.dev/download-dialog-320.png`, and ignored QA/new-source companion `.dev/download-source.txt`. All profiles/downloads remain inside `.dev`; the app never changes global download settings or acquires folder permission.

## VexFlow vendor chunk (committed 2.9.18; historical validation)

Verified clean committed baseline `604b67213533bedea5d3bffa09630fc72fdcfa99`, package 2.9.17. Focused configuration, App, notation, app-update, Staff Builder, Piece Practice, Improv and PWA regressions pass **122 files / 2,121 tests**. Full `pnpm verify` passes **251 files / 3,632 tests**, including **nine new configuration cases**, lint, types and production build. Published What's New remains at 13 historical notices; its latest notice stays version 2.9.17 and the displayed application version continues deriving from package.json.

Production artifact inspection (`.dev/bundle-inspection.mjs`, `.dev/bundle-inspection-results.json`) compares emitted JS byte-for-byte with the actual config's in-memory output and verifies package membership, all embedded fonts, one React/React DOM runtime, resolved static/dynamic imports, vendor HTML modulepreload and an acyclic static chunk graph. Actual main is **975,880 bytes** versus **2,096,576** before; dedicated vendor is **1,119,962**. Headroom under the unchanged 2,097,152-byte Workbox cap is **1,121,272 / 977,190 bytes**. All application JS chunks appear in the **35-entry** production precache; Improv/Study View remain lazy. Existing acoustic-ref lint, jsdom Canvas/media and over-500-kB chunk warnings remain; no new graph warnings are reported. Verification log: `.dev/bundle-verify.log`. No dependencies or external network are needed.

`.dev/bundle-browser-qa.mjs` passes against emitted production files in local **Chrome 154.0.8037.98**, using a fresh profile and separate origins for upgrade and uncached startup. Native 2.9.17-to-2.9.18 service-worker installation, Later, canceled/accepted Reload and saved-library preservation pass. At 4x CPU throttling, initial Free Play renders its staff and a simulated physical-MIDI note; no lazy feature executes on startup. Offline reload fetches main/vendor from the worker, and previously unopened Improv and Study View load from precache. Offline Improv Start/Pause/Resume/Stop saves locally, Piece Practice renders after Start Practice, keyboard Enter opens Study View, and all top-level mode transitions complete without runtime exceptions or missing assets. Screenshots of Free Play/Study View were inspected. Evidence: `.dev/bundle-browser-results.json`, `.dev/bundle-freeplay-cold.png`, `.dev/bundle-study-offline.png`; ignored QA source companion: `.dev/bundle-source.txt`.

Headless facilities do not test OS-installed PWA launch/update; the native production worker update was tested instead. CPU throttling is not physical Chromebook certification, and synthetic MIDI is not piano/acoustic QA. Existing fresh-install Update ready notification and desktop Free Play page overflow were reproduced identically on committed 2.9.17 and pending 2.9.18 (scroll width 1,597 versus client width 1,351 at a 1,366px viewport); they are independent follow-ups, not changed here. No startup speed comparison or other-browser/screen-reader certification is claimed.

## Improv coordinated Pause/Resume (committed 2.9.17; historical validation)

Baseline independently verified: clean HEAD `75629f8787f861ebc726e1af2708c581b3d31424`, committed version 2.9.16. Focused validation passes **35 files / 738 tests** across Improv journal/persistence/timing/replay/export/timeline/native-audio/workspace, Free Play, MIDI provider/raw/diagnostic/useMidi, shared Piece Practice recording/capture/controls/MIDI recording and What's New. Full `pnpm verify` passes **251 files / 3,623 tests**, including **81 new cases**, plus lint, type checking, production build and **34-entry PWA precache**. Main JS is 2,096,576 bytes (2,096.57 kB), leaving only **576 bytes** below the unchanged 2 MiB per-file cap; the lazy Improv chunk is 113.66 kB. Future eager additions need renewed budget checks or separately scoped code splitting. Only the pre-existing acoustic-ref lint, jsdom Canvas/media and bundle-size warnings remain. Logs: `.dev/improv-pause-focused.log` and `.dev/improv-pause-verify.log`. Commands use existing dependencies with `pnpm_config_verify_deps_before_run=false`; no installation or external network is needed.

Deterministic tests cover both activities, one continuous number, multiple/leading/long pauses, frozen clocks, immutable paused raw MIDI, FIFO cross-channel/equal-pitch ghosts, velocity-zero releases, missing/unmatched releases, sustain observations, timing anomalies and open-pause Stop. Version-2 JSON/record controls round-trip while legacy version-1 remains compatible; malformed/reordered controls are rejected. Checkpoint tests gate Resume on durable authorization, retain/retry quota failures at pause/request/ack/effective cutover, recover a safely classified lease-expired prefix and prohibit silently resumed history. Forty-second paused lease renewal, paused raw backlog and 512-cycle control limits remain bounded. Replay excludes 10,000 paused system messages before scheduling; MIDI binary decoding checks compressed durations, ordered generated pause/terminal cleanup and explicit pedal-restoration provenance. Saved review matches live projection without raw mutation.

Native-recorder fakes cover delayed/inconsistent acknowledgments, unsupported methods, thrown calls, timeout, twenty-minute wall limit while paused, independent microphone/track loss with healthy MIDI, coordination failure, Stop during transitions, source/background/owner loss, stale callbacks and finalization/cleanup. Mounted tests cover keyboard Pause/Resume/departure focus, save failure/Retry, frozen/continuing staff, Stop while paused, unmount/Strict Mode and existing native-audio/MIDI independence. Existing burst regressions retain bounded React commits; paused context is still journaled and consumes the same safety budgets.

`.dev/improv-pause-browser-qa.mjs` exercises actual App/Strict Mode, the single provider, native Chrome IndexedDB and native MediaRecorder using synthetic physical-MIDI messages and an oscillator microphone stream. It passes keyboard Pause/Resume, chords/rolled/held/repeated attacks, release/sustain continuity, 402 paused raw messages, frozen musical timer/staff, resumed silence scrolling, two-pause Stop without fictitious Resume, saved Take 1 keyboard Home/End, replay start/stop, paused source loss/reconnection freeze, independent microphone failure followed by MIDI-only Resume, native pause coordination failure, Stop during delayed native Pause/Resume, and real version-2 JSON download/restore of six histories into six distinct restored histories. Downloaded WebM has the native EBML header and preview works. A synthetic native sample decodes to 1.38 seconds versus approximately 1.362 seconds observed active audio; this single QA measurement is not synchronization/fidelity certification or a product conversion/export feature.

Accessibility-tree image/slider labels and keyboard focus were checked. Visually inspected screenshots at desktop and 320px show readable note placement and controls. Layouts 1366x768, 1024x768, 768x900, 375x812 and 320x780 have no page-wide overflow; Stop/Resume fit above the fold at normal scale. Compact help keeps the taller staff partly visible at 320px (top about 578px), with ordinary internal/page vertical scrolling for lower content. At 200% CSS reflow, normal vertical scrolling is necessary. No runtime exceptions. Evidence: `.dev/improv-pause-browser-results.json`, `.dev/improv-pause-1366.png`, `.dev/improv-pause-320.png`; source/changed-file companion: `.dev/improv-pause-source.txt`. Browser profiles/downloads remain inside `.dev`.

Owner QA still required: physical piano note/pedal timing across Pause/Resume (especially missing releases/equal-pitch overlap), microphone permissions/fidelity, actual browser zoom, screen readers, touch devices, Safari/Firefox/mobile native formats and multi-tab/browser-crash/quota behavior. Deterministic IndexedDB failures/recovery are not real quota/eviction/crash validation. Paused microphone remains acquired and temporary audio is lost on reload; audio/MIDI native/storage transition edges are approximate. The observed audio wall span includes breaks and is not decoded duration. Unknown initial keys/pedal state remains unknown, and deterministic FIFO does not prove physical voice identity. No transcription, grading, WAV/MP3, permanent audio or new permissions are claimed.

## Improv rolling performance staff (committed 2.9.16; historical validation)

Pure timeline tests cover empty/leading/trailing silence, chord versus rolled attack timing, repeated/channel-overlapping FIFO releases, velocity zero, missing/unmatched releases, CC64 display interpretation, full MIDI pitch/key spelling/ledger/octave-displacement geometry, frame-clock regressions, Phase 4 timing compatibility, interruptions, fresh/first-take isolation, 15-minute runs, high-frequency non-note input and bounded live/review windows. Mounted SVG tests verify blue frame-driven movement without React commits, retained release history, threshold scrolling, terminal freeze, no late attacks, dense detail caps, reduced motion, Strict Mode teardown and saved slider/buttons/selection reset. Workspace tests use the real provider/journal/persistence fake to verify only accepted messages, final safety-limit events, immutable `loadTake` review without writes, and original-first history after later takes. Existing room-audio independence/guards remain covered.

Focused validation passes **31 files / 600 tests**. Full `pnpm verify` passes **250 files / 3,542 tests**, including **58 new regression cases**, plus lint, type checking, production build and **34-entry PWA precache**. Main JS is 2,095.93 kB and the lazy Improv chunk is 97.17 kB; the unchanged 2 MiB per-file cap still has limited headroom. Only the pre-existing acoustic-ref lint, jsdom Canvas/media and bundle-size warnings remain. Native local Chrome with actual App/Strict Mode, IndexedDB and MediaRecorder passes empty ready state, attacks/releases, chords/rolled attacks/repetitions, extremes, silence scrolling, Stop/interruption/reconnection freeze, a 200-attack/400-message burst, immutable saved-window review, original Take 1 after Take 2, Home/End time navigation, opt-in room-audio Start/Stop and accessible image/slider semantics. Screenshots were visually inspected. Layouts 1366x768, 1024x768, 768x900, 375x812, 320x780 and 200% CSS reflow show no page-wide overflow; primary recording controls fit the normal viewport, and the staff fits during recording at the tested sizes. At 200% CSS reflow normal vertical scrolling is needed. No runtime exceptions. Evidence: `.dev/improv-rolling-browser-results.json`, `.dev/improv-rolling-desktop.png`, `.dev/improv-rolling-320.png`, `.dev/improv-rolling-focused.log` and `.dev/improv-rolling-verify.log`. Source companion: `.dev/improv-rolling-source.txt`. Run with `pnpm_config_verify_deps_before_run=false` to prevent automatic dependency refresh; no dependencies or external network access are needed. Physical keyboard timing, actual pedal acoustics, real hardware throughput, screen readers and actual browser zoom remain owner QA. Display trails are approximate observed key-down intervals; dashed frozen trails lack recorded releases, and no inferred musical rests/beats/measures are supplied.

## Staff Builder quality-of-life (committed 2.9.15; historical validation)

Focused regressions cover direct saved-ID Study View, exact saved score/context/ties/annotation print projection, no editor/practice/storage-write side effects, sort/focus restoration, recovery drafts and missing/corrupt/unsupported/unavailable snapshots. Lock cases cover default/unlock behavior, pending pitch integrity, same-turn stale MIDI/rolled input, queued update fencing, all editor mutation families, Undo/Redo preservation, locked inspection/navigation, Strict Mode/unmount, disabled virtual pointer/keyboard controls and unchanged departure confirmation. Existing Staff Builder, Study View, Piece Practice, provider MIDI, storage and app-update tests run together. Final focused validation passes **110 files / 1,670 tests**. Full `pnpm verify` passes **248 files / 3,484 tests**, including **38 added regression cases**, plus lint, types, build and **34-entry PWA precache**. Main JS is 2,095.40 kB and the existing Study View loads in a 7.04 kB precached chunk; the unchanged 2 MiB per-file cap still has limited headroom. Only the pre-existing acoustic-ref lint warning, jsdom Canvas/media notices and bundle-size warning remain. Logs: `.dev/staff-builder-qol-focused.log` and `.dev/staff-builder-qol-verify.log`. Validation uses existing dependencies with `pnpm_config_verify_deps_before_run=false` to prevent pnpm from automatically reinstalling them after the package version bump; no dependency/lockfile changes or external network access. Earlier release counts remain historical.

`.dev/staff-builder-qol-browser-qa.mjs` uses installed local Vite/Chrome with actual App/Strict Mode and an EventTarget MIDI input. No dependencies are installed and external HTTPS is blocked. It checks library Study View/printing options/Enter/Escape/focus with unchanged storage, held pre-lock note plus rolled note-on/note-off/sustain sequences through the real provider, native pointer activation on a disabled virtual key and notation, unchanged locked storage, Unlock/resumed input, guarded library return, new-piece default and Free Play mode navigation. The lock fits 1366x768, 1024x768, 768x900, 375x812 and 320x780, plus 200% CSS reflow, with at least a 44px target. At 320px the pre-existing 320px minimum page width is 15px wider than the scrollbar-reduced client area; the lock still fits and does not extend the 320px page. Result: `.dev/staff-builder-qol-browser-results.json`; no runtime exceptions.

Manual owner QA remains: real piano note-on timing around Lock, held notes/release/sustain and rolled chords, sound/device hotplug, touch hardware, screen-reader announcements and actual browser zoom, other browsers, offline Study View after an installed PWA update. Before locking, capture pitches remain transient until committed; locking preserves them only for that mounted editor session, without claiming they were saved. Unlock before capture-position/pass changes, validation/Save or Undo/Redo. Measure browsing is blocked if pending pitches would otherwise move to another onset; Study View/scrolling remain usable. Reload/mode change/Practice return starts a fresh unlocked editor; editor Study View retains the lock. No physical MIDI or audible audio validation is claimed by simulation.

## Improv temporary room audio Phase 6 (committed 2.9.14; historical validation)

Final validation passes **33 focused files / 722 tests**, then full `pnpm verify`: **248 files / 3,446 tests**, lint/types/build and 33-entry PWA precache. Phase 6 adds **42 cases** (28 room-audio, 14 mounted workspace), with existing recording/tuner/MIDI/guard/storage/JSON/replay regressions preserved. Only existing acoustic-ref lint, jsdom Canvas and bundle-size warnings remain. Main JS is 2,096.86 kB, just below the unchanged 2 MiB Workbox cap; the lazy Improv chunk is 87.99 kB. Logs: `.dev/improv-phase6-focused.log` and `.dev/improv-phase6-verify.log`.

`improv-room-audio.test.ts` adds 28 deterministic cases with injected native-recorder and track-owner dependencies. They cover explicit audio-only permission, denied/missing/unsupported capture, canceled/late permission, source eligibility changes, recorder-start-before-MIDI, final chunks, empty audio, independent failure, interruption, actual MIME/extension naming, retained-audio guards, delayed download cleanup, hard byte bounds, duration limits, stale callbacks and teardown. The mounted workspace suite adds 14 cases (51 total) covering permission-free MIDI-only Strict Mode, combined capture, finalization independent of MIDI save, no audio in JSON, replacement protection, explicit discard and subsequent MIDI-only Take 2, pending-permission source loss, background/freeze/pagehide/device/consumer loss, audio-aware departure and audio failure with continuing MIDI. The App exclusion test awaits its real lazy module before asserting hosted-session exclusion, avoiding a cold-compilation race without changing the assertion.

Local `.dev/improv-room-audio-browser-qa.mjs` mounts actual App/Strict Mode and uses native Chrome IndexedDB/MediaRecorder with an injected oscillator MediaStream. It checks permission-free MIDI-only capture, audio preparation/Start/Stop/final chunk, native preview/pause and a downloaded WebM EBML header, protected departure, explicit discard, simulated denial/MIDI-only recovery, ready-stream cleanup on departure, native keyboard Enter/Escape and 1366×768, 1024×768, 768×900, 375×812, 320×780 plus 200% CSS reflow. Native preview controls also fit 768/375/320 widths without overflow. Result: `.dev/improv-room-audio-browser-results.json`; no runtime exceptions. This is native browser recorder validation with a synthetic source, not a permission-prompt or physical piano/microphone fidelity test. Actual browser zoom, screen readers, Safari/Firefox/mobile formats and physical microphone dynamics remain manual.

Audio is temporary and absent from IndexedDB/JSON/PWA caches. MIDI durability/eviction/recovery guarantees are unchanged. Audio defaults off for every later take; download initiation leaves protection active until explicit discard. Timing offsets are browser-observed and approximate, and recorder spans are not verified decoded duration. Retained chunk data is capped at 16 MiB, with a shared 20-minute/14-MiB stop threshold; oversized final chunks are reported/refused whole, retaining a usable prefix where possible. Browser buffering and incoming-chunk allocation cannot be bounded by the application.

## Improv playing-first workspace Phase 5 (committed 2.9.13)

Final correction coverage adds `improv-file-browser.test.ts`: deterministic fake timers verify one-second URL retention, immediate synchronous-failure cleanup, repeated download release and cleanup after initiating-component unmount. Coordinator and mounted workspace regressions verify that Stop/interruption clears held-note presentation, post-terminal messages cannot repopulate it or extend the journal, the unsaved-backlog limit clears feedback, and a subsequent take gets fresh live feedback. Presentation uses only accepted events during recording; raw evidence and persistence contracts are unchanged.

Correction validation passes **3 focused files / 56 tests** (download resources 5, coordinator 14, mounted workspace 37), then full `pnpm verify`: **247 files / 3,404 tests**, lint/types/build and 33-entry PWA generation. Eight new cases supplement strengthened existing interruption/backlog regressions. Only the existing acoustic-ref lint, jsdom Canvas and bundle-size warnings remain. Logs: `.dev/improv-phase5-corrections-focused.log` and `.dev/improv-phase5-corrections-verify.log`. Earlier Phase 5 counts/browser results below precede these corrections; no new native-browser or hardware validation is claimed.

`improv-workspace-session.test.ts` tests feature-local coordination against the actual journal, persistence adapter and dependency-free IndexedDB fake. `components/improv-workspace.test.tsx` mounts the real workspace/provider with deterministic transport callbacks, real feature persistence and injected sample voices. Coverage includes both activities, empty/numbered takes, explicit selected-source filtering, raw bytes/pedal preservation, key-aware display, durable acknowledgment versus pending state, quota retention/retry, interruptions, consumer replacement, Strict Mode/unmount, departure choices/focus, first-take deletion/tombstones, rename/deletion, reopened handles, incomplete evidence, MIDI/JSON URL cleanup, validated fresh-history restore and file errors, replay stop/background/navigation/unmount/failure. Provider ownership notification and App hosted-session exclusion/navigation ordering have focused regressions. Legacy MIDI, Free Play, Piece Practice, Staff Builder and persistence suites remain compatibility checks.

The repository-local `.dev/improv-workspace-browser-qa.mjs` runs actual App/Strict Mode and native Chrome IndexedDB with an EventTarget physical-MIDI simulation. Its isolated profile, downloads and results stay inside `.dev`; it uses installed Chrome/Vite only, blocks external HTTPS and installs nothing. It covers Start/Stop, reload/reopen, first/later takes, source loss, fresh-history JSON restore, native downloads, replay startup/cancellation, guarded departure, native keyboard controls/disclosure, accessibility-tree labels, desktop/Chromebook/tablet/375px/320px layout and 200% CSS reflow. CSS reflow is separate from actual browser zoom. Results are `.dev/improv-workspace-browser-results.json`. Synthetic hardware and headless audio are not physical-device or audible-fidelity validation.

Focused Phase 5 validation passes **25 files / 609 tests**. The new coordinator suite has **12 tests**, mounted workspace **36 tests**, provider **11 total (2 added)** and App **15 total (1 added)**: **51 new regression cases**. Existing Phase 1?4, MIDI, Free Play, Piece Practice/Staff Builder persistence and app-update coverage make up the remainder. Logs: `.dev/improv-phase5-focused.log`/JSON, `.dev/improv-phase5-verify.log` and `.dev/improv-phase5-browser.log`. A 200-event raw burst causes no immediate React commit while all events survive save; a 2,049-event burst explicitly interrupts at the 2,048-event pending limit and retains that entire prefix for Retry.

Final Phase 5 `pnpm verify` passes **246 files / 3,396 tests**, lint, type-check, production build and PWA precache generation (33 entries). Only the existing acoustic-ref lint warning, jsdom Canvas notices and large-bundle warning remain. Improv loads as a separate 75.43 kB chunk; the main chunk is 2,096.37 kB, narrowly below the unchanged 2 MiB Workbox per-file limit, so future changes must continue checking this budget. No new warnings remain. Chrome records no runtime exceptions, verifies native keyboard dialog Tab/Escape, and measures recording-control text contrast at 6.42:1. At 320?780 the recording staff ends at 763.8px; setup/review and 200% CSS reflow use ordinary vertical scrolling.

Pending manual checks: real keyboard/device hotplug, dense chords/repetitions and pedal, user-gesture/audio fidelity, screen readers and actual zoom, real multi-tab lease/conflict/quota/eviction/crash/recovery and independent MIDI player import. No room microphone or permanent audio support is claimed. Browser-local storage is evictable; committed-prefix recovery does not guarantee the pending suffix.

## Improv playback and exports Phase 4 (committed 2.9.12)

Five new suites cover pure receipt-timing projection/uncertainty and descriptive metrics; JSON exceptional-number round trips and complete collection history validation; collision-safe atomic restore and transaction rollback; independently decoded type-0 MIDI headers, tempo, absolute-rounded ticks, channel lengths, simultaneous/repeated messages, full CC64, SysEx/omissions and long-delta padding; and injected-clock replay/polyphony/FIFO/velocity/sustain/cancellation plus actual sample-adapter mocks. `improv-test-fixture.ts` creates authoritative loaded evidence through the real journal/store and existing dependency-free IndexedDB fake. No fake represents actual hardware timing, audio fidelity or permanent disk retention.

Focused regressions include all Phase 1–3 Improv/MIDI suites, existing grand-piano/musical-event playback and Piece Practice/Staff Builder persistence. Run package commands with `$env:pnpm_config_verify_deps_before_run='false'` to avoid automatic dependency refresh; no install/network access or Husky bypass is needed. Validation logs are `.dev/improv-phase4-focused.log`/JSON and `.dev/improv-phase4-verify.log`.

Phase 4 focused validation passes **15 files / 364 tests**. The five new suites contribute **112 tests**: timing/metrics 27, JSON/restore 36, SMF 16, replay 22 and piano voices 11. Existing regressions contribute 252: journal 74, library 38, adapter 27, raw input 21, provider 9, useMidi 24, Piece Practice persistence 39, Staff Builder storage 8, grand-piano 2 and musical-event playback 10. These are automated synthetic results; no real device, browser-audio or DAW validation is implied.

Full Phase 4 `pnpm verify` passes **244 files / 3,345 tests**, lint, type-check and production build. Only the pre-existing acoustic acknowledgment-ref cleanup warning, jsdom Canvas notices and >500 kB bundle warning remain (application JS 2,094.76 kB). No new warnings or regressions were found. Validation used existing installed dependencies with automatic pre-run installation disabled for the commands.

Pending manual QA: actual browser audio/user-gesture rejection, rapid same-pitch/polyphonic/pedal passages and release cutoffs; real-device browser background/navigation/disposal behavior; real keyboard event timing; MIDI import in independent DAWs/players including SysEx, long gaps and generated terminal cleanup; actual download/file restore workflows; native multi-tab restore collisions, quota/rollback, reload and storage eviction. Phase 4 supplied no room audio, microphone permission, external MIDI output or Improv screen; Phase 5 now supplies the workspace. Synthesized replay and SMF are projections; JSON is the original-evidence backup. Browser-local storage remains evictable.

## Improv local take library Phase 3 (committed 2.9.11)

`features/improv/persistence/improv-indexeddb.test.ts` exercises the actual IndexedDB implementation through a dependency-free request/transaction fake with structured clone, serialized competing transactions, injected request/commit errors, delayed completion and rollback. It covers Start/first identity, empty/interrupted takes, monotonic cross-handle allocation, duplicate Start, rename isolation, explicit confirmed take/collection deletion and tombstones, bounded listings/allocation, raw bytes/CC64/encodings/nonfinite timestamps and context, async mutation fencing, chunk sequencing/watermark agreement, exact retry, competing ownership, silence liveness, partial/incomplete recovery, missing versus observed terminal boundaries, late writer rejection and corrupt/incompatible records. Reopened fake database handles share committed records; this is synthetic persistence evidence, not an actual browser restart.

`features/improv/improv-take-persistence.test.ts` connects the real Phase 2 journal and Phase 3 store/adapter. It covers idle cancellation, periodic silent checkpoints, native transaction completion acknowledgment, bounded multi-chunk flush and large single messages, all CC64 values/repeats, selected-device interruption without releases, caller-reported background/owner loss, Stop/disposal during writes, quota/unavailable/lost acknowledgments, explicit retry without duplication, exact backlog interruption, explicit over-budget refusal and expired/recovered ownership. Existing journal/raw/provider/useMidi and Piece Practice/Staff Builder persistence suites remain compatibility coverage.

```powershell
$env:pnpm_config_verify_deps_before_run='false'
pnpm.cmd exec vitest run src/features/improv/persistence/improv-indexeddb.test.ts src/features/improv/improv-take-persistence.test.ts src/features/improv/improv-take-recorder.test.ts src/components/midi/midi-raw-input.test.tsx src/components/midi/midi-provider.test.tsx src/hooks/use-midi.test.ts src/features/piece-practice/persistence/piece-practice-runs.test.ts src/features/staff-builder/persistence/staff-builder-storage.test.ts
pnpm.cmd verify
```

Use existing dependencies; the command-local pnpm setting avoids automatic pre-run installation without repository config changes or Husky bypass. Final Phase 3 validation passes **8 focused files / 240 tests**: IndexedDB library 38, persistence adapter 27, journal 74, raw input 21, provider 9, useMidi 24, Piece Practice runs 39 and Staff Builder storage 8. Full `pnpm verify` passes **239 files / 3,233 tests**, lint, type-check and build. Only existing acoustic-ref lint, jsdom Canvas and large-bundle warnings remain; no new warnings/regressions. Logs: `.dev/improv-phase3-focused.log` (plus JSON) and `.dev/improv-phase3-verify.log`.

Pending real-browser QA: IndexedDB denial/quota and low-storage behavior; reopening after reload/browser restart; abrupt termination between requests and transaction completion; two actual tabs racing allocation, liveness/recovery and confirmed deletion; throttled/background/frozen tabs and changed system time; storage clearing/eviction; upgrade/versionchange behavior. Physical MIDI throughput/timing, browser navigation guards and display remain future workspace/hardware work. Native transaction completion is not a promise of permanent disk retention. Test fakes intentionally serialize all transactions and do not model every browser event-loop or durability behavior.

## Improv performance journal Phase 2 (committed 2.9.10)

`features/improv/improv-take-recorder.test.ts` covers explicit Start/Stop including empty takes and silence, first terminal boundary/idempotence, rejected transitions and no implicit resume, new-controller identity, unknown initial keys/controllers and no fabricated releases. Deterministic raw fixtures cover channels/velocities, both release encodings, chords/repeated/unmatched notes, all 128 CC64 values with repeats, other/system/malformed/unavailable messages, equal/regressing/nonfinite/negative timestamps, unverified clock domains and numeric pre-Start/post-Stop relations. Deeply frozen snapshots remain independent of caller mutations and subsequent appends.

Selected-source exclusion, separate disconnect observations, reconnect without fallback/resume, caller-reported lifecycle loss, clock/owner mismatches and non-advancing transport sequence are covered. Exact event/byte boundaries and oversized metadata/message/connection failure preserve the prefix without eviction. Bounded immutable cursor reads preserve contiguous take-local sequence separately from owner sequence gaps and do not imply durable save acknowledgment. No browser listener, recorder UI or storage is mounted; real selected-input readiness, visibility/owner-loss wiring, allocator pressure and hardware throughput require later integration/hardware testing.

Run the journal and Phase 1 compatibility suites with existing dependencies only:

```powershell
$env:pnpm_config_verify_deps_before_run='false'
pnpm.cmd exec vitest run src/features/improv/improv-take-recorder.test.ts src/hooks/use-midi.test.ts src/components/midi/midi-provider.test.tsx src/components/midi/midi-raw-input.test.tsx
pnpm.cmd verify
```

The command-local pnpm setting prevents its automatic pre-run dependency-install path; it does not change repository configuration or bypass Husky. Final Phase 2 validation passes **4 focused files / 128 tests**: journal 74, raw input 21, provider 9 and useMidi 24. Full `pnpm verify` passes **237 files / 3,168 tests**, lint, type-check and build. Only existing acoustic-input cleanup-ref lint, jsdom Canvas and large-bundle warnings remain; no new warnings/regressions. Logs: `.dev/improv-phase2-focused.log`, its JSON report and `.dev/improv-phase2-verify.log`. Browser-local persistence and nonfinite-safe exports remain future contracts, not tested implementations.

## Raw MIDI transport Phase 1 (committed 2.9.9)

`components/midi/midi-raw-input.test.tsx` mounts the real shared provider/owner with deterministic MIDI ports and clocks. It covers frozen copied bytes and source metadata, receipt observation before data access, channel/velocity and both release encodings, all 128 CC64 values plus repetitions, repeated notes and equal/regressing timestamps, system/short/non-note messages, missing/unreadable/truncated/malformed payloads and anomalous timestamps. It checks single-source raw filtering alongside unchanged aggregate normalized behavior, availability loss without substitution, hotplug/reconnect, unavailable identities, current callbacks/selection, consumer replacement/unmount, stale attachment callbacks, Strict Mode, permission failure/retry and late permission completion. High-frequency non-note delivery does not rerender the consumer/context. Existing provider/useMidi, MIDI Diagnostic, Free Play, Melody and Piece Practice suites remain regression coverage; physical timestamp fidelity, high-rate hardware input and browser-specific device identity remain unverified. This is transport coverage, not evidence of an implemented recorder, permanent take storage or acoustic accuracy.

Validation uses existing dependencies only. pnpm 11's automatic pre-run install check attempted an install and aborted before Vitest; command-local `pnpm_config_verify_deps_before_run=false` avoids that install path without changing repository configuration or bypassing Husky. No dependency installation or network access is authorized for this phase. Final fresh counts are recorded in the handoff.

Phase 1 final validation: the new raw-input file passes 21 tests; the affected MIDI/Diagnostic/Free Play/Melody/Piece Practice/native-recording set passes 12 files / 379 tests. Full `pnpm verify` passes 236 files / 3,094 tests plus lint, type-check and build. Existing warnings remain: the acoustic-input cleanup-ref lint warning, jsdom's unimplemented Canvas context and Vite's large bundle notice. Logs: `.dev/improv-phase1-focused.log` and `.dev/improv-phase1-verify.log`. Tests use mocked MIDI and do not establish physical timestamp accuracy or device-specific behavior.

## Provisional ocarina fingering 2.9.8

Pre-commit durability regression investigation: the completion-store fake appends records synchronously but returns a Promise. The session acknowledges the final revision from that Promise, then removes `beforeunload` protection in a React passive effect. An instrumented isolated run reproduced the saved label appearing while the old session listener still protected unload; asynchronous `act` around completion flushed the save update and effect cleanup, leaving zero listeners. The completion/restart test now awaits that action while preserving its saved-label and `defaultPrevented === false` assertions. Production guards, unfinished/failed-save protection, unsaved-audio protection and dependencies are unchanged. The test and production durability logic already existed in committed 2.9.7; installed React 19.2.4, Vitest 4.1.10, Testing Library React 16.3.2 / DOM 10.4.1 and jsdom 29.1.1 match the unchanged committed lockfile. Diagnostic traces are in `.dev/completion-unload-mutation-trace.log` and `.dev/completion-unload-mutation-fixed-trace.log`; instrumentation was removed from the test. Follow-up validation passed five consecutive isolated runs (1 test file, 1 passing / 88 skipped each), the affected file (1 file / 89 passing tests), and full `pnpm verify` (235 files / 3,073 passing tests, lint/type-check/build passing with the existing warnings). No Husky bypass or dependency reinstall was used; the owner-staged 2.9.8 index was preserved.

Model tests independently assert all thirteen concert-pitch mappings and twelve stable hand/thumb/subhole identities, deep immutability, low A4/B4/C5 subholes, D6/E6 thumb releases, F6 left pinky, derived instructions and no fabricated accidentals. Context and component tests cover fresh/stale/uncertain/absent readings, expected/live independence, score-aware enharmonic labels, accessible FRONT/BACK descriptions, unavailable dashed states and no physical-coverage/acceptance claims. Mounted Piece Practice covers instrument-specific rendering, unchanged violin preflight/guide, ocarina target advancement and normal completion, one existing capture owner, native recording finalization/playback/download, unchanged scalar schema/calibration policy and report output without fingering evidence. October 10, 2026 validation: focused affected suites **6 test files, 189 passing tests**; full `pnpm verify` **235 test files, 3,073 passing tests**, lint/type-check/build passing. The unchanged acoustic-input hook has one existing lint warning; build retains its large-chunk warning. Dependencies were restored from the repository-local pnpm store in explicit offline mode (529 reused, zero downloads) after an automatic refresh's registry attempts were blocked.

`.dev/ocarina-fingering-browser-qa.mjs` adapts the existing Strict Mode mounted-session approach: actual session/acoustic hook and stabilizer, controlled observations, native Chrome synthetic getUserMedia/MediaRecorder. All profiles, logs, screenshots and results stay in this repository; browser external hostnames are blocked, and the result asserts zero external application requests. `.dev/ocarina-fingering-browser-results.json` records **14 passing scenarios**: 1366×768 desktop, 1280×720 Chromebook-size, 768/375/320 widths, 200% CSS reflow and effective 683px viewport, keyboard Tab/Shift+Tab/Enter/Space disclosure and Stop Listening, accessible diagram descriptions, visible hole-state text, non-color distinguishability, 16.97:1 light-hole/surface contrast, independent fresh/stale suggestions, native recording finalization/playback/download/cleanup, unsupported authored E♭5 and normal completion. Expected instructions, FRONT and both BACK thumb holes fit the desktop/Chromebook viewport. Smaller screens stack below notation; vertical scrolling is expected. A scoped body minimum correction eliminates the existing 15px classic-scrollbar overflow while this ocarina guide is mounted at 320px.

Automated synthetic success does not validate the owner's instrument, acoustics or manufacturer chart. Owner QA remains: actual 200% browser zoom, real Chromebook/Android/Firefox/Safari, installed PWA/navigation chrome, enlarged fonts and long targets, screen-reader descriptions/announcements, touch use, and actual audio fidelity/downloads. Verify the actual booklet/model and subhole placement; play A4/B4/C5, D6/E6/F6 with an independent pitch reference and varied breath pressure, and confirm the diagram never claims actual coverage or written-duration success. See [OCARINA_FINGERING.md](./OCARINA_FINGERING.md).

## Playing workspace cleanup 2.9.7

Mounted session tests verify violin/ocarina progress and live pitch before notation, recording/details/export afterward, a single unchanged capture owner and equivalent keyboard ordering. Existing native recording, analysis exports, MIDI progression, Targeted Practice, recovery and App guards remain covered. Compact recording notice tests cover active/finalizing/retained, armed, failure and limit states without duplicate numeric announcements. Diagram tests verify every rendered landmark on all strings, narrowing semitone gaps and expected/live alignment; the 32 mappings and live freshness rules remain unchanged. Options start closed and are opened before exercising string/sticker/alternate controls.

Local Chrome QA uses the mounted session and actual acoustic hook, controlled pitch observations and native synthetic microphone recording. `.dev/piece-layout-browser-results.json` records desktop/laptop viewport geometry, 64px feedback, right-side versus stacked layout, 200% CSS reflow/effective viewport, keyboard disclosures, stale clearing and retained downloads/track cleanup. This is separate from physical violin, audio fidelity, screen-reader and actual browser-zoom QA. App/navigation chrome, unusually long labels, smaller laptop heights and enlarged system fonts can require scrolling. Preserve the existing 320px body-minimum baseline on Windows scrollbars; verify real mobile layouts manually.

## Advisory violin fingerboard 2.9.6

Focused model tests cover all 32 supplied string/offset combinations, open-string/fourth-finger alternatives, explicit string overrides, unsupported ranges, proportional spacing, continuous frequency movement and conservative harmonic suppression. Context tests retain the exact shared pitch-panel freshness boundary. Mounted component tests cover score-spelled flats, stickers, distinct shapes, unavailable states and selection persistence. Mounted Piece Practice exercises target advancement and live pitch independently, stale/silent clearing, the previous accepted-target acknowledgment, one existing microphone owner, native recorder segment finalization/download cleanup and unchanged scalar analysis export while disclosures are closed. No chart owns grading/capture/report logic. Existing recording, capture, MIDI, analysis, session/report, Targeted Practice and App suites remain required.

Browser QA must check 1366-pixel desktop right-side placement, Chromebook-size stacking, 320-pixel narrow layout and 200% reflow alongside recording controls and large pitch panels. Exercise keyboard string/sticker/alternate controls and native Enter/Space disclosure activation, authored accidental labels and expected/live independence. CSS zoom reflow is distinct from physical browser zoom. Owner QA still requires a real violin with an independent pitch reference, open strings and low/high stopped notes, intentional alternate strings, flat/sharp pitches, noise/harmonics/silence and recording playback. Confirm the guide never claims actual fingering, calibrated physical distances or held-duration success. Screen-reader announcements, physical zoom, Chromebook/Android/Firefox/Safari and audio fidelity require device checks.

Local headless Chrome QA mounts the actual session/acoustic hook under Strict Mode, replacing only capture observations with controlled pitch while using native synthetic getUserMedia/MediaRecorder. `.dev/violin-visualizer-browser-results.json` records layout, 64px pitch fields, stale clearing, keyboard controls, native recording finalization, download availability and track cleanup. Desktop 1366/1280, stacked 768/375/320, CSS zoom 200% and an effective 683px browser-zoom viewport are checked. The existing global 320px body minimum is allowed at the 320px Windows viewport with a classic scrollbar; it can leave 15px of baseline overflow and is unchanged. This is not physical browser-zoom or real-instrument validation.

## Piano microphone companion recording 2.9.5

`piece-practice-midi-recording.test.tsx` exercises real MidiProvider/input/session owners with controlled physical messages and native recorder fakes, under Strict Mode and normally. Compare recording Off/On repeated notes, Note On zero, Note Off, chords, rolled chords, pedal events, mistakes, completion and persisted evidence. Cover one permission request, exact supplied stream, denial/retry, interruption independent of MIDI, Restart Measure continuity, explicit pause/resume, late grants and callbacks, recording limits, final chunks, piano filenames, playback/download, URL/listener/timer cleanup, recovery Off, beforeunload and Cancel/Discard for restart, Practice Again, targeted entry/return and actual App navigation. Adapter tests isolate track ownership, synchronous ending, canceled startup/watchdog, interrupted/background capture and observer exceptions. Existing acoustic Strict Mode, capture, analysis/export, report, MIDI input and Targeted Practice suites remain required.

Owner QA: Windows Chrome with a physical MIDI piano, Chromebook, Android where simultaneous MIDI/microphone support permits, Firefox and Safari where available. Use audible piano notes, dynamics, repeated notes, chords, pedal, silence and phrasing; check MIDI progression while recording and after denied permission or track loss. Verify headphones-only limitations, explicit resume after pause/backgrounding, final-note cutoff, independent segments, external-player opening of downloaded files, native MIME/extension, limits and feedback avoidance. Test keyboard controls/disclosures, narrow layouts, actual 200% browser zoom, microphone indicator disappearance on stop/navigation and Cancel/Discard for every run/mode change. Controlled browser fakes and synthetic Chrome recording do not establish real piano fidelity or device support.

Local headless Chrome QA uses real getUserMedia/MediaRecorder with Chrome's synthetic microphone and controlled physical MIDI messages, mounted under Strict Mode. It verifies opt-in-only acquisition, continuous Restart Measure, completion track cleanup, nonempty WebM/Opus bytes with matching piano filename, browser playback, native Enter/Space disclosure activation, accessible disclosure semantics, Cancel/Discard and page reflow at 320/768/1366 pixels plus CSS zoom 200%. `.dev/piano-recording-browser-results.json` records that run. Existing notation scrolling is retained; physical browser zoom, external-player opening, audible piano fidelity and device/background behavior remain manual checks.

## Optional local performance recording 2.9.4

Focused suites: recording controller and controls, Piece Practice acoustic hook/session, shared microphone capture/Tuner, App navigation, scalar analysis and reports. Check default Off, one microphone permission request, exact stream reuse, preflight exclusion, mid-practice opt-in, asynchronous final chunks, independent segments, restart/interrupt/completion boundaries, MIME/extension matching, limit overshoot, unsupported/error paths, object URL disposal and recording-Off grading/export parity. Run `pnpm verify` afterward.

Owner device QA: use Chrome desktop, Chromebook, Android Chrome, Firefox, macOS Safari and iOS Safari with violin and ocarina. Enable recording before and after entering practice. Play clear notes, scratches, bow changes, tonguing, pitch searches, silence and rests; confirm playback contains all audible events regardless of pitch detection. Confirm calibration audio is absent, Restart Measure is continuous, Stop/resume gives separate files, final acceptance can cut off the note, and no claim of written duration success appears. Download every segment, play files outside Prelude, and check actual MIME/extension, quality at requested 64 kbps, headphones and feedback prevention. Test denied permission, track end, interruption, background/screen lock, long chunks, limits, 200% zoom, keyboard and screen-reader state changes. Cancel each run/mode departure once to ensure nothing is lost, then explicitly discard. Test browser-close warning where available; mobile termination can bypass it. No audio is uploaded or restored from recovery.

## Focused Piece Practice feedback cleanup 2.9.3

Focused gate: `pnpm test src/features/piece-practice src/features/acoustic-analysis src/features/instrument-learning src/lib/audio/monophonic`, then `pnpm verify`. Regression coverage checks current/total/remaining measures (remaining includes the unfinished current measure, within the selected inclusive range), completion boundaries, signed cents versus detected Hz, stale/uncertain/absent readings, Last graded attempt and Detected frequency at graded attempt labels for lastAttempt evidence independently of live tracker readings, pitch/attack acknowledgment identity/expiry/repeated notes, cleanup, independent current-target highlights, whole-note acceptance wording, collapsed collection/export, completion disclosures, report parity, MIDI controls and Targeted Practice return focus. Native summaries need real-browser keyboard validation; jsdom assertions alone do not establish Enter/Space behavior.

Local Chrome QA: `node .dev/piece-ux-browser-qa.mjs` (repository-local ignored harness) writes `.dev/piece-ux-browser-results.json` and `.dev/piece-ux-320.png`. It exercises real VKB target transitions, repeated pitches, completion controls, native Enter/Space and Tab, accessibility-tree disclosure roles, 320/768/1366 px layouts, 200% CSS zoom reflow and stable microphone panel heights across live/uncertain/absent fixture states. This uses rendered pitch fixtures, not physical microphone evidence. The existing global 320 px body minimum can still overflow by a scrollbar width on a 320 px desktop viewport; the harness checks that this pass introduces no overflow beyond that existing minimum. CSS zoom is not a substitute for physical browser zoom or screen-reader QA.

Owner device QA: piano MIDI note-on/off and rapid/repeated/chord input; violin and ocarina quiet/re-articulation, uncertainty, both cents signs, ringing tails, Stop/resume and interruption; desktop/Chromebook/mobile portrait and landscape, actual 200% browser zoom, long accidentals/chord labels, keyboard-only disclosure/report navigation and screen-reader announcements. Confirm acceptance refers only to pitch/attack, not held duration. Check that changing targets does not move playing controls, that the newest acknowledgment wins, and that pause/restart/new run/exit clears it. Complete microphone and piano runs, inspect every collapsed section, generate/copy reports, and export scalar analysis with collection On/Off. Storage failures and unsaved analysis/focused-result notices must remain visible while disclosures are closed. Performance recording was separate from this 2.9.3 pass; its 2.9.4 QA is above.

## Violin preflight / acoustic analysis 2.9.2

**Implemented provisionally; physical QA pending.** Focused gate: `pnpm test src/features/instrument-learning src/features/acoustic-analysis src/features/piece-practice`. Full acceptance remains `pnpm verify`. Deterministic tests cover short plucks/decay, repeated compatible candidates, tuning adjustment separation, skip-all entry, tail boundaries, raw versus smoothed pitch, beginner and preserved precise settling/duration/sample gates, interpolated quantiles/MAD, exact spread/drift/tuning boundaries, clock/generation gaps, harmonic ambiguity, calibration revisions/choices, accessible preflight, grading/time isolation, final-tone leakage, collector failure isolation, actual-timestamp bins, context/visit/capture boundaries, diagnostic ring/window limits, preference, JSON validation/linkage/privacy and bounded long sessions. Existing Tuner, MIDI/VKB, V1/V2, Staff Builder, Targeted Practice and app-update suites remain regression gates.

### Owner physical procedure — required

1. On desktop, Chromebook, Android and installed PWA where relevant, record browser/device class, audio route, room/distance, violin tuning and an independent reference in private QA notes. Do not record audio. Start Listening once and test ordinary short open G3/D4/A4/E5 plucks, including ringing decay and repeated plucks. Compare Hz/cents with the independent reference; bowing remains supported. Real analyzer eligibility, not audible duration alone, determines whether enough usable evidence exists.
2. Test deliberate mistuning of both signs near the beginner 5/10/25-cent boundaries, plus larger offsets. Green means ready for beginner practice; yellow adjust tuning; red significantly off. Check automatic acceptance from agreeing estimates and advancement after 1.2 seconds even if sound stops immediately after confirmation. Off-target readings must update on the next pluck without Retry. Test tuning adjustments large enough to replace old evidence. Use Skip Calibration and Start Practice at G/D/A/E and during accepted acknowledgment; accepted strings must remain accepted and missing strings skipped. A flat baseline never shifts concert-pitch grading or changes the selected practice tolerance.
3. Try attack noise, clean fundamentals, harmonic-rich plucks/bowing, natural harmonics, genuine octaves, background noise, weak/short decay and pitch fluctuations. Usable raw estimates must update even while the smoothed tracker is acquiring. Rejected estimates must give honest persistent feedback; historical Hz stays labeled Last heard and retains its deviation color. A high-periodicity octave remains the measured octave and cannot become a baseline. Let the previous string continue ringing during acknowledgment: its unchanged tail must not certify the next string. Confirm quiet/new attack releases that boundary. A single erroneous frame cannot accept; repeated compatible short plucks may combine within the bounded three-second candidate age. Confirm 50 px notes, stable rows and no flashing warnings.
4. During preflight, confirm practice time stays zero and no note creates attempts/mistakes or feedback chirps. Sustain the last calibration tone while entering practice: no target should answer until a real quiet/re-articulation boundary. Test permission denial, Stop/start, background/interruption, and recovery. Recovery must not restore transient calibration. Verify keyboard focus, 200% zoom, portrait/landscape, text assessments and bounded screen-reader announcements.
5. Run 5-, 20- and 60-minute sessions with Analysis On and Off. Record actual observation cadence, retained bins, gaps, JS heap/resource trends, dropped frames, heat, export size and export duration. Export is disabled while capturing; Stop Listening first, then export, and also export from completed results. A limit/error must preserve earlier evidence and stop only collection. Verify Off affects neither calibration operation nor grading; only enabled collection enters the analysis bundle.
6. Inspect JSON units, A440/cents convention, raw versus tracked Hz, periodicity disclaimer, target visit/capture identities, authored spelling, attack/attempt linkage, calibration revision/retained samples, gaps and truncation. Restart Measure should create another visit, not conflate attempts. Continued sound after acceptance must not be treated as proof of the next intended note. Effective sample rate is unknown in this MVP, not guessed.
7. Explicitly upload an exported bundle to the owner's chosen external AI assistant and ask it to explain limitations and evidence without Prelude source. This is an owner action; Prelude never uploads. Confirm there are no raw waveforms, audio blobs, device names/IDs, full user agent, account/location or unrelated score text.
8. Export before Restart Piece, Practice Again, Targeted Practice, leaving or reload. Verify old analysis is not recovered from IndexedDB and that only the On/Off preference survives. Ocarina uses existing practice/analysis without a violin preflight; its provisional fingering guide contributes no grading or export evidence.

### Synthetic size characterization — not physical performance evidence

The deterministic constant-pitch test generates nominal 30 Hz scalar envelopes without running audio detection. An initial local run produced 3,000 bins / approximately 2.33 MB pretty JSON for 5 minutes, 12,000 bins / 9.33 MB for 20 minutes, and 26,211 retained bins / 20.40 MB in a simulated 60-minute session before conservative memory accounting stopped collection around 43.7 minutes. Collection+snapshot+serialization took roughly 19/79/159 ms on that test host; these are not microphone/browser/device latency claims or heap measurements. Real targets/events/windows consume extra capacity. Run `pnpm test src/features/acoustic-analysis/acoustic-analysis-export.test.ts --silent=false --reporter=verbose` for fresh measurements.

The collector's ~16 MiB allowance estimates retained row/event costs; serialized text, export clones and the browser heap are different sizes. Diagnostic reserved intervals are capped at 60 seconds, with 10 seconds protected for calibration. The ring is bounded by both four seconds and 160 observations; beginner calibration candidates by 24 observations and three seconds of age. The precise collector retains its 128-observation safety cap; the default calibration UI has no Retry button. Omitted calibration raw windows retain their summaries and explicit retained-sample counts. Threshold and budget changes require measured evidence and regression updates.

## Acoustic Piece Practice 2.9.0

**Implemented, automated coverage; physical acoustic reliability pending.** Existing Tuner extraction gate passed before Piece Practice integration: 6 files / 79 tests. The initial pure gate passed 4 files / 60 tests; later integration adds coverage, so use final handoff counts for the executed current suite. New tests cover scalar pitch math, tolerance boundaries, retained-identity safety, repeated E4, quiet and corroborated discontinuities, false rearming, clock/generation resets, half-open eligibility, unisons/chords/rolls/ties, source-specific submission/timing, configuration comparison, V1 normalization/V2 recovery, reports/copy/print, exclusive ownership and explicit microphone lifecycle. The existing MIDI/VKB/tuner suites remain regression gates. Full `pnpm verify` includes lint, type checking, all Vitest tests and the production build; do not substitute synthetic audio tests for physical evidence.

### Owner procedure — pending

Use the owner's actual **He's a Pirate (easy)** score first, especially **E4 → E4 → E4** and **G4 → G4**. That authored piece is not present as an acoustic QA fixture in this repository; synthetic repeated-note fixtures test invariants, not this instrument performance. Keep the score's authored notes, ties and focus visible. On desktop, Chromebook and Android, record browser/device, microphone/audio route, instrument model and tuning, room noise/distance, selected range/focus/tolerance, and any independent pitch reference. Record only scalar observations and written notes; do not record/upload audio for this workflow.

1. Select Microphone and each instrument label. Confirm this requests no permission. Try Both Staff on a chord, a focused staff still containing chords, a roll, a distinct overlap and an out-of-range note: Start Practice should explain the measure/range problem before permission. Choose an eligible focus/range; duplicate unisons, adjacent notes and ordinary ties should remain eligible.
2. Start Practice, then Start Listening. For violin, complete or explicitly Skip the preflight strings and Enter Piece Practice first. Give a brief quiet baseline. Sustain E4 across the three repeated targets: only one advances. Re-articulate with a clear gap, then bow restart or tonguing without full silence. Repeat G4 pairs. Record missed articulations and false duplicate attacks separately. If a weak restart is missed, test the visible brief-gap guidance.
3. On violin, test open G3/D4/A4/E5, first-position stopped notes, isolated attacks, stepwise and legato changes, same-note bow restarts, slow slides into pitch, vibrato, inside/outside tolerance, harmonics/octave errors, silence and resets. After an outside-tolerance same-note rejection, sliding into tolerance without re-articulation must not advance. A new articulation may retry.
4. On the actual identified ocarina, test isolated notes, repeated tonguing, connected/slurred notes, breath gaps, pressure bending, consistent tuning offset, tolerance boundaries and harmonic/octave errors. Do not generalize results to all ocarina systems or models.
5. Test ±15, ±25 and ±40 cents and custom 1/49; reject empty, fractional, zero and ≥50 custom settings. Check sharp and flat boundaries with a trusted reference if available. An accepted sharp/flat pitch must say accepted within tolerance, not in tune. Confirm authored enharmonic spelling survives in expected notation and screen/copy/print evidence.
6. Test wrong first and later attempts, pauses, Skip, Restart Measure, targetless Next Measure, tied continuations and range-boundary reattacks. Sustained sound after Skip/Restart must not create an initial attack; it needs quiet. Ordinary progression preserves consumed articulation. Confirm one rejected attack counts once, no invented velocity/release evidence, and response timing includes confirmation delay rather than speculative onset.
7. Verify denied permission, pending-prompt cancellation, Stop during startup, late grant, track mute/end/unplug, AudioContext interruption, hidden tab, freeze/pagehide, lock/unlock, navigation and unmount. The microphone indicator should turn off; returning foreground requires Start. Repeat ten Start/Stop cycles. When browser audio cleanup fails, tracks must still stop and another context must not be allocated until cleanup resolves.
8. Restart Piece and Practice Again: verify a new run, preserved source/instrument/tolerance and microphone off. Reload/resume a saved microphone run: paused with explicit Start. Launch and return from Targeted Practice; configuration and original evidence must survive. Open a historical V1 keyboard run and a completed report; no microphone permission request should occur.
9. Connect MIDI while in microphone mode: it cannot advance the acoustic run, no interactive piano appears, and no success/error tones play. End an active hosted Practice Session before listening. Keep other app playback quiet or use headphones; test interference deliberately as a separate condition.
10. Review screen, copied text and print/PDF for source, instrument, tolerance, expected/nearest pitch, Hz, signed cents, acceptance/reason, articulation and observation confirmation delay. Check narrow portrait/landscape layout, 200% zoom, keyboard focus, labels/errors and that continuous pitch frames do not flood screen-reader announcements. Run a sustained foreground session to observe responsiveness, heat and cleanup.

For every passage, record **missed articulation**, **false duplicate articulation**, **wrong/octave pitch**, and **observation confirmation delay** independently, with repeat counts and conditions. The displayed confirmation delay is algorithmic observation-to-confirmation time, not measured hardware latency. Note unsupported combinations and preserve failures as future regression inputs. Current thresholds (50 ms quiet, 6 dB corroborated dip, 250 ms recovery) are provisional. Violin preflight is described above; manufacturer-verified ocarina profiles/calibration, detector octave-error correction and polyphonic analysis remain unimplemented. No broad reliability claim is authorized by automated success alone.

## Chromatic Tuner Phase 2

Run focused validation with `pnpm test src/features/tuner src/App.test.tsx src/features/practice-session/components/practice-session-builder.test.tsx`, then `pnpm verify`. The approved dependency restoration uses the existing frozen lockfile, with install scripts disabled to avoid unrelated Husky/Git configuration. Package and lockfile hashes remain unchanged. On this environment's pnpm 11, set `$env:pnpm_config_verify_deps_before_run='false'` for verification commands to prevent its automatic pre-script reinstall after the deliberate script-free restoration; this changes no repository configuration or dependency versions.

Six feature test files cover all chromatic C3–C7 clean sine/harmonic fixtures at 44.1/48 kHz, cents and spelling, quiet/noise/DC/clipping abstention, out-of-range estimates and the known dominant-second octave failure. Stabilization tests exercise acquisition, frozen clocks, gaps, expiry, reacquisition, octave dwell and declining level. Capture and hook tests cover explicit activation, permission/device/activation failures, late grants, timeout, stop/restart, eligibility at asynchronous boundaries, context/track interruption, background/unmount, Strict Mode and 100 cleanup cycles. App and builder tests preserve navigation, version and MIDI behavior while checking the active-run guard through hidden, completion, Bonus and summary states.

The owner-approved audit correction excludes only `.dev/microphone-spike/**/*.test.mjs` from Vitest discovery, preserving Vitest's default exclusions. These ignored experimental files use Node's test runner; normal source and root configuration tests remain discoverable. Run ordinary `pnpm verify` without command-line discovery exclusions. Capture regressions reproduce rejected/thrown closure, repeated failures without context growth, later recovery, pending cleanup across controller replacement, already-closed contexts and stale cleanup completions. They also cover track mute/end and transient mute/unmute during pending activation, normal initial suspension, actual context interruption, late activation and explicit restart. Stop immediately releases tracks; unresolved audio closure stays owned and blocks new context allocation until cleanup can succeed. No retry timer runs while cleanup is blocked.

After `pnpm build`, `node .dev/tuner-browser-qa.mjs` runs the source and compiled production/PWA App with installed headless Chrome, existing Vite dependencies and an isolated `.dev/tuner-chrome-qa-*` profile. It uses Chrome's fake device and silent browser-generated streams, checks 320/768/1366px layouts and >=44px controls, denial/cleanup, pitch/uncertainty display, late permission, context/track interruption, background/navigation, repeated Start/Stop and the real hosted Practice Session guard. The production detector benchmark uses 588 clean analytic frames. Benchmark batches and normal live-DSP responsiveness are measured in separate browser tasks. Browser evidence and profile/screenshot paths are recorded in `.dev/tuner-results.md`; neither the script nor evidence is tracked by Git. Injected interruption/visibility events do not establish physical device behavior. Production offline installation/update remains physical/browser QA.

### Evidence classifications and physical QA

- **VERIFIED BY AUTOMATED TEST:** deterministic musical, signal, stabilization, lifecycle and ownership behavior; exact final suite counts are reported in the handoff.
- **VERIFIED IN BROWSER:** desktop generated/fake capture and full App smoke, including measured detector cost and short live responsiveness. This does not establish physical onset latency or instrument accuracy.
- **OWNER-OBSERVED LIMITED PHYSICAL EVIDENCE:** one successful real violin test reported by the owner. No controlled corpus, device matrix, range/latency measurements or octave-reliability rate is established by this observation.
- **CONTROLLED DEVICE/INSTRUMENT QA — PENDING:** Chromebook/Android microphone permission UI and indicator, broader violin/ocarina/sung-voice coverage, quiet/noisy conditions, independent pitch reference, octave errors, capture-to-display latency, mobile route interruption and sustained performance. Record device/browser, instrument/range, conditions, reference, failures and unsupported combinations when testing occurs.

Owner procedure: use HTTPS/localhost and enable the normal navigation's Tuner. Test a fresh denied permission, grant/retry, cancel an unanswered prompt, Stop during startup and restart. Play violin G3/D4/A4/E5 and several sustained ocarina notes, with an independent trusted frequency reference where available. Repeat each in quiet and noisy rooms, at different dynamics and through bow/breath attacks, vibrato and decays; distinguish wrong-octave episodes from uncertainty/clearing. Verify a fading tone does not become a reliable new harmonic note. Check 120–2300 Hz limits and chromatic accidentals/octave transitions. Keep other playback quiet, then deliberately test acoustic interference without recording audio.

On both devices, hide/switch apps, lock/unlock, interrupt or unplug the audio route, revoke permission, and return: capture should stop and require Start. Navigate away while listening and while the prompt is pending; a late grant must not restore capture. Start an active hosted Practice Session, leave it hidden and confirm tuner Start is blocked; return, End Session, and confirm listening becomes available. Repeat ten Start/Stop cycles and check the browser microphone indicator extinguishes. Check portrait/landscape, 200% zoom, keyboard focus, accessible error messages and announcement rate. Run >=30 minutes foreground to assess heat, responsiveness and cleanup. Physical onset-to-display latency is unmeasured without an independent synchronized setup. Do not store or upload audio.

Include violin open strings and beginner first-position stopped notes; compare independent references through bow attacks, dynamics, decays and octave transitions. For ocarina, identify the actual instrument/tuning/system before claiming range or mapping; future diagrams need a verified standard chart. For sung voice, test sustained notes, octave changes and stability in appropriate ranges; this is not speech recognition. Observe permission, route changes and long-run behavior in browser tabs and installed PWAs without recording/uploading audio. Future instrument diagrams need text equivalents and must describe recommended/alternate ways to produce a pitch, not infer the physical fingering used.

Octave ambiguity and provisional decay thresholds remain limitations even when deterministic tests pass. The tuner MVP is implemented; broad device/instrument QA remains pending. Hardware unavailability does not block unrelated musical work. Practice integration and processing expansion require separately approved plans.

### Future acoustic consumer gates (not implemented practice support)

Validate each activity's accepted observation, acquisition, freshness, repeated-pitch rearming, uncertainty, timing semantics, source attribution and octave handling. Ungraded live notation, stable-note answers, intonation summaries and timed attacks require different evidence; passing tuner QA does not validate all of them. Test actual targets/passages for range, polyphony, repeated attacks and tie/roll requirements. No frequency-frame-to-MIDI substitution, invented releases/velocities or expected-answer octave coercion is acceptable. Preserve deterministic regression fixtures for observed failures where practical; controlled physical evidence gates support and grading claims.

## Targeted Practice PROVISIONAL MVP

Focused validation: `pnpm test src/features/piece-practice/piece-practice-targeted-practice.test.ts src/features/piece-practice/components/piece-practice-targeted-practice.test.tsx src/features/piece-practice/components/piece-practice-session.test.tsx`, followed by `pnpm verify`.

The selector tests exercise completed-range eligibility, transparent count priority, score-order ties, native rolled-failure counts, no fabricated retry/time/velocity evidence, immutability, and compatible/incompatible comparisons. UI tests cover actual reasons, provisional-policy text, lazy semantic-staff notation, named keyboard-accessible controls, disabled/unavailable states, clean/incomplete runs and descriptive count comparison.

Session regressions cover fresh focused run identity/evidence, exact original range/snapshot/focus, one input owner, pending/failed original and focused saves, duplicate launch, cancelled/confirmed unfinished return, keyboard focus restoration, repeated passage comparison, incoming boundary ties, ordinary V1 paused recovery, Mobile Play continuity, targetless restart-only measures and ordinary Practice Again reset. Existing full-suite MIDI/roll/tie/Staff Focus/report/recovery tests remain authoritative; Targeted Practice does not alter those engines.

The final owner-audit regressions deliberately settle older original, abandoned focused and pre-restart checkpoint promises after another focused run completes. Both late success and late failure must leave the current result's save status, unload protection and evidence intact. They also verify restoration of an acknowledged unsaved original, and preserve an explicit unsaved comparison notice through failed-save acknowledgement, return and unfinished repetition until a successfully saved replacement completes.

Manual Chromebook/Yamaha checklist (still required):

1. Complete a run containing mistakes, skips, Restart Measure actions and slow responses. Confirm every suggestion explains recorded evidence and concrete problems precede hesitation-only measures. Verify a clean run's empty state.
2. Use Practice measure N under Both/Upper/Lower Staff Focus. Confirm original measure numbering, spelling, lyrics/clefs/meter, boundary ties, ordinary/rolled chords, optional accompaniment and expected keyboard input.
3. Return both before and after completion. Cancel an unfinished return while a chord is partly collected, then continue. Verify original evidence remains intact, completion counts stay descriptive, and repeated attempts replace only that measure's latest completed comparison.
4. Use keyboard and screen reader through recommendation, notation expansion, launch, completion and return. Confirm visible focus, touch targets, scrollable notation and accessible comparison labels at portrait/landscape/zoom sizes.
5. Enter/exit Mobile Play across the whole path; verify one input session, audio and Yamaha sustain/overlap/hotplug behavior. Exercise ordinary Piece Practice without using Targeted Practice.
6. Reload during focused practice and resume paused through ordinary recovery. Reopen a completed report after changing/deleting its library piece; preserve the practiced snapshot. Verify pending/failed save protection where reproducible.
7. Inspect Copy Report and browser Print/Save PDF for original and focused runs separately. Verify cached offline VKB and installed PWA. Comparison/navigation links are intentionally in-tab only and are not part of copied/printed reports.

## Ledger-line indicator readability

VexFlow event bounding boxes exclude ledger lines. Event anchors therefore retain their original interaction geometry and publish separate optional `highlightBounds` that enclose ledger strokes (including stroke thickness, staff-side lines, and displaced chord heads). Only event-highlight rectangles consume those bounds. Selection, touch targets, pointer ownership, palettes, diagnostics, playback, and capture cursors retain their existing geometry and behavior; all existing highlight states retain the notation foreground layering and colors.

Focused rendering tests cover B5/C6/D6/G6/A6/B6, lower A1/C2/D2, displaced upper/lower chords, and a chord spanning both ledger ranges with an accidental. They compare actual SVG ledger stroke coordinates with presentation bounds and assert unchanged VexFlow interaction bounds and score data. Real-renderer score-view tests cover all six event-highlight statuses, active/inactive notation, foreground/background CSS, scaled clearance at 480/570/760px, adjacent-note/chord pointer selection, unchanged touch/selection rectangles, and chord duration editing. Mocked canvas metrics in Vitest establish geometry invariants, not visual legibility; local Chrome raster inspection with real VexFlow fonts complements those tests. Device QA remains required.

Focused validation: `pnpm test src/features/staff-builder/components/staff-builder-score-view-ledger.test.tsx src/features/staff-builder/components/staff-builder-score-view.test.tsx src/features/staff-builder/notation/render-staff-builder-measure.test.ts src/features/staff-builder/notation/staff-builder-vexflow-rendering.test.ts src/features/staff-builder/notation/staff-builder-vertical-geometry.test.ts`, then `pnpm verify`.

Chromebook/Yamaha QA after deployment:

- Practice B5/C6/D6 and G6/A6/B6; count every ledger line while each target is active, then compare inactive notation. Confirm the indicator remains easy to locate.
- Repeat at browser zoom 75%, 100%, 125%, and 150%, and with narrow/wide layouts; marker and notation must scale together without clipping or pitch movement.
- Repeat for low A1/C2/D2 and upper/lower chords, including adjacent chord heads, accidentals, beamed notes, and ties.
- Check Piece Practice advancement and success/error highlighting, plus staff-focus ghosting and result diagnostics. Confirm authored pitches are still graded as before.
- In Staff Builder, select closely spaced notes and chords by touch and keyboard, edit their durations, and inspect selection, capture cursor, and playback highlighting.

## Piece Practice physical overlap and note presentation

Staff Focus coverage exercises default strict Both Staves, semantic Upper/Lower filtering through clef changes, shared-pitch onsets, unassessed-only measures, boundary ties, required-pitch completion, optional physical/virtual attacks, block and rolled collectors, held notes, first-attempt timing, raw velocity/release evidence, restart lifecycle, readable ghosted notation, and assessment labels in results, Copy Report, and print/PDF. Optional input uses an exact unassessed sounding span at the current assessed score tick before the inclusive three-semitone register guard; optional attacks do not arm the first target. Manual Chromebook/Yamaha QA should play nearby wrong notes and far authored accompaniment around focused chords and rolls, test the first unarmed target, then inspect high A5/B-flat5/C6/D6 and low bass ledger lines with accidentals, stems, beams, and ties at several zoom levels. Highlight borders and diagnostic markers must stay behind notation. Confirm restart-only measures appear in default PDF scope and Copy/PDF show matching counts; print notation should have no live target highlight.

Focused validation: `pnpm test src/hooks/use-midi.test.ts src/components/midi/midi-provider.test.tsx src/features/piece-practice`, followed by `pnpm verify`.

Regression coverage checks detached A5/G5 transitions, immediate natural legato, several connected notes without target lag, inside/exact/outside 250 ms policy boundaries, stale older notes at subsequent observations, no retrospective single-note failure, and nonrenewal across retries/attacks/snapshots/releases. Chord-to-chord, chord-to-note, and note-to-chord overlap retain required fresh attacks. Extra new pitches fail immediately even when equal to the predecessor pitch. Delayed chord callbacks cannot change eligibility from actual attack times; actual attacks after expiry remain diagnostically relevant. Existing authored-span/tie and parallel-roll checks remain covered, and only entirely completed targets establish predecessors. Lifecycle tests cover skip, measure/piece restart, excerpt/session reset, pause/resume, and disconnect/reconnect.

Shared MIDI tests retain independent CC64 behavior and exercise the real provider/Piece Practice input path across pedal-held legato. Both release encodings remove physical keys and preserve their encoding; conventional release velocity and optional source timestamps remain observations. Disconnect/teardown never generate release evidence. Repeated same-pitch On/On/Off/Off behavior documents the existing Set limitation across channels/inputs and confirms separate attack/velocity events survive it.

Presentation tests cover F5/A5/D6 instead of raw MIDI 77/81/86, authored target and predecessor spelling, effective key context, written octave, and rejection of unrelated score-occurrence spelling. `Show MIDI details` defaults off, adds exact raw numbers when on, and remains independent of `Include MIDI attack strength`. Completed results, clipboard reports, and print/PDF DOM all use the same note-name-first resolver without modifying raw internal evidence or grading. Source/release timing and velocity do not assess articulation, sustain, dynamics, hands, or voices.

Owner manual QA remains necessary: replay the BWV 565 descending passage with natural overlap; hold an older unrelated key into a later target; retry a chord after expiry; operate sustain across releases; restart/skip and disconnect/reconnect while keys are down. Check unexpected-note names and authored flats, keyboard access to both result checkboxes, clipboard fallback, and actual browser Print / Save PDF output with each checkbox combination. No score-schema, persistence, MIDI Diagnostic, or network behavior changes are part of this task.

> **Historical preparation checkpoint:** v2.6.5 Staff Builder Lyric Cues authoring, Study View printing and measure deletion. This records that earlier preparation, not the current version or a release/tag claim.

That earlier recorded checkpoint had 2,230 passing tests across 196 test files; it is not a fresh current result. The complete `pnpm verify` workflow covers ESLint, TypeScript, the automated suite and production/PWA build. Outstanding Practice Session report/print-preview and broader physical MIDI, browser, responsive, accessibility, fullscreen/orientation and offline checks remain ongoing QA where relevant.

> Older checkpoint metadata recorded v2.5.0 as its latest tag and September 29, 2026 as its update date. These are historical, not current tag assertions.

## Purpose

Prelude's tests should provide confidence in its musical rules, practice behavior, and release stability without becoming brittle or duplicating implementation details.

Testing should also make the codebase easier to understand and safely extend.

## Testing Philosophy

- Test behavior and musical rules rather than internal implementation.
- Prioritize pure functions before React hooks or components.
- Prefer small, deterministic tests.
- Test random generators through constraints and invariants.
- Mock randomness only when a specific branch must be controlled.
- Avoid exporting private helpers only for testing.
- Avoid broad snapshots and fragile DOM assertions.
- Do not chase coverage percentage for its own sake.
- Add integration tests only where they provide confidence not already covered by unit tests.

## Testing Stack

Prelude uses:

- Vitest
- React Testing Library
- jsdom (only for hook/component tests)

The v2.0 baseline did not require end-to-end or visual-regression testing. Focused desktop synthetic tuner browser evidence now exists; it does not replace a physical MIDI/device suite or installed-PWA validation.

The current Vitest and React Testing Library workflow is established and should remain the default testing approach for new features.

## Test Organization

Tests should live near the code they verify using the following naming pattern:

```text
source-file.test.ts
source-hook.test.tsx
```

Tests should be grouped by public behavior and use musical terminology in their descriptions.

## Historical Foundation Checklist

These completed blocks record earlier testing milestones, not a current release declaration.

- [x] Block 1 — Core Practice Logic
  - [x] `src/lib/practice/answer-validation.test.ts`
  - [x] `src/lib/practice/session-stats.test.ts`

- [x] Block 2 — Music Theory
  - [x] `src/lib/music/notes.test.ts`
  - [x] `src/lib/music/note-utils.test.ts`
    - [x] theory root-letter candidates
    - [x] sharp and flat theory spelling
    - [x] B♯ and C♭ octave boundaries
    - [x] unsupported double-accidental rejection
    - [x] `getNoteName`
    - [x] `getNoteOctave`
    - [x] `getFullNoteName`
  - [x] `src/lib/music/generators/triads.test.ts`
    - [x] `getTriadMidiNumbers`

- [x] Block 3 — Configuration and Target Generation
  - [x] `src/data/note-ranges.test.ts`
  - [x] Reviewed `src/types/practice.ts`; no runtime tests required
  - [x] `generatePracticeTarget`
  - [x] `generateTriadTarget`

- [x] Block 4 — Stateful Hooks
  - [x] `useFlashcardSettings`
  - [x] `useFlashcardTarget`
  - [x] `useChordAttempt`
  - [x] `useCorrectAnswerSequence`
  - [x] `useMidi`

- [x] Block 5 — Integration
  - [x] `FlashcardSession`

- [x] Final Review
  - [x] Complete Vitest suite passed
  - [x] Lint passed
  - [x] Production build passed
  - [x] Testing documentation completed
  - [x] Testing methodology documented
  - [x] v1.0 release ready

- [x] Block 6 — Sequence Practice
  - [x] `src/lib/practice/sequence-validation.test.ts`
  - [x] `src/lib/practice/sequence-stats.test.ts`
  - [x] `src/lib/music/generators/sequences.test.ts`
    - [x] interval semitone distances and direction
    - [x] scale and arpeggio generation constraints
    - [x] theory-aware interval spelling regressions
    - [x] repeated generation without unsupported spelling crashes
  - [x] `src/features/sequences/hooks/use-sequence-settings.test.ts`
  - [x] `src/features/sequences/hooks/use-sequence-attempt.test.ts`
  - [x] `src/features/sequences/hooks/use-sequence-target.test.ts`
  - [x] `src/features/sequences/hooks/use-sequence-transition.test.ts`

**Historical Result — earlier recorded suite**

- Test files: 137 passed
- Tests: 1,548 passed
- These were the reported local results at that checkpoint, not a fresh validation of the current tree.

## Testing Blocks

### Block 1 — Core Practice Logic

Add the test runner and establish the basic workflow.

Test:

- `answer-validation.ts`
  - exact note and chord matching
  - order-independent chord matching
  - missing, extra, and incorrect notes
  - target MIDI-number extraction

- `session-stats.ts`
  - initial values
  - correct and incorrect updates
  - streak behavior
  - response-time accumulation
  - immutability

### Block 2 — Deterministic Music Logic

Test:

- note names using sharp and flat spellings
- MIDI octave boundaries
- full note names
- triad MIDI numbers for:
  - major
  - minor
  - diminished
  - augmented
  - root position
  - first inversion
  - second inversion

Use table-driven tests where appropriate.

### Block 3 — Target Generators

Test public generator behavior and musical invariants.

Individual-note targets:

- respect the selected clef
- respect natural and accidental filters
- remain inside the clef range
- produce matching MIDI numbers, spellings, octaves, and labels
- reject invalid empty configurations

Triad targets:

- contain exactly three notes
- respect enabled qualities and positions
- remain inside the clef range
- preserve correct chord spelling
- produce correct inversion order
- avoid double accidentals in v2.0
- reject invalid empty configurations

Do not test random distribution. Mock `Math.random` only for targeted branch coverage.

### Block 4 — Stateful Flashcard Hooks

Add hook tests only after the pure suite is stable.

Candidate hooks:

- `useChordAttempt`
  - collects nearby notes
  - completes after the grace period
  - clears and cancels correctly
  - cleans up timers on unmount

- `useCorrectAnswerSequence`
  - schedules feedback and advancement
  - waits for MIDI release when required
  - cancels and replaces sequences
  - avoids stale callbacks

- `useFlashcardTarget`
  - generates and exposes the current target
  - records target start time
  - locks one answer per target
  - unlocks after target generation

- `useFlashcardSettings`
  - preserves at least one enabled option
  - adds and removes selections correctly
  - keeps setting groups independent

Use fake timers for timing behavior.

### Block 5 — Focused Integration Tests

Add only if they provide meaningful confidence after the earlier blocks.

Possible test:

- a controlled virtual-piano answer produces correct feedback and updates session statistics

Avoid a broad `FlashcardSession` test that mocks most of the application.

### Block 6 — Sequence Practice

Test the ordered practice behavior introduced by Sequence Mode.

Current temporal coverage includes 4/4 meter capacity at 480 PPQ, generated quarter-duration conventions, synthetic eighth-note and mixed-duration timelines, cumulative onsets, simultaneous chord steps, exact-barline membership and endings, rejected cross-bar events, and final partial measures. Pure measure-window tests cover first, middle, and final windows plus global-to-local active-index translation.

Presentation and notation coverage verifies current-measure default rendering, `Measure n of m` with authoritative global step progress, presentation-only Whole Sequence toggling and state preservation, supported duration mappings, actual-meter voice configuration, temporal measure division, partial final measures, active styling, simultaneous chords, accidentals, horizontal whole-view behavior, and renderer geometry that keeps the final stave inside its SVG bounds.

Sequence logic:

- exact step validation
- completed-step tracking
- sequence completion statistics
- immutable statistic updates

Interval generation:

- semitone distances
- ascending and descending directions
- natural-note and accidental-note filters
- invalid empty configurations

Sequence hooks:

- required settings remain enabled
- attempt-state transitions
- target locking and regeneration
- MIDI-release-aware delayed transitions
- timer cleanup and cancellation

These tests should verify the public state-machine contracts rather than internal refs or implementation structure.

### Block 7 — v2.0 Music and Free Play

Test:

- theory-aware note spelling for intervals, scales, and arpeggios
- supported sharp, flat, B♯, and C♭ spellings
- deliberate rejection of unsupported double accidentals
- generation invariants across repeated randomized targets
- keyboard visual-mode behavior at the smallest useful layer when practical

Automated tests cover Free Play's music rules and component/renderer contracts. Continue focused manual verification for VexFlow layout, real MIDI interaction, and responsive grand-staff scaling, which are better assessed in the browser than through brittle SVG assertions.

The stale-setting regression is covered: changing an exercise type regenerates a target from the newly selected settings rather than the previous render's state.

### Block 8 — Chord Progressions

Automated progression coverage includes:

- deterministic root-position chord construction
- major, minor, diminished, and augmented chord spelling
- curated progression templates and supported-key realization
- natural-minor roots with explicit major-dominant and diminished-supertonic handling
- exhaustive compatible key/template/clef candidate coverage
- progression-specific range isolation from other Sequence exercises
- protected settings compatibility and target regeneration
- Roman-numeral and concrete per-step chord metadata
- shared chord-attempt timing, cancellation, and unmount cleanup
- physical MIDI rolled and block chord input
- persistent virtual chord selection and toggle removal
- grading and playback at the active step's note count, including variable-size chord compatibility
- statistics, retry, reset, regeneration, Focus Staff, completion, and stale-target cleanup
- Flashcard virtual/MIDI regression protection
- immediate single-note Sequence input for both virtual and MIDI sources

### Block 9 — Free Play Key-Aware Notation

Automated Free Play notation coverage includes:

- exact shared key definitions, stable IDs, labels, modes, tonic spellings, orientations, diatonic scales, and VexFlow signatures
- internal coherence of all 12 supported keys and Chord Progression regression after shared-key extraction
- No Key and named-key notation contexts
- Automatic, Prefer sharps, and Prefer flats chromatic policies
- protection of diatonic spelling from chromatic preference overrides
- MIDI validation across the supported 0–127 range
- enharmonic spelling and written-octave behavior at B/C and E/F boundaries
- duplicate removal, input immutability, and deterministic ascending output
- selected signatures on both treble and bass staves
- signature-relative natural signs and chromatic accidentals with independent stave state
- authoritative written-note accessibility labels
- immediate key and preference respelling while notes remain held
- equivalent physical and virtual MIDI spelling after held-state merging
- held-note preservation and no audio replay during notation-setting changes
- Focus Staff behavior and raw-MIDI virtual-key highlighting
- unchanged Flashcard and Sequence notation and Chord Progression behavior

### Block 10 — Shared Mobile Play

Focused automated coverage includes:

- immediate layout activation independent of fullscreen or orientation success
- missing, rejected, successful, stale, repeated, exit, and unmount browser lifecycle paths
- cleanup limited to fullscreen and orientation acquired by Prelude
- mutual exclusion with Focus Staff, including global Focus Staff activation
- target, statistics, feedback, current-step, held-note, and notation-setting preservation
- graded `onNoteToggle` semantics in Flashcards and Sequences
- Free Play momentary press/release semantics and pointer-note cleanup without clearing physical MIDI
- mode-specific staff scaling with no normal-mode leakage
- common responsive Mobile Play entry markup across supported modes
- removed portrait rotate overlays and singular Free Play/Sequence task-action wrappers
- keyboard-focusable, descriptively labelled Melody practice and result score scroll regions

Melody integration coverage preserves exercise identity, one lazy AudioContext, count-in and clock continuity, recorder/source locking, one keyboard and MIDI owner, results-heading focus, and Retry Same, Try Another, and Settings while Mobile Play remains active.

Current Melody coverage also verifies the two-quarter-beat preparatory display lead-in, timed diagnostic deadlines and interruption, immutable original trial evidence, appended repair retries, Session Review navigation and focus, original-versus-latest comparison, mastery summaries, and separate Sight Read/Repair interval analytics.

### Block 11 — Ear Training and Musical-Event Playback

Automated coverage includes:

- shared interval labels, semitone distances, and diatonic distances
- unchanged Sequence interval generation after shared-domain extraction
- ascending and descending theory-aware Ear Training targets within C4–C6
- required interval and direction settings
- interval-name validation independent of direction
- one incorrect attempt maximum per target and streak semantics
- attempt-hook grading gates, replay lock, duplicate-answer protection, timer cancellation, stale-advancement prevention, and unmount cleanup
- stable unplayed targets, replay, response timing, locking, settings regeneration, reset, and unmount cleanup
- deterministic musical-event offsets, simultaneous notes, durations, completion, replacement, cancellation, playback failure, stale callbacks, and repeated use
- cancellable grand-piano playback handles
- top-level mode switching and Focus Staff suppression
- Ear Training Mobile Play state preservation, accessible status/answer names, and standalone/hosted pedal-to-Play-Prompt routing through one active MIDI consumer

### Block 12 — Staff Builder

Automated coverage includes:

- canonical schema v4 score-domain invariants, v1/v2/v3 migration, unsupported/corrupt data, measure context, meter capacity, notes, chords, rests, ties, annotations, and upward arpeggiation
- Capture Notes routing, rhythmic cursor movement, pending input, replacement, and rest insertion
- Rhythm Correction selection, duration, event type, staff, spelling, independent incoming/outgoing pitch-level ties, long chains, partial chord ties, deletion, and score history
- visible ordinary Ties controls outside detailed correction, initial single-pitch selection, per-pitch chord actions, unavailable guidance, and a distinct collapsed barline split tool
- a real-session 6/8 same-measure tie from an eighth at tick 480 to a dotted quarter at tick 720, unchanged authored rhythm, Undo/Redo, Save/reopen, one playback span ending at tick 1440, and a Piece Practice continuation requiring no attack; canonical file round-trip coverage explicitly includes the same-measure relationship
- validation, guided corrections, draft persistence, validated Save, and local project recovery
- direct-score `.prelude.json` serialization, schema-validated import, round trips, collision-safe insertion, and accessible library file actions
- full-piece, treble-range, and bass-range duplication with fresh copy identity and source immutability
- deterministic event, measure, position, and piece playback, including silence and partial chords
- playback-follow measure display and sliding highlight without editor-state mutation
- renderer projection and public event, position, playback, and notation-control anchors
- deterministic pointer ownership, tap-versus-drag behavior, and responsive interaction geometry
- Duration, Key, and Time radial controls and their opening-gesture guard
- mobile virtual-keyboard lifecycle, safe-area presentation, and responsive state preservation
- accessible score semantics, direct notation controls, disclosures, and workspace integration
- annotation editing/layers and multi-system Study View layout, semantics, and geometry
- rolled-chord editing, schema validation, notation projection, playback, and accessible descriptions

Staff Builder Copy Score for AI coverage verifies actual clipboard text against canonical export and import round trips, title/timestamps/tempo, measures, both staffs, notes/chords/rests, unresolved rhythm, upward arpeggiation, study notes and lyric cues, schema v4 and measure clef changes, exclusion of non-portable metadata, score immutability, current unsaved editor changes, unchanged storage/history, and accessible clipboard-failure selection and retry. Manual browser checks should include keyboard/touch activation, clipboard permission denial, manual copying, and screen-reader status feedback.

Tie discoverability manual QA: create a 6/8 measure with a treble quarter rest, an eighth note and a same-pitch dotted quarter, plus a bass dotted-half rest. Select the eighth and use visible Tie Out without opening detailed correction. Confirm the rendered tie, one sustained playback attack, Undo/Redo, Save/reopen and no second attack at the Piece Practice continuation. Check chord pitch selection, unavailable guidance and cross-measure ties with keyboard/touch. Existing playback and Piece Practice suites continue checking same-measure/partial-chord sounding spans and non-attack continuations; browser audio and physical MIDI behavior still require manual evidence.

Measure-clef regression coverage verifies v1/v2/v3-to-v4 defaults, all four combinations, independent carry-forward/removal, redundant authored changes, insertion/deletion inheritance, canonical files/library/drafts/duplication/Copy Score, current-measure controls and Undo, Middle C/chord/roll/rest/tie/annotation immutability, system/range starts, visible in-system changes, ledger-line reservations, pending previews, Study/print rendering, and invariant Piece Practice MIDI targets, grading, diagnostics, and evidence. Manual QA should exercise keyboard/touch selection, system breaks and print ranges, high/low ledger lines under both clefs, and physical MIDI grading after clef edits.

### Block 13 — Blocking Piece Practice

Automated coverage includes:

- validation-gated projection from authoritative Staff Builder scores without copied persistence or `SequenceTarget`
- score-position grouping across chords, both staves, same-staff polyphony, independent rhythms, rests, and ties
- one aggregated normal check plus independent rolled checks, including mixed and multiple-roll same-onset targets
- exact normal pitch-set grading, tempo-relative upward-roll order/window grading, blocking retries, measure/piece completion, targetless measures, start-at-measure, and restarts
- physical single-note and ordinary 225 millisecond block-chord input, rolled-check expiry scheduling, stale-attempt cleanup, and stable MIDI ownership
- duration-aware authored sounding-span allowances without allowing held notes to satisfy missing attacks; a run started or measure restarted inside a tie chain requires a practice-only boundary reattack while full-piece progression does not
- persistent virtual chord selection and strict MIDI/VKB attempt separation
- read-only score presentation, authoritative multi-event highlighting, feedback, accessibility, and one responsive keyboard
- Staff Builder library eligibility, launch/failure/exit flow, updated-save relaunch, and source/storage immutability
- app-level MIDI connection persistence, token-safe active-feature routing, held-note handoff, idempotent connect, hotplug cleanup, and cross-mode listener stability
- realistic multi-measure 6/8 integration with polyphony, grand-staff chord material, rests, a cross-measure tie, retry, completion, and exit
- ordinary narrow/coarse layouts requiring explicit Mobile Play rather than automatic focus
- Mobile Play preservation of blocking mistakes, current target/measure, original timing, pending physical chord collection, and partial virtual chord selection
- unchanged Restart Measure, Restart Piece, explicit targetless-measure advancement, completion, and distinct Mobile Play/Piece Practice exits
- optional inclusive Piece Practice end-measure validation, bounded target and targetless-measure completion, original measure identity, same-range Practice Again, and through-end compatibility
- attempt-local authored-order measure results derived from normal, rolled-pitch, and rolled-expiry mistake transitions, including explicit clean-measure text and retained Restart Measure mistakes
- transient Piece Practice Skip Target advancement without completion credit, including input-state cleanup, mixed normal/rolled onsets, tied spans, measure/piece completion, restart counters, and boundary-only reattack protection
- Staff Builder editor Practice Piece readiness across validation, pending capture, validated-save snapshots, autosave isolation, edit/Undo equivalence, storage failure, and reuse of the existing Piece Practice projection without implicit writes
- exactly one mounted keyboard and input owner before, during, and after focused presentation

### Block 14 — Production and PWA Configuration

Focused automated coverage protects repository-owned release configuration:

- the Vite production base remains `/prelude/` rather than root `/`
- manifest scope and start URL remain aligned with the deployed subpath
- Workbox navigation fallback remains `/prelude/index.html`
- emitted piano WAV assets remain included in the precache glob
- generated service-worker registration remains in prompt mode

These tests cover stable configuration invariants only. Installed-PWA update behavior, real offline behavior and browser Web MIDI behavior still require manual validation on representative browsers/devices. The focused synthetic tuner harness is not a comprehensive browser E2E suite.

PWA Update + What's New focused validation: `pnpm test src/features/app-update src/lib/pwa/register-service-worker.test.ts src/App.test.tsx vite.config.test.ts`, then `pnpm verify`. Inspect the generated production worker for a message-gated SKIP_WAITING path rather than unconditional skipWaiting, unchanged scope/fallback/WAV precache, and the registration output for prompt mode and supplied `onNeedReload`. Do not infer device support from compilation.

Deterministic coverage establishes catalog identity/order, known/multiple/no missed updates, missing/malformed/unknown/pruned history, future markers, defensive storage failure and stale-tab writes. Hook/component tests cover startup-only notes, failed-write dismissal, accessible modal headings/sections, focus containment/restoration, Close/Got it/Escape acknowledgment, no backdrop acknowledgment, blocked background keyboard shortcuts, nonblocking notices and deferred indicators. jsdom mocks native dialog primitives; actual top-layer background inertness remains browser QA. Platform tests cover waiting/late/external activation, cancellation, confirmation, one navigation per request, consumed permission after cancelled navigation, duplicate callbacks, failure/timeout/replacement/disposal, initial install, throttled online/foreground/hourly discovery, hidden/offline suppression and concurrent checks. App coverage keeps the hidden Practice Session host and current feature intact across notifications.

### Controlled-update production/device QA (pending physical evidence)

Use an isolated test browser profile and TWO ACTUAL PRODUCTION BUILDS A/B served at the same origin and `/prelude/` scope. Both must include prompt registration; B contains a higher-sequence curated record. Use an ordinary tab and installed PWA, then Chromebook and Android where available. The first legacy transition is a separate pair, 2.8.7 to 2.8.8; do not expect new controls in legacy pages.

1. Load/install A online, acknowledge What's New and verify reopen does not show it. For fresh/cleared tracking state, show only newest; storage denial must still allow dismissal. Test keyboard Tab/Shift+Tab, Close/Got it/Escape, focus restoration, native background inertness, zoom and narrow layouts.
2. Publish B at that same test location while A remains open. Allow registration/foreground/online/hourly discovery; no immediate detection promise. Confirm the notice does not move focus or reload. Choose Later, retain the small indicator and verify duplicate callbacks do not reopen it. Cancel Reload; the page and waiting worker remain intact.
3. Confirm Reload, verify B's package version and newest-first notes, acknowledge, and reopen without notes. If browser unload protection cancels navigation, no later callback may retry; another Reload must obtain fresh consent. To test multiple missed entries, use a later real B catalog with at least two newer curated records than A's marker.
4. Repeat during Staff Builder editing and pending input, an active Practice Session (including when hidden), a transient report and Piece Practice. Without confirmed Reload, preserve state. After consent do not expect universal recovery; verify only the existing feature-owned saving/recovery/unload contracts.
5. Keep two A tabs/windows open. Choose Later in one; confirm Reload in the other. The deferred tab must remain open, recognize activation and offer a fresh confirmed reload without waiting for a past event. Check cached piano/VKB/audio assets in that still-open tab before moving onto B.
6. Go offline before B is available; remain usable without discovery. Return online/foreground and discover B. Separately cache a waiting B online, go offline, then explicitly activate/reload it and verify the new shell, notes and piano audio. Do not claim an uncached update can be found offline.
7. For first rollout, keep a legacy 2.8.7 tab/PWA open while deploying the first prompt build. Record waiting/activation behavior: old callbacks cannot be retroactively protected and may reload on activation. Close all old Prelude tabs/windows and reopen if necessary. Confirm the new build provides the controlled flow for later updates.

Record browser/device/build pair, outcomes and failures separately from automated counts. Installed/device and cross-tab asset evidence is still pending until these checks occur; musical QA continues alongside QOL work.

## Intentionally Not Deeply Tested

The initial suite should not deeply test:

- VexFlow's generated SVG structure
- browser audio playback internals
- full browser-level Web MIDI end-to-end behavior
- generated PWA/update/offline behavior beyond focused configuration checks
- GitHub Actions, Nginx, or DigitalOcean deployment
- Tailwind layout details
- random statistical distribution
- implementation-private helper functions
- large snapshots
- coverage percentage targets

These areas are better served by build checks, focused manual verification, or later integration and browser testing.

Prelude does not currently have a full browser Web MIDI end-to-end suite. Installed-PWA updates, navigation fallback, asset availability, and true offline behavior still require a production build plus manual validation on representative browsers/devices.

## Release Verification

Before declaring a release or implementation checkpoint complete, run:

```bash
pnpm verify
```

Use focused manual QA where browser, hardware, audio, or responsive presentation behavior cannot be represented fully in jsdom. Useful areas include:

- physical MIDI connection and note input on real hardware
- block chords and rolls near the 225 millisecond boundary
- sustain-pedal behavior and shared held tones between Sequence steps
- virtual piano note and chord input
- Chromebook mouse and touch behavior for persistent chord selection
- browser audio restrictions and completed-chord playback
- correct and incorrect feedback
- piano and feedback volume controls
- clef, note, triad-quality, and inversion settings
- responsive layouts
- ledger-line readability for progression chords
- Focus Staff entry and exit on real devices
- Free Play key-signature rendering on both staves
- F-natural in G major and B-natural in F major
- B-flat versus A-sharp spelling and sharp/flat preference changes
- simultaneous Free Play notes across both staves
- Chromebook and touch layout for notation controls
- Focus Staff spacing with key signatures
- browser-specific VexFlow glyph and accidental behavior
- browser audio restrictions while changing settings with held notes
- low and high notes placed on the expected staff
- stable blank grand staff when no notes are held
- neutral Free Play key highlighting
- installed PWA behavior
- offline application shell
- production deployment
- Flashcard single-note and triad play while toggling Mobile Play mid-target
- Sequence interval, scale, long-sequence, and chord-progression play while preserving the current step
- Mobile Play and Focus Staff transitions in both directions
- fullscreen and orientation refusal, plus external fullscreen exit while the layout remains active
- Flashcard, Sequence, and Free Play staff scaling on a phone
- Free Play two- and three-finger multitouch, cancelled touches, and stuck-note checks
- folded and unfolded Z Fold layouts
- Chromebook and tablet landscape layouts
- Ear Training first-prompt browser authorization and recovery after refusal
- ascending and descending prompt timing and pitch quality across C4–C6
- rapid Replay replacement, mode switching, reset, and settings changes during playback
- Ear Training answer-grid touch targets, keyboard focus, and screen-reader announcements
- Staff Builder physical MIDI capture and same-position replacement in treble, bass, and grand routing
- Piece Library Recently Played/Recently Updated/Alphabetical ordering, stable non-mutating fallback order, schema-v4 migration without fabricated practice history, launch-only timestamp updates, and non-portable duplicate/import/export semantics
- Staff Builder’s browser-local pedal Lock preference: default/read/write/error handling, valid capture commit/advance, empty-position advance, invalid-input suppression, pedal-up/repeated-down/stale-enable suppression, and unchanged score/draft schemas
- range-aware Staff Builder notation geometry across ordinary and MIDI-endpoint written pitches, single/grand staves, editor SVG bounds, per-system Study View offsets, ties, and the shared Piece Practice score view
- complete, incoming, and outgoing single-measure VexFlow ties, including middle-chain notes, independently tied chord pitches, untied siblings, enharmonic visible spelling, and Piece Practice boundary measures without grading changes
- event-anchored treble Lyric Cue authoring, history, schema-v3 persistence, import/export, recovery, duplication, dedicated range-safe rendering in editor/Study View/Piece Practice, accessibility semantics, and unchanged practice targets
- sequential Lyric Cues pass behavior, ambiguity handling, shared cursor/pedal entry, browser-native print ranges, selected-system rendering, and immutable measure deletion with tie/annotation/history reconciliation
- shared automatic beaming for simple and 6/8 meters, including eighth/sixteenth/mixed runs, beat boundaries, real rests, GhostNote offsets, genuine gaps, and independent derived voices
- discoverable per-pitch Staff Builder enharmonic controls, musical-name accessibility, sharp/flat round trips, chord/tie isolation, key-change retention, score-file persistence, and MIDI-based Piece Practice grading
- Staff Builder on Chromebook mouse and touch, including direct notation targets and tap-versus-swipe behavior
- Android portrait and landscape layout, folded/unfolded devices where available, and the mobile keyboard sheet
- radial Duration, Key, and Time control reachability, touch ergonomics, focus return, and edge clamping
- direct event, rhythmic-position, clef/brace, key, and time taps at responsive score scales
- audition, measure, from-here, and piece playback, Stop, and the sliding playback highlight
- rests, ties, partial chords, trailing silence, key/time changes, Undo/Redo, and guided validation corrections
- local project close/reopen, draft recovery, validated Save, and installed-PWA behavior
- annotations in edit and Study View, multi-system placement, keyboard focus, and screen-reader verbosity
- full-piece, treble-range, and bass-range duplication with the source left unchanged
- authored upward rolled-chord creation, save/reload, export/import, playback, and accessible notation
- Blocking Piece Practice launch from a saved valid piece and disabled-reason behavior for invalid pieces
- physical MIDI single notes, block chords, slightly rolled chords, rapid retries, held tied/sustained notes across later opposite-hand targets, and practice start/restart inside a multi-measure tie chain
- MIDI hotplug/disconnect during practice and clean Staff Builder ownership after exit
- desktop VKB and Chromebook touch chord selection, toggle removal, restart, and source switching
- Android portrait/landscape score readability, keyboard reach, target feedback, safe areas, and exactly one keyboard
- same-staff polyphonic notation/stems with playback and practice attacks aligned; sustained notes must not be re-required
- mixed normal/rolled and multiple rolled chords at one onset, including order, wrong-note, timeout, and tempo-relative window behavior
- rest-only and consecutive targetless measure acknowledgement, Start at Measure, restart statistics, and completion focus
- screen-reader verbosity, expected/missing/extra pitch feedback, disabled Practice explanation, and keyboard focus order
- save, practice, exit, edit, save and relaunch using the latest authored score, while existing durable run reports retain the original practiced snapshot
- sustain-pedal behavior is not graded in Phase 1 and should be observed as a known hardware/browser limitation
- Melody timed-session expiry/interruption, Session Review filters, original/latest evidence, repeated repairs, next-needs-review, and separate Sight Read/Repair interval reports
- visible and audible alignment of the two-quarter-beat preparatory lead-in without counting it as scored evidence

This is risk-based guidance, not an exhaustive manual-QA gate. Non-blocking issues found during normal use may be recorded through the project's bug-log workflow.

### Mobile UX real-device matrix still required

| Device class            | Highest-risk checks                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 360px portrait          | Compact navigation/header, Free Play and Sequence action flow, keyboard adjacency, safe-area Exit controls                 |
| 390–412px portrait      | Mobile Play entry policy, Ear Training header, Flashcard disclosures/stats, Piece Practice rolled-check actions/completion |
| Phone landscape         | Score/keyboard proportions, horizontal overflow, safe areas, explicit exit without session reset                           |
| Chromebook laptop       | Whole Sequence scrolling, narrow/wide breakpoint behavior, keyboard and mouse focus visibility                             |
| Chromebook tablet/touch | Coarse-pointer Mobile Play entry, touch controls, one keyboard/input owner, physical MIDI handoff                          |
| Android Chrome          | Fullscreen/orientation accepted, rejected, and unavailable paths; Escape leaves Prelude Mobile Play active                 |
| Narrow desktop          | Entry visibility below 1024px, document-flow layouts, keyboard scrolling of Melody score and Session Review regions        |
| Wide desktop            | Mobile Play entry hidden for mouse input, desktop navigation/grouping and headers unchanged                                |

Across the matrix, verify real MIDI attacks and chords, no duplicate input, Sequence Whole Sequence active-step discoverability, Staff Builder Study View/duplication/rolled authoring, Melody lead-in/timed review/repair scrolling and focus, and Piece Practice normal-plus-rolled blocking/restart/targetless/completion controls. This QA has not yet been performed.

## Future Opportunities

After v2.0, consider:

- focused audio utility tests
- VexFlow smoke tests
- browser-level MIDI mocks
- end-to-end practice-flow tests
- PWA installation and offline tests
- selective visual regression tests

### Raw MIDI diagnostic coverage

Pure byte-level tests cover Note On and both release encodings, attack/release velocity, channels 1 and 16, polyphonic/channel pressure, CC64 and arbitrary controllers, Program Change, minimum/center/maximum Pitch Bend, common one-/two-/three-byte system messages, reserved statuses, empty/data-only/truncated input, unexpected extra bytes, raw preservation, and MIDI octave-name boundaries. Capture tests cover fractional browser-relative timestamps, ordering, the newest-1,000 ring boundary, monotonic sequence numbers, dropped counts, deterministic TSV, multiple sources, and tab/newline sanitization.

Component tests use browser MIDI mocks for unsupported/rejected access, all initial inputs, multi-source attribution, hotplug/disconnect without duplicate listeners, unmount cleanup, pause/resume, Clear, copy success/failure/retry, selectable fallback text, semantic table structure, and the absence of event-by-event live announcements. App tests cover ordinary-mode reachability and unmount. These tests do not claim Yamaha behavior; velocity range, release encoding, pedal values, chord spread, rolled timing, unexpected messages, and Chromebook/tablet interaction remain physical QA after deployment.

## Release Verification Baseline

Prelude's automated release baseline is the complete `pnpm verify` workflow. Focused manual QA supplements it where hardware and browser behavior warrants direct observation.

### Automated Verification

The following commands were recorded as successful during earlier release preparation:

```bash
pnpm test
pnpm lint
pnpm build
```

Those commands and counts describe historical preparation. Current validation must run `pnpm verify` and report its exact executed test-file/test counts; the historical results above do not establish a present release candidate.

### Manual Verification

The following functionality was also verified prior to the v1.0 release:

- Physical MIDI keyboard input
- Virtual piano input
- Single-note practice
- Triad practice
- Rolled-chord detection and grace timing
- Correct and incorrect answer feedback
- Session statistics
- Clef, note, chord-quality, and inversion settings
- Responsive layouts
- Progressive Web App installation
- Offline application shell

These historical checks establish the earlier baseline only; later capabilities need their own automated and physical validation before release.


### Feature configuration regression coverage

Feature `*-config.test.ts` suites cover exact defaults, JSON round trips, Set/array boundaries, invalid selections, schema errors, Sequence subtype selections and progression compatibility, and separation of Melody generation settings from timed options. Settings-hook tests cover supplied mount-time prescriptions and stable selections on rerender. Settings-controls tests render editors without an exercise engine or MIDI provider and omit runtime reset actions. Existing session tests remain responsible for target regeneration, reset/statistics, input ownership, Mobile Play, and Melody timed behavior.

For changes to these boundaries, manually check Flashcard defaults and settings; every Sequence subtype and its settings; Ear Training selections; and Melody generation settings plus Continuous Practice setup. Configured first-target launch is covered by the engine contract tests below; Scale Repertoire has additional coverage below.


### Configured engine contract coverage

The Flashcard, Sequence, and Ear Training `*-session-contract.test.tsx` suites exercise real settings, generators, locks, and grading with deterministic randomness. Presentation/audio/input boundaries are substituted so the tests can inspect the first presented target and invoke input without browser MIDI/audio. Coverage includes configured first targets, all Sequence subtypes, stable mount-time config, unchanged standalone starters, no Ear Training autoplay, partial and incorrect input, eventual success, exactly-once notifications, callback replacement, Strict Mode, reset/settings changes, delayed advancement, and unmount. Flashcards also exercises a host replacing a keyed engine directly from triad completion.

For standalone manual regression QA, open Flashcards normally and check its starter, settings, and reset. Exercise each Sequence subtype and check settings, completion, and reset. In Ear Training check explicit playback, guesses, replay, and reset. Existing session/input suites continue covering MIDI, virtual keyboard, audio, and engine-owned Mobile Play behavior; Practice Sessions exercise the configured launch contract through their own host.


### Practice Session preset coverage

The focused Practice Session validation suite covers every engine/config/target family, nested feature-parser delegation, independent schema versions, corrupt and unsupported data, positive and missing numeric targets, Scale Repertoire mode compatibility, timed Melody compatibility, preset-local exercise ID uniqueness, library-wide preset ID uniqueness, ordered and detached parsing, duplicate labels, and stale last-used normalization. Runnable validation coverage distinguishes structurally valid drafts from launch-ready prescriptions and checks concise issues for zero exercises, missing counts, empty repertoires, and non-continuous Melody. Library coverage additionally requires v1-to-v2 in-memory migration without write-on-load, v2 serialization, curriculum reference integrity, empty curriculum validity, and referenced-day removal on preset deletion.

Weekly Practice contract coverage validates minimal and realistic partial-week examples, all nine reduced exercise variants, exact keys, unknown fields, duplicate weekdays/selections, string/input/item bounds, detailed contextual paths, strict all-major/all-minor progression compatibility, and selectable Scale Repertoire parity. Every successful external exercise is translated from feature defaults and must pass the existing canonical entry/preset parsers and runnable validation. Schema tests mechanically cover all discriminators, enum sources, limits, Draft 2020-12 declaration without `$id`, examples, and the Copy-for-AI generator's raw-JSON, unsupported-capability, pedagogy, and no-runtime-evidence instructions.

Weekly Practice workflow coverage checks shared paste/file handling, early and authoritative size rejection, readable nine-concept/rest-day previews, detailed issue presentation, deterministic normalized name collisions and editable-name validation, bounded collision-safe identity allocation, cancel/failure non-mutation, atomic ordered merges, preserved existing data and last-used selection, working-versus-saved behavior, success messaging, and dialog keyboard/focus behavior.

Weekly Practice generation-guide coverage checks selective clarification and final raw-JSON instructions, all nine authoritative concept descriptions, contract-derived limits and allowed values, exact generator-to-clipboard parity, repeated copying, accessible success and failure announcements, selectable full-text fallback and retry, independent opener focus restoration, shared modal containment/Escape behavior, and the absence of storage or AI/network mutation.

Piece Practice diagnostics coverage verifies every mistake-producing grading transition, evidence-derived counts, authored measure identity and ordering, retry/restart retention, active-time accumulation, visibility pauses, completion freeze, tempo-derived hesitation thresholds, skip/problem separation, expandable chronological details, problem filtering, and report options. First-target timing tests cover long setup delay, wrong first attacks, block/rolled MIDI and virtual input, leading rests and arbitrary range starts, unarmed skips, pause/resume, restarts, later-target activation timing, and Copy Report/print wording. Staff Builder renderer coverage keeps event anchors stable while verifying pitch-level anchors for diagnostic overlays.

Practice Diagnostic Shorthand coverage verifies feature-local derivation of Pitch, Identification, Hesitation, Retried, and Skipped; distinct accessible semantics for Pitch problem evidence versus Melody's neutral Pitch metric; unavailable Movement handling; absence of inferred hesitation or Melody warning thresholds; retained engine-native detail; and equivalent screen/print presentation without changing Prescribed/Bonus/Recorded phase boundaries.

The Practice Session library suite covers immutable create, rename, add, update, remove, reorder, duplicate, delete, and last-used operations. Duplication tests require fresh IDs and detached config snapshots. Storage tests cover the empty default, explicit JSON save/load, order preservation, no writes during load, stale-preference normalization without rewriting, corrupt/unsupported preservation, unavailable storage, failed writes, and refusal to save invalid libraries. There is no Practice Session UI or runtime manual QA in P4.

P5 builder option tests cover all eight human-facing concepts, parser-valid default entries, null numeric targets, Scale Repertoire's marker target, and Melody's config-owned duration. Presenter tests cover concise concept, configuration, and target language. Exercise-editor tests verify direct reuse of controlled Flashcard, Sequence, Ear Training, and Melody settings, temporary numeric draft input, and atomic numeric/repertoire Sequence target transitions.

Builder integration tests cover empty and valid loading, create/edit/reorder/duplicate/remove flows, readiness text, explicit single-write saves, save failure, preset deletion confirmation, and corrupt-storage recovery. Start Fresh coverage requires an absent saved baseline, an enabled empty replacement save, and unchanged original bytes until Save. App coverage keeps Practice Sessions in the local mode navigation and verifies that its builder remains mounted but inaccessible while hidden.

P6 pure reducer coverage checks detached snapshots, deterministic externally supplied identity/time, numeric achievement and uncapped Bonus, explicit Scale Repertoire completion, ordered final-scale events, Skip/Next/End/Finish dispositions, entered-only records, and stale exercise/run callback rejection. Runtime component tests substitute the four engine presentation boundaries to verify one keyed engine, exact initial config, immediate advancement, host progress, and Melody continuation success/failure without remounting.

Builder start tests cover Ready-only launch, current unsaved working presets, clean preference-only persistence, dirty no-write behavior, failed preference writes that do not cancel practice, and recovery-authorized no-write behavior. Engine contract tests verify hosted settings/reset suppression alongside unchanged standalone controls and retained performance actions. Melody review coverage separately preserves repair interactions while hiding Settings and New Timed Session in hosted presentation.

After deployment, create a short Ready preset with count, Scale Repertoire, Ear Training, and one-minute Reading Flow entries on the Chromebook/tablet. Start without an intervening configuration screen; reach one target, use Bonus, then advance. Confirm repertoire progress includes its final scale, Melody waits for its own timed Review, Skip advances neutrally, End produces a comprehensive authored-order report including never-entered work, Back restores unsaved builder state, and hosted Mobile Play remains continuous across prescribed exercises. Briefly verify standalone settings/reset and engine-owned Mobile Play remain present. Reading Flow here is the existing timed Melody prescription, not validation of future sustained Flow.

P7 hosted Mobile Play coverage verifies that the stable Practice Session runtime acquires fullscreen/orientation once, exposes one Exit action, remains the only fixed `.mobile-play-mode` shell, and retains that lifecycle across every four-engine transition. Tests keep one keyed child mounted, distinguish embedded hosted layouts from standalone fixed engine ownership, keep Skip/End/completion/Bonus controls reachable, preserve count and Melody Bonus without remounting, and confirm End/Finish/final Skip cleanup plus summary focus and Back behavior. Explicit Exit retains the active engine and restores focus to the host entry action. Existing hook and engine suites remain responsible for standalone acquisition, cleanup, Focus Staff interaction, Melody audio/timer continuity, Ear Training prompts, and local entry/exit behavior.

The hosted-presentation suite additionally covers independent Practice Session Focus and keyboard visibility state, persistence of both across Next and Skip, unchanged child identity, and no fullscreen/orientation reacquisition while either is toggled. Flashcard, Sequence, and Melody contract coverage verifies that hosted keyboard hiding reclaims its wrapper while physical MIDI behavior and standalone defaults remain intact. Target completion coverage verifies the labelled modal dialog, initial action focus, focus containment, Escape blocking, inert background, still-mounted exercise, reducer-owned progress freeze, same-instance count and Melody Bonus, and unchanged Next/Finish semantics. Final presentation QA is intentionally deferred to the deployed Chromebook/tablet for viewport allocation, touch ergonomics, physical MIDI, fullscreen/orientation, installed-PWA, and safe-area behavior.

Phase 3 reporting coverage verifies each engine-local report selector independently, including native completion/identification terminology, retry evidence, response/completion timing, unresolved attempts, repertoire coverage, and Melody's existing diagnostic semantics. Boundary/final coverage proves equal snapshots produce no Bonus report, appended evidence is attributed to the correct phase without mutating the boundary, unresolved evidence remains phase-local, and missing/untrustworthy boundaries do not fabricate a split. Host report tests cover authored order, never-entered exercises, neutral outcomes, prescribed versus Bonus presentation, active-time derivation, collapsed detailed diagnostics, and conditional Bonus diagnostics. Runtime integration retains summary focus and Back behavior while rendering the comprehensive report.

Phase 4 print coverage verifies all six default options and toggles, dialog focus containment/Escape/Cancel restoration, skipped/not-entered filtering with truthful authored numbering, independently controlled summary/detail/timing/diagnostic content, prescribed/Bonus and Recorded-evidence output, and compact Melody semantics without notation duplication. Lifecycle coverage verifies mounted-before-print behavior, `afterprint` and fallback cleanup, repeat generation, unmount cleanup, and regressions through the existing Staff Builder and Piece Practice print paths.

Final viewport, safe-area, browser chrome, physical keyboard and orientation behavior still requires verification after deployment on the actual Chromebook/tablet. P7 intentionally adds no broad browser/device matrix and preserves the established browser-Escape behavior.


### Scale Repertoire coverage and manual checks

`scale-repertoire.test.ts` checks all 28 catalog identities, exactly 26 selectable entries, disabled G-sharp altered-minor forms, exact 15-note C major and A natural/harmonic/melodic minor sequences, E major and C-sharp melodic minor spelling, and realization of every selectable scale in both clefs. Finite traversal tests check explicit order, deterministic shuffle permutations, no repeats, one completion boundary, fresh cycles, and no advancement from realization.

Sequence config tests cover version 2, explicit rejection of old/unknown versions and unsupported scales, ordered JSON round trips, detached arrays, Random defaults, and empty setup. Session contract tests cover first repertoire target, mount-time props, all-15-notes completion, retry/partial input, exactly-once native/traversal notifications, reset/reorder/mode changes, Shuffle cycles, empty input blocking, and Strict Mode/unmount. Target-hook coverage confirms regeneration cannot advance a traversal and repeated completion calls cannot advance a locked target twice. Settings tests cover 28 visible checkboxes, the accessible disabled reasons, selection/removal, and focus retention when reordering. Card coverage keeps status inside the existing Mobile Play layout.

Manual QA: open Sequences - Scales and verify Random first. Switch to Repertoire - In Order; select C major, A natural minor, A harmonic minor, A melodic minor, and G major. Reorder them, complete one 15-note scale, and verify the next selected scale appears. Try Shuffle and finish a full cycle without repeats. Check G-sharp natural minor is selectable and both altered forms are visible/disabled with the explanation. Reset traversal, clear the selection, then select again. Check Mobile Play retains one keyboard and readable notation/status. Briefly exercise Intervals, Arpeggios, and Chord Progressions. No CI or runner configuration is involved.


### Melody configured launch and timed-target contract coverage

`melody-session.test.tsx` uses the existing seeded generator, controllable audio clock, and animation-frame harness, plus fake interval timers. Coverage checks all configured generation settings/options in the first generator call, unchanged defaults, mount-only props, no pre-Start audio/deadline, and expiration during count-in/performance or between phrases. Completion assertions inspect committed Review and final trial evidence from the callback itself. Tests cover Strict Mode, latest callback delivery, no repeated notification, immediate host continuation/unmount, unfinished unmount, delayed audio startup, Settings cancellation, and fresh timed runs.

Runtime-ref continuation tests retain original and Repair evidence across fresh phrases and Review retries, reject concurrent continuation calls, and confirm that no new countdown or notification appears. Non-continuous results do not notify. Existing review, interval-analytics, recorder, audio, and Mobile Play suites continue guarding their respective feature behavior. Reusable settings controls remain tested independently of the performance engine.

Manual QA: open Melody directly and check standalone defaults; change staff/key/tempo/length and start a phrase (pitch/rhythm difficulty remain the existing easy-only settings). Enable Continuous Practice with a one-minute duration and confirm the countdown starts with the normal Start/count-in. Let the deadline expire during or between phrases; confirm the final phrase/result is retained in Review. Retry a reviewed phrase and check Original versus Latest results. Return to Settings and start again; also try New Timed Session and standalone Mobile Play. Standalone Melody exposes no host continuation button; Practice Session invokes that API through its own Bonus action, as covered by automated host tests.


### Staff Builder AI guide validation

`staff-builder-llm-specification.test.ts` verifies deterministic output, parity with current domain values, every embedded example through the real piece importer, practice-ready examples through musical validation, v4 clef/pitch round trips, and the distinction between import acceptance and practice readiness. Parser regression probes cover unknown-field canonicalization, IDs/timestamps, unsupported values, and lyric-cue restrictions.

`staff-builder-guide-dialog.test.tsx` covers exact clipboard output, failure/manual selection, retry, concurrent-copy prevention, modal focus, Escape/Close, and focus restoration. `staff-builder-session.test.tsx` verifies guide preview/copy/failure/retry leave editor history and all stored draft/library/metadata data unchanged, and retains the separate current-score copy path.

Manual checks: open the ? dialog on desktop/tablet/mobile; inspect the expandable guide; copy into a text editor; deny clipboard access and manually copy the selected text; verify Escape/Close returns focus. Import the guide's practice-ready example through Piece Library and confirm validation succeeds. No AI or provider calls are required.


### Piece Practice durable autosave and recovery

Focused automated validation: `pnpm test src/features/piece-practice/persistence/piece-practice-runs.test.ts src/features/piece-practice/components/piece-practice-session.test.tsx src/features/staff-builder/components/staff-builder-session.test.tsx`. The persistence suite covers V1 read normalization, V2 score snapshots and microphone configuration/evidence, focus, unarmed and armed timing, clock rebase, evidence round trips, strict rejection, stale-revision guarding, revision 2 through 100 active-write coalescing, terminal supersession and cross-run ordering, terminal retention, bounded retry, and explicit discard. Component tests cover initial save, authoritative checkpoint transitions, Restart Measure/Piece identity, confirmed/cancelled Exit, held and failed final completion saves, unload protection through final commit, historical completion, and paused focused recovery. Staff Builder tests directly cover Resume, Open Report, persisted snapshot/focus, selected-run Discard, and corrupt/future-version rejection. The native IndexedDB adapter and physical browser lifecycle still need device QA.

Manual Chromebook QA after deployment:

1. Start a run, play partway, reload, then resume from the recovery card. Repeat after mistakes, while paused, and in Upper/Lower Staff focus; verify the focus label and unassessed-staff ghosting.
2. Start and reload without playing. Verify the first target remains unarmed. Reload after its first attack and verify paused/closed time is excluded from active time and response timing.
3. Reload during a block chord and during a roll. Retry those incomplete inputs; completed checks and evidence should remain, but the old input window should be gone. Verify no synthetic release is reported.
4. Complete a run, leave without printing, return, and open Last completed practice. Edit or delete the source library piece and repeat. Check note spelling, Copy Report, Show MIDI details, attack-strength values, and Print / Save PDF from the recovered report.
5. Try Exit and Cancel, then Exit and confirm. Check that a completed run exits without a PDF prompt, browser reload shows the native active-run warning, and a fresh start or Restart Piece uses a new run ID.
6. If practical, disable browser storage or exhaust its quota and verify practice continues with a clear unsaved warning. Create more than eight terminal runs and confirm the oldest terminal record is removed while an active run remains recoverable.

### MIDI Diagnostic musical projection and report

Focused validation: `pnpm test src/components/midi/midi-diagnostic-capture.test.ts src/components/midi/midi-diagnostic-message.test.ts src/components/midi/midi-diagnostic-musical.test.ts src/components/midi/midi-diagnostic-report.test.ts src/components/midi/midi-diagnostic.test.tsx`.

Coverage includes both release encodings/velocities, precise duration, repeated and overlapping notes (FIFO plus ambiguity), independent pitches/channels/inputs, missing endpoints, continuity across pause/resume and disconnect/reconnect, malformed/invalid payloads, nonfinite/backward timestamps, CC64 thresholds and repeated/intermediate values, arbitrary CC, pressure/program/pitch bend/system messages, ordinary F8/FE hiding with raw preservation, background counters after eviction, partial-evidence warnings, deterministic reports, immutable raw evidence, view-only switching, and stable clipboard fallback/retry.

Manual Yamaha check: play and release C4 softly, then firmly; inspect separate velocities and held durations. Repeat with simultaneous notes and same-pitch overlaps, operate sustain, and verify key-release duration is unaffected by pedal state. Switch to Raw MIDI and confirm F8/FE bytes remain. Pause with a pending note, resume and release, then repeat across device disconnect/reconnect: neither case should be paired across the gap. Send enough background messages to overflow the ring and verify prominent partial-evidence warnings. Deny clipboard access, receive more MIDI, and ensure the selected fallback stays unchanged until retry. Check keyboard operation, details, horizontal scrolling, and tablet/mobile layouts. No AI or provider calls are needed.
