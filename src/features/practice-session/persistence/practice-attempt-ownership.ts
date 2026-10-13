import type { ProgramAttempt, ProgramHistoryRecord } from "../practice-program-attempt";
import type { IndexedDbPracticeAttempts } from "./practice-attempt-indexeddb";

/** Web Locks are released by the browser on reload/crash. Leases are the conservative fallback. */
export class PracticeAttemptOwnership {
  constructor(private locks?: LockManager | null) {}
  private manager(): LockManager | null { try { return this.locks === undefined ? navigator.locks ?? null : this.locks; } catch { return null; } }
  async acquire(attemptId: string): Promise<(() => void) | null> {
    const locks = this.manager(); if (!locks) return () => {};
    return new Promise((resolve, reject) => {
      void locks.request(`prelude-weekly-attempt:${attemptId}`, { ifAvailable: true }, lock => {
        if (!lock) { resolve(null); return; }
        return new Promise<void>(release => { resolve(release); });
      }).catch(reject);
    });
  }
  async recover(store: Pick<IndexedDbPracticeAttempts, "save" | "list">, programId: string, atMs: number): Promise<readonly ProgramHistoryRecord[]> {
    const rows = await store.list(programId);
    for (const row of rows.filter((value): value is ProgramAttempt => value.kind === "attempt" && !value.closed).slice(0, 100)) {
      if (!this.manager() && row.leaseUntilMs > atMs) continue;
      const release = await this.acquire(row.attemptId); if (!release) continue;
      try {
        const at = new Date(Math.max(atMs, Date.parse(row.updatedAt))).toISOString();
        await store.save({ ...row, outcome: row.outcome === "completed" ? "completed" : "interrupted", closed: true, endedAt: at, updatedAt: at, writeVersion: row.writeVersion + 1, leaseUntilMs: 0 }, row.writeVersion);
      } catch (error) {
        // A writer may have completed between the initial read and lock acquisition.
        if (!(error instanceof Error) || !("reason" in error) || error.reason !== "conflict") throw error;
      } finally { release(); }
    }
    return store.list(programId);
  }
}
