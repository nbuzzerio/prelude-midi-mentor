import { MUSIC_KEYS } from "@/lib/music/keys";
import * as C from "./staff-builder-contract";
import { DEFAULT_STAFF_BUILDER_CLEFS, STAFF_BUILDER_CLEFS } from "./staff-builder-clefs";
import { STAFF_BUILDER_DURATIONS, STAFF_BUILDER_TIME_SIGNATURES, STAFF_BUILDER_TICKS_PER_QUARTER, durationToTicks, getMeasureCapacityTicks } from "./staff-builder-time";
import { STAFF_BUILDER_AUTHORING_EXAMPLE, STAFF_BUILDER_UNRESOLVED_EXAMPLE } from "./staff-builder-llm-examples";
import { serializeStaffBuilderPiece, STAFF_BUILDER_PIECE_FILE_EXTENSION } from "./persistence/staff-builder-piece-file";

/** Pure, score-independent authoring guide; the importer and musical validator are authoritative. */
export function createStaffBuilderLlmSpecification(): string {
  const values = (items: readonly string[]) => items.map((item) => JSON.stringify(item)).join(", ");
  return `Help me author a Prelude Staff Builder piano score. Use this complete supported portable contract. Ask for missing musical requirements when useful. When producing the final score, return one raw JSON object, without Markdown fences or surrounding prose. Do not invent unsupported fields or notation features.

DOCUMENT
Canonical score schemaVersion: ${C.STAFF_BUILDER_SCORE_SCHEMA_VERSION}. Save as ${STAFF_BUILDER_PIECE_FILE_EXTENSION} and use Piece Library's Import Piece workflow. The file is the score itself, with no format marker, score wrapper, library envelope, or draft envelope. Historical versions 1–3 import and migrate to v4; author new documents as v4. Unsupported versions are rejected.
Required top-level fields: schemaVersion, id, title, createdAt, updatedAt, tempoBpm, initialKeySignatureId, initialTimeSignature, measures, ties, annotations.
title: string with nonempty trimmed content. tempoBpm: integer 40–240, score-wide (no tempo changes). measures: ordered, nonempty array; ties and annotations: arrays, possibly empty. There is no authored measure number/index field: array order establishes measure order, displayed starting at 1.
Keys for initialKeySignatureId and optional keySignatureChange: ${values(MUSIC_KEYS.map(({ id }) => id))}.
Meters for initialTimeSignature and optional timeSignatureChange (capacity in ticks): ${STAFF_BUILDER_TIME_SIGNATURES.map((meter) => `${JSON.stringify(meter)}=${getMeasureCapacityTicks(meter)}`).join(", ")}.

MEASURES AND DISPLAY CONTEXT
Each measure requires id and events (array, possibly empty). Optional: keySignatureChange, timeSignatureChange, clefChanges. Key/meter changes take effect at the start of that measure and carry forward until superseded; omitted fields inherit the initial or previous value.
clefChanges is an optional object whose keys are semantic staff identities ${values(C.STAFF_BUILDER_STAFFS)} and whose values are display clefs ${values(STAFF_BUILDER_CLEFS)}. Both entries are independently optional. Historical initial display: ${Object.entries(DEFAULT_STAFF_BUILDER_CLEFS).map(([staff, clef]) => `${staff} staff -> ${clef} clef`).join("; ")}.
A clef change takes effect at the measure boundary and carries forward until superseded, including across system/range starts. Missing assignment inherits prior context. Explicit redundant assignments are valid and remain canonical. To remove a change, omit that staff entry; an empty object is normalized away. No mid-measure clef changes.
STAFF != CLEF != HAND != VOICE. treble/bass identify the existing upper/lower semantic staffs, not a hand or voice. Clefs change notation/display only; never transpose, respell, change octave/MIDI, reassign staff, or mutate pitch. No other clefs are supported.

EVENTS AND RHYTHM
Event kinds: ${values(Object.values(C.STAFF_BUILDER_EVENT_KINDS))}.
Required common fields: id, kind, staff, startTick, rhythm. staff: ${values(C.STAFF_BUILDER_STAFFS)}. startTick: nonnegative integer relative to the beginning of its measure, not seconds or an absolute piece tick. Preserve intended event order; authored order is accepted without sorting by the parser. Simultaneous equal-duration pitches should be one chord event.
Rhythm statuses: ${values(Object.values(C.STAFF_BUILDER_RHYTHM_KINDS))}. A final rhythm is an object with status final and required duration. An unresolved rhythm is an object with status unresolved and no duration; only notes events can have unresolved rhythm. Rests require final rhythm. No separate dots, tuplets, or duration numbers.
Supported duration values and ticks: ${STAFF_BUILDER_DURATIONS.map((duration) => `${JSON.stringify(duration)}=${durationToTicks(duration)}`).join(", ")}.
There are ${STAFF_BUILDER_TICKS_PER_QUARTER} ticks per quarter note. Musical validation requires starts on the sixteenth-note grid (${STAFF_BUILDER_TICKS_PER_QUARTER / 4} ticks), inside the effective measure, and finalized events ending no later than measure capacity. Fill silent beats with explicit rests on both staffs for practice-ready scores. Import itself accepts unfinished rhythm, gaps, off-grid starts, and overflowing events; these are subsequent musical validation issues.
notes requires pitches: a nonempty array. One pitch is a note; multiple pitches are a chord sharing startTick and rhythm. Each pitch requires id, midiNumber, letter, accidental, octave. Letters: ${values(C.STAFF_BUILDER_PITCH_LETTERS)}. Accidentals: ${values(C.STAFF_BUILDER_ACCIDENTALS)}. No double accidentals.
${C.STAFF_BUILDER_IMPORT_RULES.pitch}
Optional notes arpeggiation values: ${values(C.STAFF_BUILDER_ARPEGGIATIONS)}. Omit it for simultaneous chords. up denotes a rolled/arpeggiated chord from low to high; at least two pitches are required. It is not allowed on rests or single notes. No separate chord kind, roll timing, velocity, dynamics, articulation, or expressive fields are supported. A rest has no pitches or arpeggiation.

TIES
Each tie requires exactly the supported fields id, fromEventId, fromPitchId, toEventId, toPitchId. Pitch IDs identify pitches within the referenced notes events, not a global pitch-name table.
${C.STAFF_BUILDER_IMPORT_RULES.ties}
For practice readiness, endpoints must exist, be on the same semantic staff, and have equal MIDI numbers; the target begins later and exactly when the source ends (absolute ticks accounting for each measure's meter). Only one outgoing and one incoming tie per pitch endpoint; no duplicate connections or cycles. Ties may span measures or clef changes; the display clef does not affect sounding pitch.

STUDY ANNOTATIONS
Kinds: ${values(Object.values(C.STAFF_BUILDER_ANNOTATION_KINDS))}. Every annotation requires id, kind, anchor. Anchor kinds: ${values(Object.values(C.STAFF_BUILDER_ANCHOR_KINDS))}. An event anchor requires eventId; a measure anchor requires measureId.
study-note: required text; event or measure anchor.
lyric-cue: required text; event anchor only, subject to the semantic-staff rule below.
practice-mark: required category (${values(C.STAFF_BUILDER_PRACTICE_MARK_CATEGORIES)}), optional text; event or measure anchor. hands-separate is a study-mark category, not a hand assignment field.
bookmark: required category (${values(C.STAFF_BUILDER_BOOKMARK_CATEGORIES)}); event or measure anchor, no text field.
${C.STAFF_BUILDER_IMPORT_RULES.annotations}

IDENTITY, IMPORT, AND PRACTICE READINESS
${C.STAFF_BUILDER_IMPORT_RULES.identity}
${C.STAFF_BUILDER_IMPORT_RULES.timestamps}
${C.STAFF_BUILDER_IMPORT_RULES.unknownFields}
${C.STAFF_BUILDER_IMPORT_RULES.size}
Malformed required fields, unsupported enum values, duplicate IDs in the stated scopes, and invalid annotation references are rejected. Missing required arrays are not defaulted. Extra fields cannot add supported capabilities.
Import acceptance != practice readiness. Import validates document structure and normalizes supported fields; validateStaffBuilderScore additionally checks unresolved rhythm, grid/capacity, same-position conflicts, coverage gaps, arpeggiation, and tie correctness. At the same staff/startTick, two notes events conflict if they share a MIDI pitch or have equal durations; equal-duration notes belong in one chord. Two rests at the same staff/startTick conflict. A notes event and a rest at the same startTick are not flagged as a same-position conflict. Overlapping different-duration notes may form automatically derived voices; there is no authored voice field. Produce finalized, conflict-free, fully covered staffs and valid ties unless the user explicitly wants unfinished notation. Practice Piece also depends on Prelude's validated/saved editor workflow.
Portable authored annotations belong in this score. Do not include editor pass, cursor, input routing, UI selection, history, library pieces/envelopes, practiceMetadataByPieceId, lastPracticedAt, practice results/evidence, hand/voice assignments, persistent AI/provider metadata, or any runtime state. Do not invent extra staffs, mid-measure clefs, transposition, key/tempo structures, or unsupported notation.

PRACTICE-READY EXAMPLE
Three small measures: a chord, a tied note across a meter/key change, lower-staff upward roll with a display-clef change, then inherited context. The explicit treble assignment in measure 2 is deliberately redundant. All portable annotation kinds and both anchor kinds are shown.
\`\`\`json
${serializeStaffBuilderPiece(STAFF_BUILDER_AUTHORING_EXAMPLE).trimEnd()}
\`\`\`

IMPORTABLE UNFINISHED EXAMPLE (NOT PRACTICE-READY)
Unresolved note rhythm is portable, but requires finalization before practice. Rests still require a final duration.
\`\`\`json
${serializeStaffBuilderPiece(STAFF_BUILDER_UNRESOLVED_EXAMPLE).trimEnd()}
\`\`\`
`;
}
