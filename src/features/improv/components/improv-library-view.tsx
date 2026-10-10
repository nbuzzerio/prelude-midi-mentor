import type { ImprovCollection, ImprovDeletedTake, ImprovStoredTake } from "../improv-library";
export const IMPROV_BUTTON = "min-h-11 rounded-lg border border-zinc-600 px-3 py-2 font-semibold text-white disabled:opacity-40";
export const IMPROV_SELECT = "min-h-11 min-w-0 w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-white";

export function ImprovLibraryView({ collection, takes, disabled, onReview, onRecover, onRename, onDeleteTake, onDeleteCollection, onRefresh }: Readonly<{
  collection: ImprovCollection | null; takes: readonly (ImprovStoredTake | ImprovDeletedTake)[]; disabled: boolean;
  onReview: (take: ImprovStoredTake) => void; onRecover: (take: ImprovStoredTake) => void;
  onRename: (title: string) => void; onDeleteTake: (take: ImprovStoredTake) => void; onDeleteCollection: () => void; onRefresh: () => void;
}>) {
  return <details className="rounded-xl border border-white/10 bg-white/5 p-3">
    <summary className="cursor-pointer py-2 font-semibold">Take history and library ({takes.length})</summary>
    <div className="mt-3 grid gap-3">
      <button className={IMPROV_BUTTON} disabled={disabled} onClick={onRefresh}>Refresh library</button>
      {collection && <>
        <p className="text-sm text-zinc-300">{collection.firstTakeId ? takes[0]?.kind === "deleted-take" ? "Original first take: Take 1 (deleted). Later takes keep their numbers." : "Original first take: Take 1." : "No takes yet. The first started capture counts, including empty or interrupted attempts."}</p>
        <form className="flex flex-wrap gap-2" key={collection.collectionId + collection.title} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onRename(String(form.get("title"))); }}>
          <label className="min-w-0 flex-1 text-sm">Collection title<input className={IMPROV_SELECT} defaultValue={collection.title} name="title" maxLength={256} required disabled={disabled} /></label>
          <button className={IMPROV_BUTTON} disabled={disabled}>Rename collection</button>
        </form>
        <ul className="grid gap-2">
          {takes.map((take) => <li className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-900 p-3" key={take.takeId}>
            <span className="min-w-0 flex-1">Take {take.number}{take.number === 1 ? " · Original first attempt" : ""}<span className="block text-sm text-zinc-400">{take.kind === "deleted-take" ? "Deleted" : take.status === "recording" ? "Unfinished capture · saved prefix" : take.status}</span></span>
            {take.kind === "take" && <>
              <button className={IMPROV_BUTTON} disabled={disabled} onClick={() => onReview(take)} aria-label={`Review Take ${take.number}`}>Review</button>
              {take.status === "recording" ? <button className={IMPROV_BUTTON} disabled={disabled} onClick={() => onRecover(take)}>Recover saved prefix</button> : <button className={IMPROV_BUTTON} disabled={disabled} onClick={() => onDeleteTake(take)} aria-label={`Delete Take ${take.number}`}>Delete</button>}
            </>}
          </li>)}
        </ul>
        <button className={`${IMPROV_BUTTON} text-red-200`} disabled={disabled} onClick={onDeleteCollection}>Delete collection</button>
      </>}
      <p className="text-sm text-zinc-400">Stored in this browser. Clearing or eviction can remove takes; keep JSON backups. Prelude never automatically deletes older takes.</p>
    </div>
  </details>;
}
