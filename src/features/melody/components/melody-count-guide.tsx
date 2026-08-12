import { MELODY_PHASE_ONE_METER } from "../melody-meter";

export function MelodyCountGuide({ measureCount, activeAbsoluteTick }: Readonly<{ measureCount: 1 | 2; activeAbsoluteTick?: number }>) {
  return <div aria-label="Count guide" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${measureCount}, minmax(20rem, 1fr))` }}>
    {Array.from({ length: measureCount }, (_, measureIndex) => <div className="grid grid-cols-8 text-center text-sm text-zinc-400" key={measureIndex}>
      {MELODY_PHASE_ONE_METER.countTokens.map(({ label, tick }) => {
        const absoluteTick = measureIndex * MELODY_PHASE_ONE_METER.capacityTicks + tick;
        return <span aria-current={activeAbsoluteTick !== undefined && activeAbsoluteTick >= absoluteTick && activeAbsoluteTick < absoluteTick + MELODY_PHASE_ONE_METER.subdivisionTicks ? "true" : undefined} data-tick={absoluteTick} key={tick}>{label}</span>;
      })}
    </div>)}
  </div>;
}
