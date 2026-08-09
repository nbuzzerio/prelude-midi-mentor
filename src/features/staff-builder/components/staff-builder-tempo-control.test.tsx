import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffBuilderTempoControl } from "./staff-builder-tempo-control";

afterEach(cleanup);

describe("StaffBuilderTempoControl", () => {
  it("shows the authoritative BPM and commits valid integer values on Enter or blur", () => {
    const onTempoChange = vi.fn();
    render(<StaffBuilderTempoControl onTempoChange={onTempoChange} tempoBpm={100} />);
    const input = screen.getByRole("spinbutton", { name: "Tempo" }) as HTMLInputElement;
    expect(input.value).toBe("100");
    expect(input.getAttribute("aria-describedby")).toBe("staff-builder-tempo-unit");
    fireEvent.change(input, { target: { value: "101" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onTempoChange).toHaveBeenLastCalledWith(101);
    fireEvent.change(input, { target: { value: "120" } });
    fireEvent.blur(input);
    expect(onTempoChange).toHaveBeenLastCalledWith(120);
    expect(onTempoChange).toHaveBeenCalledTimes(2);
  });

  it.each(["", "100.5", "39", "241"])("restores invalid draft %j without mutation", (value) => {
    const onTempoChange = vi.fn();
    render(<StaffBuilderTempoControl onTempoChange={onTempoChange} tempoBpm={100} />);
    const input = screen.getByRole("spinbutton", { name: "Tempo" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
    expect(onTempoChange).not.toHaveBeenCalled();
    expect(input.value).toBe("100");
  });

  it.each([40, 240])("accepts the %i BPM boundary", (value) => {
    const onTempoChange = vi.fn();
    render(<StaffBuilderTempoControl onTempoChange={onTempoChange} tempoBpm={100} />);
    const input = screen.getByRole("spinbutton", { name: "Tempo" });
    fireEvent.change(input, { target: { value: String(value) } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onTempoChange).toHaveBeenCalledWith(value);
  });

  it("cancels with Escape and treats the authoritative value as a no-op", () => {
    const onTempoChange = vi.fn();
    render(<StaffBuilderTempoControl onTempoChange={onTempoChange} tempoBpm={100} />);
    const input = screen.getByRole("spinbutton", { name: "Tempo" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "140" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("100");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onTempoChange).not.toHaveBeenCalled();
  });
});
