import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useFlashcardSettings } from "../hooks/use-flashcard-settings";
import PracticeControls from "./practice-controls";
afterEach(cleanup);
function Editor() {
  const settings = useFlashcardSettings();
  return <PracticeControls {...settings} onModeChange={settings.setMode} onShowTargetNameChange={settings.setShowTargetName} onExerciseTypeToggle={settings.toggleExerciseType} onNoteCategoryToggle={settings.toggleNoteCategory} onTriadQualityToggle={settings.toggleTriadQuality} onTriadPositionToggle={settings.toggleTriadPosition} />;
}
it("edits settings without a MIDI provider, target, or runtime reset", () => {
  render(<Editor />);
  expect(screen.queryByRole("button", { name: /reset session/i })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Treble" }));
  expect(screen.getByRole("button", { name: "Treble" }).getAttribute("aria-pressed")).toBe("true");
});
