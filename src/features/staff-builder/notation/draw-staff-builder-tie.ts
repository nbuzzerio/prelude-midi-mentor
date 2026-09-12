import { Renderer, StaveTie, type StemmableNote } from "vexflow";

export function drawStaffBuilderTie(
  context: ReturnType<Renderer["getContext"]>,
  firstNote: StemmableNote | null,
  lastNote: StemmableNote | null,
  firstPitchIndex: number,
  lastPitchIndex: number,
): void {
  new StaveTie({
    firstNote,
    lastNote,
    firstIndexes: [firstPitchIndex],
    lastIndexes: [lastPitchIndex],
  }).setContext(context).draw();
}
