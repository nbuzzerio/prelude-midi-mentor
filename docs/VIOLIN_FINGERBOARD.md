# Advisory violin first-position guide — pending 2.9.6

The violin-only Piece Practice companion shows four continuous strings, nut at top and bridge at bottom, G/D/A/E left to right. It appears after calibration entry, alongside notation at 1200 CSS pixels and wider, and stacks on narrower screens. It never owns microphone input, recording, calibration, grading or persistence. The large Expected/Actual fields and accepted-pitch acknowledgment retain their existing behavior.

The owner supplied this beginner mapping from [Violin Lounge's first-position notes](https://www.violinlounge.com/article/all-violin-notes-in-the-first-position-for-beginners/) and [first-position explanation](https://www.violinlounge.com/blog/violin-first-position-explained-with-finger-charts-notes-and-videos). No additional reference access was used in this implementation.

| Offset / suggested finger | G (55) | D (62) | A (69) | E (76) |
| --- | --- | --- | --- | --- |
| 0 / Open | G3 | D4 | A4 | E5 |
| 1 / Low 1 | G♯3 | D♯4 / E♭4 | A♯4 / B♭4 | F5 |
| 2 / 1 | A3 | E4 | B4 | F♯5 |
| 3 / Low 2 | A♯3 / B♭3 | F4 | C5 | G5 |
| 4 / High 2 | B3 | F♯4 | C♯5 | G♯5 |
| 5 / 3 | C4 | G4 | D5 | A5 |
| 6 / High 3 | C♯4 | G♯4 | D♯5 / E♭5 | A♯5 / B♭5 |
| 7 / 4 | D4 | A4 | E5 | B5 |

These are common first-position recommendations, not universal mandates. Automatic selection prefers an open string over fourth finger. D4 can be open D or fourth finger G; A4 open A or fourth finger D; E5 open E or fourth finger A. The selector and supported-location buttons override this assumption and retain it as the target changes. An impossible selected-string target gets an explicit message and no expected marker; it is never silently remapped. Only the supplied offsets 0–7 are modeled. No extensions, higher positions or bowing instructions are inferred.

Optional stickers use the current target's authored spelling when available, then the current measure key signature through the existing Piece Practice formatter. They display one context-appropriate spelling, not both names of every enharmonic pitch. Labels are concert pitch, A4 = 440 Hz, equal temperament; calibration does not shift the chart.

Expected locations use a diamond; live possible locations use a dashed circle with separate text. A current reading must satisfy the existing large pitch-panel predicate: listening capture, stable/fresh pitch and a nonnegative age no greater than 120 ms. The diagram never substitutes last graded attempts or retained readings as live input. Uncertain, stale, absent, unsupported and out-of-analysis-range readings have no live position. A live frequency below its assumed open string cannot produce a modeled stopped position.

Pitch alone cannot identify the player's actual string, finger or physical contact point. A presentation-only conservative warning suppresses frequencies near target-relative octave, third-harmonic or two-octave relationships (within 35 cents), including inverse ratios. Those readings could also be real different notes; this is a warning, not harmonic classification or octave correction. Other harmonic/octave errors can remain undetected. The pitch panels and grader continue to show/use their own unchanged evidence.

For an ideal fixed-tension string, `f/f_open = L/(L-x)`, giving `x/L = 1 - 2^(-n/12)` for semitone offset `n`. The diagram uses this fraction from nut toward bridge; live frequency yields a continuous offset. Spacing narrows toward the bridge. It is a schematic, not measured millimeter placement, an instrument setup measurement or individual calibration.

Acceptance continues to mean existing pitch/attack acceptance, never successful written duration. Confirmed calibration and Last graded attempt remain separately labeled in their existing presentations. The guide adds no second acknowledgment and does not influence progression.

The shared immutable instrument pitch context is suitable for a later ocarina presentation. No ocarina panel exists yet: the suspected Huazzzyi ZO-1 12-hole Alto C requires its actual manufacturer-specific chart and owner verification. Physical violin, screen-reader and device/zoom QA remain required; automated pitch/recorder fakes do not establish physical fingering accuracy or audio fidelity.
