import { useEffect, useRef, useState } from "react";
import { parsePiecePracticeRun, type PiecePracticeRunRecordV2, type PiecePracticeRunStore } from "../persistence/piece-practice-runs";
import { prescriptionKey, stable } from "./rolodex-model";
import { RolodexEditor, rolodexButton } from "./rolodex-editor";
import { rolodexStore } from "./rolodex-store";
import { rolodexSuggestions } from "./rolodex-suggestions";
import type { RolodexEntry, RolodexStore } from "./rolodex-types";

/** Mounted only after completion storage acknowledgement; read back the exact revision. */
export function PostPracticeRecommendations({ run, runStore, store = rolodexStore }: Readonly<{
  run: PiecePracticeRunRecordV2; runStore: PiecePracticeRunStore; store?: RolodexStore;
}>) {
  const [offers, setOffers] = useState<readonly RolodexEntry[] | null>(null);
  const [editor, setEditor] = useState<RolodexEntry | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [hidden, setHidden] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([runStore.list(), store.list()]).then(([records, listing]) => {
      const retained = records.find(raw => {
        const parsed = parsePiecePracticeRun(raw);
        return parsed.ok && parsed.record.status === "completed" && stable(parsed.record) === stable(run);
      });
      if (!retained || listing.unavailableCount) throw Error("Evidence unavailable");
      if (active) setOffers(rolodexSuggestions([retained], listing.entries));
    }).catch(() => { if (active) setError("Recommendations are unavailable because the saved result or Rolodex could not be verified. Your completed results remain available."); });
    return () => { active = false; };
  }, [run, runStore, store]);
  const returnToOffers = () => { setEditor(null); requestAnimationFrame(() => heading.current?.focus()); };
  return <section aria-label="Recommended next practice" className="grid min-w-0 gap-3 rounded-xl border border-zinc-600 p-4">
    <h2 className="text-xl font-bold" ref={heading} tabIndex={-1}>Recommended next practice</h2>
    <p>From this saved pitch-first session: review problem measures next. Priority follows mistakes, skipped targets, restarts, then recorded slow responses. These signals are not an ability score.</p>
    <p>No passage is saved automatically. Your completed results stay below.</p>
    {error && <p role="alert">{error}</p>}
    <p role="status">{notice}</p>
    {!offers && !error && <p role="status">Checking saved evidence…</p>}
    {editor ? <RolodexEditor entry={editor} runStore={runStore} store={store} onCancel={returnToOffers} onSaved={result => {
      setOffers(previous => previous?.filter(entry => prescriptionKey(entry) !== prescriptionKey(editor)) ?? []);
      setNotice(result.duplicate ? "This passage is already in Rolodex. Your results are unchanged." : "Passage saved to Rolodex. Your results are unchanged.");
      returnToOffers();
    }} /> : <>
      <button className={rolodexButton} ref={opener} type="button" onClick={() => { setHidden(value => !value); }}>{hidden ? "Review recommendations" : "Return to results"}</button>
      {!hidden && offers?.length === 0 && <p>No remaining recommendations with retained evidence. Measures may already be saved or declined for this results visit.</p>}
      {!hidden && <ul className="grid min-w-0 gap-3">{offers?.map(entry => <li className="grid min-w-0 gap-2 break-words" key={entry.id}>
        <h3 className="font-semibold">Measure {entry.start + 1}</h3>
        <p>Evidence: {entry.evidence?.reasons}.</p>
        <p className="text-sm">Saved session {entry.evidence?.runId}. Skips and restarts are process signals; slow responses are recorded timing evidence.</p>
        <div className="flex flex-wrap gap-2"><button className={rolodexButton} type="button" onClick={() => setEditor(entry)}>Inspect measure {entry.start + 1} / Save to Rolodex</button>
          <button className={rolodexButton} type="button" onClick={() => {
            setOffers(previous => previous?.filter(candidate => candidate.id !== entry.id) ?? []);
            setNotice("Recommendation declined for this results visit. Nothing was saved."); heading.current?.focus();
          }}>Decline measure {entry.start + 1}</button></div>
      </li>)}</ul>}
    </>}
  </section>;
}
