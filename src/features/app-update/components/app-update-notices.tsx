import { useLayoutEffect, useRef } from "react";
import type { PwaUpdateController } from "@/lib/pwa/register-service-worker";
import { APP_UPDATES, type AppUpdate } from "../app-updates";
import { browserAppUpdateStorage, type AppUpdateStorage } from "../app-update-storage";
import { useAppUpdate } from "../use-app-update";
import { WhatsNewModal } from "./whats-new-modal";

export function AppUpdateNotices({ controller, updates = APP_UPDATES, storage = browserAppUpdateStorage() }: Readonly<{ controller?: PwaUpdateController; updates?: readonly AppUpdate[]; storage?: AppUpdateStorage | null }>) {
  const update = useAppUpdate(controller, updates, storage);
  const indicator = useRef<HTMLButtonElement>(null);
  const reload = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef(false);
  useLayoutEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (update.deferred ? indicator : reload).current?.focus();
  }, [update.deferred]);
  return <>
    {update.pwa.available && <aside aria-label="Prelude update" className="fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[100] max-w-[calc(100vw_-_1.5rem)] rounded-xl border border-sky-300/40 bg-zinc-900 p-3 text-zinc-100 shadow-xl print:hidden">
      {update.deferred ? <button className="min-h-11 rounded border border-sky-300/40 px-3" onClick={() => { moveFocus.current = true; update.expand(); }} ref={indicator} type="button">Update ready</button> : <>
        <p role="status" className="font-semibold">Prelude update ready</p>
        <p className="mt-1 max-w-xs text-sm text-zinc-300">Reload when you're ready. Your current page will stay open until you choose.</p>
        <div className="mt-3 flex flex-wrap gap-2"><button className="min-h-11 rounded bg-sky-500 px-4 font-semibold disabled:opacity-40" disabled={update.pwa.updating} onClick={() => { void update.reload(); }} ref={reload} type="button">{update.pwa.updating ? "Updating…" : "Reload"}</button><button className="min-h-11 rounded border border-zinc-600 px-4" onClick={() => { moveFocus.current = true; update.defer(); }} type="button">Later</button></div>
      </>}
      {update.pwa.error && <p className="mt-2 max-w-xs text-sm text-amber-200" role="alert">{update.pwa.error}</p>}
    </aside>}
    {update.displayed.length > 0 && <WhatsNewModal onAcknowledge={update.acknowledge} updates={update.displayed} />}
  </>;
}
