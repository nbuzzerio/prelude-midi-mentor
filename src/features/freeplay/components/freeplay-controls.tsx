import type {
  FreeplayChromaticPreference,
  FreeplayNotationContext,
} from "../freeplay-notation";
import {
  MUSIC_KEYS,
  type MusicKeyId,
  type MusicKeyMode,
} from "@/lib/music/keys";

type FreeplayControlsProps = Readonly<{
  chromaticPreference: FreeplayChromaticPreference;
  onChromaticPreferenceChange: (
    preference: FreeplayChromaticPreference,
  ) => void;
  onNotationContextChange: (context: FreeplayNotationContext) => void;
  notationContext: FreeplayNotationContext;
}>;

const KEY_GROUPS: ReadonlyArray<
  Readonly<{ label: string; mode: MusicKeyMode }>
> = [
  { label: "Major", mode: "major" },
  { label: "Minor", mode: "minor" },
];

const CHROMATIC_PREFERENCES: ReadonlyArray<
  Readonly<{ label: string; value: FreeplayChromaticPreference }>
> = [
  { label: "Automatic", value: "automatic" },
  { label: "Prefer sharps", value: "prefer-sharps" },
  { label: "Prefer flats", value: "prefer-flats" },
];

const SELECT_CLASS_NAME =
  "min-h-11 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-base font-semibold text-white focus:border-sky-400 focus:outline-none sm:text-sm";

export default function FreeplayControls({
  chromaticPreference,
  onChromaticPreferenceChange,
  onNotationContextChange,
  notationContext,
}: FreeplayControlsProps) {
  return (
    <section
      aria-label="Free Play notation settings"
      className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-2"
    >
      <label className="grid gap-1.5 text-sm font-semibold text-white/70">
        Key
        <select
          aria-label="Key"
          className={SELECT_CLASS_NAME}
          onChange={(event) => {
            const value = event.target.value;

            onNotationContextChange(
              value === "no-key"
                ? { type: "no-key" }
                : { type: "key", keyId: value as MusicKeyId },
            );
          }}
          value={
            notationContext.type === "no-key"
              ? "no-key"
              : notationContext.keyId
          }
        >
          <option value="no-key">No Key</option>

          {KEY_GROUPS.map((group) => (
            <optgroup key={group.mode} label={group.label}>
              {MUSIC_KEYS.filter((key) => key.mode === group.mode).map((key) => (
                <option key={key.id} value={key.id}>
                  {key.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-semibold text-white/70">
        Chromatic spelling
        <select
          aria-label="Chromatic spelling preference"
          className={SELECT_CLASS_NAME}
          onChange={(event) => {
            onChromaticPreferenceChange(
              event.target.value as FreeplayChromaticPreference,
            );
          }}
          value={chromaticPreference}
        >
          {CHROMATIC_PREFERENCES.map((preference) => (
            <option key={preference.value} value={preference.value}>
              {preference.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
