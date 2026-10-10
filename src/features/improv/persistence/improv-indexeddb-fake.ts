// Test-only subset: serialized transactions, request events, structured-clone isolation and rollback.
// This is not evidence of a real browser's quota, scheduling or disk durability behavior.
type Key = IDBValidKey;
type Schema = { keyPath: string | string[]; indexes: Map<string, { keyPath: string | string[]; unique: boolean }> };
type Table = Map<string, { key: Key; value: unknown }>;
type Data = { version: number; schemas: Map<string, Schema>; tables: Map<string, Table>; queue: FakeTransaction[]; busy: boolean };
type Request = { result: unknown; error: DOMException | null; onsuccess: (() => void) | null; onerror: (() => void) | null };
const request = (): Request => ({ result: undefined, error: null, onsuccess: null, onerror: null });
const keyOf = (value: unknown, path: string | string[]): Key => Array.isArray(path)
  ? path.map((name) => Reflect.get(value as object, name)) as Key : Reflect.get(value as object, path) as Key;
const encoded = (key: Key) => JSON.stringify(key); // Keys only; evidence always uses structuredClone.
function compare(a: Key, b: Key): number {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) { const result = compare(a[i], b[i]); if (result) return result; }
    return a.length - b.length;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}
class FakeTransaction {
  oncomplete: (() => void) | null = null;
  onabort: (() => void) | null = null;
  onerror: (() => void) | null = null;
  error: DOMException | null = null;
  private jobs: (() => void)[] = [];
  private working: Map<string, Table> | null = null;
  private active = false;
  private ended = false;
  constructor(private data: Data, private mode: IDBTransactionMode, private factory: FakeImprovIndexedDb) {
    data.queue.push(this); queueMicrotask(() => this.nextTransaction());
  }
  private nextTransaction() {
    if (this.data.busy || !this.data.queue.length) return;
    const next = this.data.queue[0]; this.data.busy = true;
    next.working = structuredClone(next.data.tables); next.active = true; next.pump();
  }
  private retire() { this.data.queue.shift(); this.data.busy = false; this.nextTransaction(); }
  abort() {
    if (this.ended) throw new DOMException("Inactive transaction", "InvalidStateError");
    this.ended = true; this.error ??= new DOMException("Aborted", "AbortError");
    queueMicrotask(() => { this.onabort?.(); this.retire(); });
  }
  private pump() {
    if (this.ended || !this.active) return;
    queueMicrotask(() => {
      if (this.ended) return;
      const job = this.jobs.shift();
      if (job) { job(); this.pump(); return; }
      const commit = () => {
        if (this.ended) return;
        const error = this.mode === "readwrite" ? this.factory.commitError : null;
        if (error) { this.factory.commitError = null; this.error = new DOMException("Injected commit failure", error); this.abort(); return; }
        if (this.mode === "readwrite") this.data.tables = this.working!;
        this.ended = true; this.oncomplete?.(); this.retire();
      };
      if (this.mode === "readwrite" && this.factory.commitHold) {
        const hold = this.factory.commitHold; this.factory.commitHold = null; hold(commit);
      } else commit();
    });
  }
  private enqueue(store: string, method: string, action: () => unknown): IDBRequest {
    if (this.ended) throw new DOMException("Inactive", "TransactionInactiveError");
    const req = request();
    this.jobs.push(() => {
      try {
        if (this.factory.requestError?.store === store && this.factory.requestError.method === method) {
          const name = this.factory.requestError.name; this.factory.requestError = null; throw new DOMException("Injected request failure", name);
        }
        req.result = structuredClone(action()); req.onsuccess?.();
      } catch (error) {
        req.error = error instanceof DOMException ? error : new DOMException(String(error), "DataError");
        this.error = req.error; req.onerror?.(); this.onerror?.(); if (!this.ended) this.abort();
      }
    });
    return req as unknown as IDBRequest;
  }
  objectStore(name: string): IDBObjectStore {
    const schema = this.data.schemas.get(name); if (!schema) throw new DOMException("Missing store", "NotFoundError");
    const table = () => this.working!.get(name)!;
    const all = (query?: Key | null, count?: number, indexPath?: string | string[]) => [...table().values()]
      .filter(({ value, key }) => query == null || encoded(indexPath ? keyOf(value, indexPath) : key) === encoded(query))
      .sort((a, b) => compare(a.key, b.key)).slice(0, count).map(({ value }) => value);
    const write = (value: unknown, add: boolean) => {
      if (this.mode !== "readwrite") throw new DOMException("Readonly", "ReadOnlyError");
      const key = keyOf(value, schema.keyPath);
      if (add && table().has(encoded(key))) throw new DOMException("Duplicate", "ConstraintError");
      for (const index of schema.indexes.values()) {
        if (index.unique && [...table().values()].some((entry) => encoded(entry.key) !== encoded(key)
          && encoded(keyOf(entry.value, index.keyPath)) === encoded(keyOf(value, index.keyPath)))) throw new DOMException("Duplicate index", "ConstraintError");
      }
      table().set(encoded(key), { key, value: structuredClone(value) }); return key;
    };
    return {
      indexNames: { contains: (index: string) => schema.indexes.has(index) },
      get: (key: Key) => this.enqueue(name, "get", () => table().get(encoded(key))?.value),
      getAll: (query?: Key, count?: number) => this.enqueue(name, "getAll", () => all(query, count)),
      count: () => this.enqueue(name, "count", () => table().size),
      add: (value: unknown) => { const copy = structuredClone(value); return this.enqueue(name, "add", () => write(copy, true)); },
      put: (value: unknown) => { const copy = structuredClone(value); return this.enqueue(name, "put", () => write(copy, false)); },
      delete: (key: Key) => this.enqueue(name, "delete", () => { table().delete(encoded(key)); return undefined; }),
      index: (index: string) => {
        const definition = schema.indexes.get(index); if (!definition) throw new DOMException("Missing index", "NotFoundError");
        return { getAll: (query?: Key, count?: number) => this.enqueue(name, "getAll", () => all(query, count, definition.keyPath)) };
      },
    } as unknown as IDBObjectStore;
  }
}
export class FakeImprovIndexedDb {
  databases = new Map<string, Data>();
  openedNames: string[] = [];
  commitError: string | null = null;
  requestError: { store: string; method: string; name: string } | null = null;
  commitHold: ((commit: () => void) => void) | null = null;
  openError: string | null = null;
  blocked = false;
  holdNextCommit() {
    let release: (() => void) | null = null;
    this.commitHold = (commit) => { release = commit; };
    return { release: () => { if (!release) throw Error("Commit has not arrived"); release(); }, ready: () => release !== null };
  }
  set(store: string, key: Key, value: unknown, name = "prelude-improv") {
    this.databases.get(name)!.tables.get(store)!.set(encoded(key), { key, value: structuredClone(value) });
  }
  get(store: string, key: Key, name = "prelude-improv"): unknown {
    return structuredClone(this.databases.get(name)?.tables.get(store)?.get(encoded(key))?.value);
  }
  readonly factory = { open: (name: string, version: number) => {
    this.openedNames.push(name);
    const req = Object.assign(request(), { onupgradeneeded: null as (() => void) | null, onblocked: null as (() => void) | null });
    queueMicrotask(() => {
      if (this.blocked) { req.onblocked?.(); return; }
      if (this.openError) { req.error = new DOMException("Injected open failure", this.openError); this.openError = null; req.onerror?.(); return; }
      let data = this.databases.get(name); const upgrade = !data;
      if (data && data.version > version) { req.error = new DOMException("Newer DB", "VersionError"); req.onerror?.(); return; }
      if (!data) { data = { version, schemas: new Map(), tables: new Map(), queue: [], busy: false }; this.databases.set(name, data); }
      const current = data; let closed = false;
      req.result = {
        objectStoreNames: { contains: (store: string) => current.schemas.has(store) },
        createObjectStore: (store: string, options: { keyPath: string | string[] }) => {
          const schema: Schema = { keyPath: options.keyPath, indexes: new Map() };
          current.schemas.set(store, schema); current.tables.set(store, new Map());
          return { createIndex: (index: string, path: string | string[], config?: { unique?: boolean }) => schema.indexes.set(index, { keyPath: path, unique: config?.unique ?? false }) };
        },
        transaction: (_stores: string[], mode: IDBTransactionMode = "readonly") => {
          if (closed) throw new DOMException("Closed", "InvalidStateError"); return new FakeTransaction(current, mode, this);
        },
        close: () => { closed = true; }, onversionchange: null,
      };
      if (upgrade) req.onupgradeneeded?.(); req.onsuccess?.();
    });
    return req;
  } } as unknown as IDBFactory;
}
