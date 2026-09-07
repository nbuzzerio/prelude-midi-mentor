import { useEffect, useId, useRef } from "react";
import { DOUBLE_ACCIDENTAL_REASON, SCALE_REPERTOIRE_GROUPS, getScaleRepertoireEntry, type ScaleRepertoireId } from "../scale-repertoire";

type Props = Readonly<{
  selection: readonly ScaleRepertoireId[];
  onChange: (selection: readonly ScaleRepertoireId[]) => void;
}>;
export default function ScaleRepertoireControls({ selection, onChange }: Props) {
  const reasonId = useId();
  const rows = useRef(new Map<ScaleRepertoireId, HTMLLIElement>());
  const pendingFocus = useRef<ScaleRepertoireId | null>(null);
  useEffect(() => {
    if (pendingFocus.current) rows.current.get(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  }, [selection]);
  const remove = (id: ScaleRepertoireId) => onChange(selection.filter((selected) => selected !== id));
  const move = (index: number, offset: -1 | 1) => {
    const next = [...selection];
    const other = index + offset;
    if (other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other]!, next[index]!];
    pendingFocus.current = selection[index]!;
    onChange(next);
  };
  return <div className="mt-5 space-y-4">
    <p className="text-sm text-white/70">Play each selected scale once: one octave up and back, 15 notes, top tonic once.</p>
    <fieldset>
      <legend className="font-semibold">Repertoire catalog</legend>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {SCALE_REPERTOIRE_GROUPS.map((group) => <div key={group[0]!.id} className="space-y-2 rounded-lg border border-white/10 p-3">
          {group.map((scale) => <label key={scale.id} title={scale.disabledReason} className={`flex min-h-11 items-center gap-2 text-sm ${scale.disabledReason ? "text-white/50" : "text-white"}`}>
            <input type="checkbox" checked={selection.includes(scale.id)} disabled={Boolean(scale.disabledReason)} aria-describedby={scale.disabledReason ? reasonId : undefined}
              onChange={(event) => event.target.checked ? onChange([...selection, scale.id]) : remove(scale.id)} />
            <span>{scale.name}{scale.disabledReason ? " (Coming soon)" : ""}</span>
          </label>)}
        </div>)}
      </div>
      <p id={reasonId} className="mt-2 text-sm text-white/60">{DOUBLE_ACCIDENTAL_REASON}</p>
    </fieldset>
    <section aria-label="Selected repertoire order">
      <h3 className="font-semibold">Selected order</h3>
      {selection.length === 0 ? <p className="mt-2 text-sm text-white/70">Select at least one scale to begin.</p> :
        <ol className="mt-2 space-y-2">
          {selection.map((id, index) => {
            const scale = getScaleRepertoireEntry(id);
            return <li key={id} tabIndex={-1} ref={(node) => { if (node) rows.current.set(id, node); else rows.current.delete(id); }} className="flex flex-wrap items-center gap-2 rounded border border-white/10 p-2 focus:outline-sky-400">
              <span className="mr-auto">{index + 1}. {scale.name}</span>
              <button className="min-h-11 rounded bg-zinc-800 px-2 disabled:opacity-40" type="button" aria-label={`Move ${scale.name} up`} disabled={index === 0} onClick={() => move(index, -1)}>Move Up</button>
              <button className="min-h-11 rounded bg-zinc-800 px-2 disabled:opacity-40" type="button" aria-label={`Move ${scale.name} down`} disabled={index === selection.length - 1} onClick={() => move(index, 1)}>Move Down</button>
              <button className="min-h-11 rounded bg-zinc-800 px-2" type="button" aria-label={`Remove ${scale.name}`} onClick={() => remove(id)}>Remove</button>
            </li>;
          })}
        </ol>}
    </section>
  </div>;
}
