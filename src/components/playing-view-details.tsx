import type { ReactNode } from "react";

/** Disclosure only: children remain mounted, including controlled audio settings. */
export function PlayingViewDetails({ enabled, children }: Readonly<{ enabled: boolean; children: ReactNode }>) {
  return enabled ? <details className="playing-view-details rounded-lg border border-white/10 px-3">
    <summary className="min-h-11 cursor-pointer py-3 text-sm text-zinc-400">Sound and practice details</summary>{children}
  </details> : <>{children}</>;
}
