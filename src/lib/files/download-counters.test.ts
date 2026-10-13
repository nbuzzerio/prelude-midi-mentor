import { describe, expect, it, vi } from "vitest";
import { DownloadCounters } from "./download-counters";

function fixture() {
  const values = new Map<string, string>();
  const storage = { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { values.set(key, value); }) };
  const counters = new DownloadCounters(() => storage);
  return { values, storage, counters };
}

describe("browser-local filename high-water marks", () => {
  it("suggests 001 without writing, advances repeated exports and survives a new helper instance", () => {
    const f = fixture();
    expect(f.counters.suggest("Bells", "mid", "improv").number).toBe("001");
    expect(f.storage.setItem).not.toHaveBeenCalled();
    f.counters.acknowledge("Bells", "mid", "improv", "1");
    expect(f.counters.suggest("Bells", "mid", "improv").number).toBe("002");
    const reload = new DownloadCounters(() => f.storage);
    reload.acknowledge("Bells", "mid", "other_activity", "002");
    expect(reload.suggest("Bells", "mid", "other_activity").number).toBe("003");
    expect(JSON.parse([...f.values.values()][0])).toEqual({ version: 1, highWater: 2 });
  });
  it("separates names and exact extensions while sharing final identities across activities", () => {
    const { counters } = fixture();
    counters.acknowledge("Bells", "webm", "improv_audio", "008");
    expect(counters.suggest("bells", "webm", "performance_audio").number).toBe("009");
    for (const extension of ["mid", "json", "prelude.json", "m4a", "ogg"] as const) expect(counters.suggest("bells", extension, "x").number).toBe("001");
    expect(counters.suggest("Hallelujah", "webm", "x").number).toBe("001");
    counters.acknowledge("Bells", "json", "x", "005");
    expect(counters.suggest("Bells", "prelude.json", "x").number).toBe("001");
  });
  it("shares NFC, unsafe-separator, fallback and bounded-name collisions", () => {
    const { counters } = fixture();
    counters.acknowledge("ÉTUDE / 日本語", "mid", "x", "004");
    expect(counters.suggest("E\u0301tude_日本語", "mid", "other").number).toBe("005");
    counters.acknowledge("", "mid", "Free Play", "009");
    expect(counters.suggest("Free / Play", "mid", "x").number).toBe("010");
    counters.acknowledge("a".repeat(140), "json", "x", "003");
    expect(counters.suggest("a".repeat(120) + "different", "json", "x").number).toBe("004");
  });
  it("merges manual higher and lower numbers without moving backward", () => {
    const { counters } = fixture();
    counters.acknowledge("x", "mid", "x", "007");
    counters.acknowledge("x", "mid", "x", "002");
    expect(counters.suggest("x", "mid", "x").number).toBe("008");
    counters.acknowledge("x", "mid", "x", "090");
    expect(counters.suggest("x", "mid", "x").number).toBe("091");
  });
  it("exhausts 999 without wrapping, allows deliberate repeats, and keeps other names usable", () => {
    const { counters } = fixture();
    counters.acknowledge("x", "mid", "x", "999");
    expect(counters.suggest("x", "mid", "x")).toMatchObject({ number: "", exhausted: true });
    counters.acknowledge("x", "mid", "x", "001");
    expect(counters.suggest("x", "mid", "x").exhausted).toBe(true);
    expect(counters.suggest("new", "mid", "x").number).toBe("001");
  });
  it.each(["000", "-1", "1000", "1.5", "", "abc"])("rejects invalid acknowledged number %s without writing", number => {
    const f = fixture();
    expect(() => f.counters.acknowledge("x", "mid", "x", number)).toThrow(/000 is reserved/);
    expect(f.storage.setItem).not.toHaveBeenCalled();
  });
  it.each(["{", "null", "[]", '{"version":2,"highWater":5}', '{"version":1,"highWater":"5"}', '{"version":1,"highWater":0}', '{"version":1,"highWater":1000}', '{"version":1,"highWater":1.5}'])("reads corrupt/unsupported %s safely without rewriting on load", value => {
    const f = fixture(), key = f.counters.key("x", "mid", "x");
    f.values.set(key, value);
    expect(f.counters.suggest("x", "mid", "x")).toMatchObject({ number: "001", message: expect.stringContaining("could not be read") });
    expect(f.storage.setItem).not.toHaveBeenCalled(); expect(f.values.get(key)).toBe(value);
    f.counters.acknowledge("x", "mid", "x", "006");
    expect(f.counters.suggest("x", "mid", "x").number).toBe("007");
  });
  it("retains this tab's sequence when even storage access throws", () => {
    const counters = new DownloadCounters(() => { throw new Error("blocked"); });
    expect(counters.suggest("x", "mid", "x").message).toContain("tab only");
    counters.acknowledge("x", "mid", "x", "012");
    counters.acknowledge("x", "mid", "x", "001");
    expect(counters.suggest("x", "mid", "x").number).toBe("013");
  });
  it("retains failed writes and merges newer storage before a successful retry", () => {
    const f = fixture(); f.storage.setItem.mockImplementationOnce(() => { throw new Error("quota"); });
    expect(f.counters.acknowledge("x", "mid", "x", "007").message).toContain("tab only");
    expect(f.counters.suggest("x", "mid", "x").number).toBe("008");
    const otherTab = new DownloadCounters(() => f.storage);
    otherTab.acknowledge("x", "mid", "x", "030");
    f.counters.acknowledge("x", "mid", "x", "002");
    expect(new DownloadCounters(() => f.storage).suggest("x", "mid", "x")).toMatchObject({ number: "031", message: "" });
  });
  it("re-reads other tabs without claiming that equal suggestions are reservations", () => {
    const f = fixture(), other = new DownloadCounters(() => f.storage);
    expect(f.counters.suggest("x", "mid", "x").number).toBe(other.suggest("x", "mid", "x").number);
    other.acknowledge("x", "mid", "x", "020");
    f.counters.acknowledge("x", "mid", "x", "001");
    expect(other.suggest("x", "mid", "x").number).toBe("021");
  });
  it("retains this tab's mark when reads fail even if writes happen to succeed", () => {
    const f = fixture(); f.storage.getItem.mockImplementation(() => { throw new Error("read blocked"); });
    f.counters.acknowledge("x", "mid", "x", "007");
    f.counters.acknowledge("x", "mid", "x", "001");
    expect(f.counters.suggest("x", "mid", "x")).toMatchObject({ number: "008", message: expect.stringContaining("tab only") });
  });
});
