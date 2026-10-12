// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { createStaffBuilderScore } from "../staff-builder-score";
import { createStaffBuilderPieceDownload, downloadStaffBuilderPiece, readStaffBuilderPieceFile } from "./staff-builder-piece-file-browser";
import { serializeStaffBuilderPiece } from "./staff-builder-piece-file";

afterEach(() => { if (vi.isFakeTimers()) vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("Staff Builder piece browser files", () => {
  it("captures exact canonical bytes before any name editing or later source changes", async () => {
    const score = createStaffBuilderScore({ title: "Étude 日本語", tempoBpm: 96, initialKeySignatureId: "c-major", initialTimeSignature: "4/4" });
    const original = serializeStaffBuilderPiece(score), snapshot = createStaffBuilderPieceDownload(score);
    Object.assign(score, { title: "Later document title" });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshot.name).toBe("Étude 日本語"); expect(snapshot.blob.type).toBe("application/json");
    expect(await snapshot.blob.text()).toBe(original);
  });
  it("reads and schema-validates file text", async () => {
    const score = createStaffBuilderScore({ title: "Backup", tempoBpm: 96, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", factories: { createId: () => "id", now: () => "2026-08-11T12:00:00.000Z" } });
    await expect(readStaffBuilderPieceFile({ text: () => Promise.resolve(JSON.stringify(score)) })).resolves.toEqual({ ok: true, score });
  });

  it("reports browser file-read failure without exposing the error", async () => {
    await expect(readStaffBuilderPieceFile({ text: () => Promise.reject(new Error("private path")) })).resolves.toMatchObject({ ok: false, reason: "read-failed", message: expect.not.stringContaining("private path") });
  });

  it("downloads canonical JSON and always revokes the object URL", async () => {
    vi.useFakeTimers();
    const score = createStaffBuilderScore({ title: "My Study", tempoBpm: 96, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", factories: { createId: () => "id", now: () => "2026-08-11T12:00:00.000Z" } });
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:piece");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    downloadStaffBuilderPiece(score);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe("application/json");
    expect(await blob.text()).toContain('"title": "My Study"');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled(); vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:piece");
    expect(document.querySelector('a[download="my_study_001.prelude.json"]')).toBeNull();
  });
});
