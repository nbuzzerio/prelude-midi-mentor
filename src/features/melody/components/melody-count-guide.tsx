import { MELODY_PHASE_ONE_METER } from "../melody-meter";
import { getMelodyPreparatoryLeadIn } from "../melody-preparatory-lead-in";

export function MelodyCountGuide({ measureCount, activeAbsoluteTick, showPreparatoryLeadIn = false }: Readonly<{ measureCount: 1 | 2; activeAbsoluteTick?: number; showPreparatoryLeadIn?: boolean }>) {
  const leadIn = getMelodyPreparatoryLeadIn(MELODY_PHASE_ONE_METER.timeSignature);
  return <div aria-label={showPreparatoryLeadIn ? "Preparatory lead-in and count guide" : "Count guide"} className="melody-count-guide grid gap-3" style={{ gridTemplateColumns: showPreparatoryLeadIn ? `minmax(8rem, 0.5fr) repeat(${measureCount}, minmax(0, 1fr))` : `repeat(${measureCount}, minmax(0, 1fr))` }}>
    {showPreparatoryLeadIn && <div aria-label="Preparatory lead-in" className="grid text-center text-sm text-zinc-400" style={{ gridTemplateColumns: `repeat(${leadIn.pulseCount}, minmax(0, 1fr))` }}>
      {Array.from({ length: leadIn.pulseCount }, (_, pulseIndex) => {
        const tick = -leadIn.durationTicks + pulseIndex * leadIn.pulseTicks;
        return <span aria-current={activeAbsoluteTick !== undefined && activeAbsoluteTick >= tick && activeAbsoluteTick < tick + leadIn.pulseTicks ? "true" : undefined} data-preparatory-tick={tick} key={tick}>{pulseIndex + 1}</span>;
      })}
    </div>}
    {Array.from({ length: measureCount }, (_, measureIndex) => <div className="grid grid-cols-8 text-center text-sm text-zinc-400" key={measureIndex}>
      {MELODY_PHASE_ONE_METER.countTokens.map(({ label, tick }) => {
        const absoluteTick = measureIndex * MELODY_PHASE_ONE_METER.capacityTicks + tick;
        return <span aria-current={activeAbsoluteTick !== undefined && activeAbsoluteTick >= absoluteTick && activeAbsoluteTick < absoluteTick + MELODY_PHASE_ONE_METER.subdivisionTicks ? "true" : undefined} data-tick={absoluteTick} key={tick}>{label}</span>;
      })}
    </div>)}
  </div>;
}
