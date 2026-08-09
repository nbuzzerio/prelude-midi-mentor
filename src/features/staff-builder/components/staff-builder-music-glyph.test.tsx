import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StaffBuilderMusicGlyph } from "./staff-builder-music-glyph";

afterEach(cleanup);

describe("StaffBuilderMusicGlyph", () => {
  it("renders note, rest, and clef symbols through public VexFlow SVG rendering", () => {
    const { container } = render(<><StaffBuilderMusicGlyph kind="dotted-quarter" /><StaffBuilderMusicGlyph family="rest" kind="eighth" /><StaffBuilderMusicGlyph kind="treble-clef" /></>);
    expect(container.querySelectorAll("svg")).toHaveLength(3);
    expect(container.querySelector('[data-glyph-family="note"][data-glyph-kind="dotted-quarter"]')).toBeTruthy();
    expect(container.querySelector('[data-glyph-family="rest"][data-glyph-kind="eighth"]')).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
