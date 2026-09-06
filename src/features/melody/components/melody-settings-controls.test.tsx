import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DEFAULT_MELODY_SETTINGS } from "../melody-types";
import { DEFAULT_MELODY_CONFIG } from "../melody-config";
import type { MelodyContinuousDurationMinutes } from "../melody-continuous-practice";
import { MelodySettingsControls, MelodyPracticeOptions } from "./melody-settings-controls";
afterEach(cleanup);
function Editor({ timed = false }: { timed?: boolean }) {
  const [settings, setSettings] = useState(DEFAULT_MELODY_SETTINGS);
  const [continuousPractice, setContinuousPractice] = useState(DEFAULT_MELODY_CONFIG.continuousPractice);
  const [duration, setDuration] = useState<MelodyContinuousDurationMinutes>(DEFAULT_MELODY_CONFIG.continuousDurationMinutes);
  return <MelodySettingsControls settings={settings} onChange={(key, value) => setSettings((current) => ({ ...current, [key]: value }))}>
    {timed && <MelodyPracticeOptions continuousPractice={continuousPractice} continuousDurationMinutes={duration} onContinuousPracticeChange={setContinuousPractice} onDurationChange={setDuration} />}
  </MelodySettingsControls>;
}
it("edits generation settings without mounting a generator, MIDI provider, or timed session", () => {
  render(<Editor />);
  expect(screen.queryByRole("checkbox", { name: "Continuous Practice" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Staff"), { target: { value: "bass" } });
  expect((screen.getByLabelText("Staff") as HTMLSelectElement).value).toBe("bass");
  fireEvent.change(screen.getByLabelText("Tempo"), { target: { value: "80" } });
  expect((screen.getByLabelText("Tempo") as HTMLSelectElement).value).toBe("80");
});
it("composes optional timed prescription controls without clocks or results", () => {
  render(<Editor timed />);
  expect(screen.queryByLabelText("Session duration")).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: "Continuous Practice" }));
  expect((screen.getByLabelText("Session duration") as HTMLSelectElement).value).toBe("5");
  fireEvent.change(screen.getByLabelText("Session duration"), { target: { value: "2" } });
  expect((screen.getByLabelText("Session duration") as HTMLSelectElement).value).toBe("2");
  expect(screen.queryByRole("button", { name: "Start Session" })).toBeNull();
});
