import {
  DEFAULT_CHROMATIC_SPELLING_PREFERENCE,
  DEFAULT_KEY_AWARE_NOTATION_CONTEXT,
  spellKeyAwareMidiNumber,
  spellKeyAwareMidiNumbers,
  type ChromaticSpellingPreference,
  type KeyAwareNotationContext,
} from "@/lib/music/key-aware-spelling";

export type FreeplayNotationContext = KeyAwareNotationContext;
export type FreeplayChromaticPreference = ChromaticSpellingPreference;
export const DEFAULT_FREEPLAY_NOTATION_CONTEXT = DEFAULT_KEY_AWARE_NOTATION_CONTEXT;
export const DEFAULT_FREEPLAY_CHROMATIC_PREFERENCE = DEFAULT_CHROMATIC_SPELLING_PREFERENCE;
export const spellFreeplayMidiNumber = spellKeyAwareMidiNumber;
export const spellFreeplayMidiNumbers = spellKeyAwareMidiNumbers;
