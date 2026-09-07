import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import ScaleRepertoireControls from "./scale-repertoire-controls";
import type { ScaleRepertoireId } from "../scale-repertoire";
afterEach(cleanup);
function Editor() {
  const [selection, setSelection] = useState<readonly ScaleRepertoireId[]>([]);
  return <ScaleRepertoireControls selection={selection} onChange={setSelection} />;
}
it("shows 28 catalog options and accessible, visible reasons for the two disabled scales", () => {
  render(<Editor />);
  const catalog = screen.getByRole("group", { name: "Repertoire catalog" });
  const options = within(catalog).getAllByRole("checkbox") as HTMLInputElement[];
  expect(options).toHaveLength(28);
  expect(options.filter((option) => !option.disabled)).toHaveLength(26);
  for (const name of ["G\u266f Harmonic Minor (Coming soon)", "G\u266f Melodic Minor (Coming soon)"]) {
    const checkbox = screen.getByRole("checkbox", { name }) as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    expect(document.getElementById(checkbox.getAttribute("aria-describedby")!)?.textContent).toMatch(/double accidentals/);
    expect(checkbox.closest("label")?.title).toMatch(/double accidentals/);
  }
  const naturalMinor = screen.getByRole("checkbox", { name: "G\u266f Natural Minor" });
  fireEvent.click(naturalMinor);
  expect(within(screen.getByRole("region", { name: "Selected repertoire order" })).getByText("1. G\u266f Natural Minor")).toBeTruthy();
});
it("keeps user selection order, supports accessible moves/removal, and retains focus after moving", () => {
  render(<Editor />);
  for (const name of ["G Major", "C Major", "A Natural Minor"]) fireEvent.click(screen.getByRole("checkbox", { name }));
  const order = screen.getByRole("region", { name: "Selected repertoire order" });
  const names = () => within(order).getAllByRole("listitem").map((row) => row.querySelector("span")!.textContent);
  expect(names()).toEqual(["1. G Major", "2. C Major", "3. A Natural Minor"]);
  fireEvent.click(screen.getByRole("button", { name: "Move C Major up" }));
  expect(names()).toEqual(["1. C Major", "2. G Major", "3. A Natural Minor"]);
  expect(document.activeElement?.textContent).toContain("1. C Major");
  fireEvent.click(screen.getByRole("button", { name: "Move C Major down" }));
  expect(names()).toEqual(["1. G Major", "2. C Major", "3. A Natural Minor"]);
  fireEvent.click(screen.getByRole("button", { name: "Remove G Major" }));
  expect((screen.getByRole("checkbox", { name: "G Major" }) as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByRole("checkbox", { name: "C Major" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "A Natural Minor" }));
  expect(within(order).getByText("Select at least one scale to begin.")).toBeTruthy();
});
