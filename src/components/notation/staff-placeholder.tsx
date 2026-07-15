import type { TargetNote } from "@/types/practice";

type StaffPlaceholderProps = Readonly<{
  targetNote: TargetNote;
}>;

export default function StaffPlaceholder({
  targetNote,
}: StaffPlaceholderProps) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        {targetNote.clef} clef
      </p>

      <div className="my-6 flex w-full max-w-md flex-col gap-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-px w-full bg-zinc-400" />
        ))}
      </div>

      <p className="text-5xl font-bold text-zinc-900">
        {targetNote.name}
        {targetNote.octave}
      </p>

      <p className="mt-2 text-sm text-zinc-500">Staff notation placeholder</p>
    </div>
  );
}
