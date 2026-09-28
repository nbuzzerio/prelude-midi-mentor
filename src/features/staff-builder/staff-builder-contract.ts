/** Portable score capabilities. Parsing and musical validation remain authoritative. */
export const STAFF_BUILDER_SCORE_SCHEMA_VERSION = 4;
export const STAFF_BUILDER_STAFFS = ["treble", "bass"] as const;
export const STAFF_BUILDER_PITCH_LETTERS = ["A", "B", "C", "D", "E", "F", "G"] as const;
export const STAFF_BUILDER_ACCIDENTALS = ["flat", "natural", "sharp"] as const;
export const STAFF_BUILDER_ARPEGGIATIONS = ["up"] as const;
export const STAFF_BUILDER_EVENT_KINDS = { notes: "notes", rest: "rest" } as const;
export const STAFF_BUILDER_RHYTHM_KINDS = { unresolved: "unresolved", final: "final" } as const;
export const STAFF_BUILDER_ANNOTATION_KINDS = { studyNote: "study-note", lyricCue: "lyric-cue", practiceMark: "practice-mark", bookmark: "bookmark" } as const;
export const STAFF_BUILDER_ANCHOR_KINDS = { event: "event", measure: "measure" } as const;
export const STAFF_BUILDER_PRACTICE_MARK_CATEGORIES = ["needs-work", "rhythm", "hands-separate", "check-fingering", "other"] as const;
export const STAFF_BUILDER_BOOKMARK_CATEGORIES = ["interesting", "needs-work", "question", "revisit"] as const;

// These explain existing parser rules, not additional validation requirements.
export const STAFF_BUILDER_IMPORT_RULES = {
  identity: "IDs are strings with nonempty trimmed content; UUIDs are not required. Measure IDs, event IDs across the score, tie IDs, and annotation IDs are independently unique. Pitch IDs and MIDI numbers are unique within each notes event, not necessarily across events.",
  timestamps: "createdAt and updatedAt must be exact UTC ISO strings matching Date.toISOString(), for example 2026-01-01T00:00:00.000Z. No timestamp ordering is enforced.",
  pitch: "midiNumber is an integer 0–127; octave is any integer. Import does not check spelling/MIDI consistency or constrain octave further. Authors should keep MIDI and spelling consistent: C4 is MIDI 60; naturals C,D,E,F,G,A,B have pitch classes 0,2,4,5,7,9,11, with flat=-1 and sharp=+1; MIDI = 12*(octave+1)+pitch class+accidental adjustment. Key signatures do not implicitly change a stored pitch.",
  unknownFields: "Unknown fields are generally discarded when canonicalizing, not preserved. Exception: clefChanges rejects unknown staff keys or unsupported clef values; an empty clefChanges object is omitted. Explicit redundant assignments are preserved. Do not depend on unknown fields surviving import/export.",
  ties: "Import checks tie field shapes and unique tie IDs, but does not resolve tie endpoints or validate their musical meaning. Musical validation does those checks separately.",
  annotations: "Annotation anchors must reference an existing event or measure. study-note text must have nonempty trimmed content (stored text is preserved). lyric-cue requires an event anchor to a notes event on semantic staff treble regardless of display clef, trimmed nonempty text of at most 60 characters, and at most one cue per event. practice-mark text is optional and may be any string except category other requires nonempty trimmed content. bookmark has no text field.",
  size: "The portable piece importer imposes no explicit file-size, measure-count, event-count, title-length, or study-note-length limit. Do not infer unlimited practical browser capacity from that absence.",
} as const;
