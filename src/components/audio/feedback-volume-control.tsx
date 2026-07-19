import { useState } from "react";
import { getFeedbackVolume, setFeedbackVolume } from "@/lib/audio/feedback";

export default function FeedbackVolumeControl() {
  const [volumePercent, setVolumePercent] = useState(() =>
    Math.round(getFeedbackVolume() * 100),
  );

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextVolumePercent = Number(event.target.value);

    setVolumePercent(nextVolumePercent);
    setFeedbackVolume(nextVolumePercent / 100);
  };

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-4">
        <label
          className="text-sm font-semibold text-white"
          htmlFor="feedback-volume"
        >
          Feedback volume
        </label>

        <span className="text-sm tabular-nums text-white/60">
          {volumePercent}%
        </span>
      </div>

      <input
        className="mt-3 w-full cursor-pointer"
        id="feedback-volume"
        max="100"
        min="0"
        onChange={handleVolumeChange}
        step="1"
        type="range"
        value={volumePercent}
      />

      <p className="mt-2 text-xs text-white/50">
        Set to 0% to mute answer sounds.
      </p>
    </section>
  );
}
