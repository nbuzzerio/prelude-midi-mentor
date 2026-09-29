# MIDI Notes

Quick reference for common MIDI values used during development.

## Note Numbers

Middle C = C4 = 60

C4 = 60
C♯4 = 61
D4 = 62
D♯4 = 63
E4 = 64
F4 = 65
F♯4 = 66
G4 = 67
G♯4 = 68
A4 = 69
A♯4 = 70
B4 = 71
C5 = 72

## Velocity

0–127

- 0 is commonly used as Note Off.
- Higher values generally represent stronger key presses.

## MIDI Messages

Note On
Note Off

This file is intentionally kept as a quick development reference rather than a complete MIDI specification.

## Physical release evidence and Piece Practice

- Conventional Note Off (`0x8n`) and Note On velocity zero (`0x9n`) both remove the MIDI pitch from the physical held Set. Optional release observations preserve `note-off` versus `note-on-zero` encoding. Only conventional Note Off supplies a release velocity; the zero in the alternative encoding is not a measured release velocity.
- Finite browser `MIDIMessageEvent.timeStamp` values can accompany attack and release evidence as optional source timing, separately from Piece Practice active-session occurrence time. No quantization or note-instance pairing is performed.
- Duplicate same-pitch attacks are separate attack/velocity observations, but held state is a Set of pitches across channels/inputs. For C5 On / C5 On / C5 Off / C5 Off, the first Off removes C5 entirely. This known limitation is unchanged.
- CC64 state is separate from physical key-down state. Releasing a key under sustain removes it from physical held grading state; no acoustic sounding-state inference is made.
- Disconnect, teardown, reconnect, and resets may clear held state but never manufacture release observations.
- Piece Practice permits only the immediately preceding successful MIDI target's physical carryover under the named initial 250 ms release-overlap policy, starting from the current target's first attack. Correct singles accept immediately without retrospective failure; old/unrelated held notes and wrong new attacks remain relevant. Block-chord eligibility uses attack evidence, not timer delivery lateness. This is pitch practice, not articulation scoring.
- Human-facing Piece Practice feedback uses musical names such as F5, A5, and D6 (MIDI 77, 81, and 86). Completed results and reports expose numeric values only when `Show MIDI details` is selected. Velocity inclusion remains an independent observational report option.
