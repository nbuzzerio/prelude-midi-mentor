import { useState } from "react";
import {
  getInstrumentVolume,
  setInstrumentVolume,
} from "@/lib/audio/instrument-volume";

type InstrumentVolumeControlProps = Readonly<{
  replayCorrectVirtualChords: boolean;
  onReplayCorrectVirtualChordsChange: (enabled: boolean) => void;
}>;

export default function InstrumentVolumeControl({
  replayCorrectVirtualChords,
  onReplayCorrectVirtualChordsChange,
}: InstrumentVolumeControlProps) {
  const [volumePercent, setVolumePercent] = useState(() =>
    Math.round(getInstrumentVolume() * 100),
  );

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextVolumePercent = Number(event.target.value);

    setVolumePercent(nextVolumePercent);
    setInstrumentVolume(nextVolumePercent / 100);
  };

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-4">
        <label
          className="text-sm font-semibold text-white"
          htmlFor="instrument-volume"
        >
          Instrument volume
        </label>

        <span className="text-sm tabular-nums text-white/60">
          {volumePercent}%
        </span>
      </div>

      <input
        className="mt-3 w-full cursor-pointer"
        id="instrument-volume"
        max="100"
        min="0"
        onChange={handleVolumeChange}
        step="1"
        type="range"
        value={volumePercent}
      />

      <p className="mt-2 text-xs text-white/50">
        Set to 0% to mute piano key sounds.
      </p>

      <label className="mt-4 flex cursor-pointer items-start gap-3 border-t border-white/10 pt-4">
        <input
          checked={replayCorrectVirtualChords}
          className="mt-0.5 size-4 cursor-pointer"
          onChange={(event) => {
            onReplayCorrectVirtualChordsChange(event.target.checked);
          }}
          type="checkbox"
        />

        <span>
          <span className="block text-sm font-semibold text-white">
            Replay completed chords
          </span>

          <span className="mt-1 block text-xs text-white/50">
            Play mouse and touch chords together after a correct answer.
          </span>
        </span>
      </label>
    </section>
  );
}
