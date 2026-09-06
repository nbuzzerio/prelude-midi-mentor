import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useEarTrainingSettings } from "../hooks/use-ear-training-settings";
import EarTrainingControls from "./ear-training-controls";
afterEach(cleanup);
function Editor() {
  const settings = useEarTrainingSettings();
  return <EarTrainingControls {...settings} onDirectionToggle={settings.toggleDirection} onIntervalToggle={settings.toggleInterval} />;
}
it("edits settings without prompt playback or runtime reset", () => {
  render(<Editor />);
  expect(screen.queryByRole("button", { name: /reset session/i })).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: "descending" }));
  expect((screen.getByRole("checkbox", { name: "descending" }) as HTMLInputElement).checked).toBe(true);
});
