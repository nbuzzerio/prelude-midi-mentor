import { getIntervalLabel, MUSICAL_INTERVALS, type IntervalDirection, type MusicalInterval } from "@/lib/music/intervals";

type Props = Readonly<{
  enabledDirections: ReadonlySet<IntervalDirection>;
  enabledIntervals: ReadonlySet<MusicalInterval>;
  onDirectionToggle: (direction: IntervalDirection) => void;
  onIntervalToggle: (interval: MusicalInterval) => void;
  onReset?: () => void;
}>;

export default function EarTrainingControls(props: Props) {
  return <section aria-label="Ear Training settings" className="rounded-xl border border-white/10 bg-white/5 p-4">
    <h2 className="font-semibold">Intervals</h2>
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {MUSICAL_INTERVALS.map((interval) => <label key={interval} className="flex gap-2 text-sm"><input checked={props.enabledIntervals.has(interval)} onChange={() => props.onIntervalToggle(interval)} type="checkbox" />{getIntervalLabel(interval)}</label>)}
    </div>
    <h2 className="mt-4 font-semibold">Direction</h2>
    <div className="mt-2 flex gap-4">
      {(["ascending", "descending"] as const).map((direction) => <label key={direction} className="flex gap-2 text-sm capitalize"><input checked={props.enabledDirections.has(direction)} onChange={() => props.onDirectionToggle(direction)} type="checkbox" />{direction}</label>)}
    </div>
    {props.onReset && <button className="mt-4 rounded bg-zinc-800 px-3 py-2" onClick={props.onReset} type="button">Reset Session</button>}
  </section>;
}
