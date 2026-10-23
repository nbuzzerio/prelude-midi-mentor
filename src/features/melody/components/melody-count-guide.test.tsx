import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MelodyCountGuide } from "./melody-count-guide";
afterEach(cleanup);

describe("MelodyCountGuide", () => {
  it("renders eight deterministic subdivision tokens per measure", () => {
    const { container } = render(<MelodyCountGuide measureCount={2} />);
    expect(screen.getByLabelText("Count guide").textContent).toBe("1&2&3&4&1&2&3&4&");
    const tokens = [...container.querySelectorAll("[data-tick]")];
    expect(tokens).toHaveLength(16);
    expect(tokens.map((token) => Number(token.getAttribute("data-tick")))).toEqual([0, 240, 480, 720, 960, 1200, 1440, 1680, 1920, 2160, 2400, 2640, 2880, 3120, 3360, 3600]);
  });

  it("marks one current subdivision without changing its labels", () => {
    const { container } = render(<MelodyCountGuide activeAbsoluteTick={1920} measureCount={2} />);
    expect(container.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
    expect(container.querySelector('[aria-current="true"]')?.textContent).toBe("1");
  });

  it("shows three preparatory beats beside the unchanged target guide", () => {
    const { container } = render(<MelodyCountGuide activeAbsoluteTick={-480} measureCount={1} showPreparatoryLeadIn />);
    expect(screen.getByLabelText("Preparatory lead-in").textContent).toBe("321");
    expect([...container.querySelectorAll("[data-preparatory-tick]")].map((token) =>
      Number(token.getAttribute("data-preparatory-tick")))).toEqual([-1440, -960, -480]);
    expect(container.querySelector('[data-preparatory-tick="-480"]')?.getAttribute("aria-current")).toBe("true");
    expect(container.querySelectorAll("[data-tick]")).toHaveLength(8);
  });
  it("follows only the selected measure without relabelling absolute native ticks", () => {
    const view = render(<MelodyCountGuide measureCount={2} showPreparatoryLeadIn visibleDisplayMeasure={0} activeAbsoluteTick={-480} />);
    expect(view.container.querySelectorAll("[data-tick]")).toHaveLength(0);
    view.rerender(<MelodyCountGuide measureCount={2} showPreparatoryLeadIn visibleDisplayMeasure={2} activeAbsoluteTick={2160} />);
    expect(screen.queryByLabelText("Preparatory lead-in")).toBeNull();
    expect([...view.container.querySelectorAll("[data-tick]")].map(e => Number(e.getAttribute("data-tick")))).toEqual([1920, 2160, 2400, 2640, 2880, 3120, 3360, 3600]);
    expect(view.container.querySelector('[aria-current="true"]')?.textContent).toBe("&");
  });
});
