import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MelodyCountGuide } from "./melody-count-guide";

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
});
