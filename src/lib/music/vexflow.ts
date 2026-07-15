import type { TargetNote } from "@/types/practice";

type VexFlowAccidental = "#" | "b";

export type VexFlowPitch = Readonly<{
  accidental: VexFlowAccidental | null;
  key: string;
}>;

export function toVexFlowPitch(targetNote: TargetNote): VexFlowPitch {
  const normalizedName = targetNote.name
    .replace("♯", "#")
    .replace("♭", "b")
    .toLowerCase();

  const accidental = normalizedName.includes("#")
    ? "#"
    : normalizedName.includes("b")
      ? "b"
      : null;

  return {
    accidental,
    key: `${normalizedName}/${targetNote.octave}`,
  };
}
