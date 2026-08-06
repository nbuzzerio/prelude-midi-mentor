import { useCallback, useEffect, useState } from "react";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
    ),
  );
}

export function useFocusMode(enabled = true) {
  const [isFocusMode, setIsFocusMode] = useState(false);

  const toggleFocusMode = useCallback(() => {
    if (!enabled) {
      return;
    }
    setIsFocusMode((currentValue) => !currentValue);
  }, [enabled]);

  const exitFocusMode = useCallback(() => {
    setIsFocusMode(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      if (event.key === "Escape") {
        if (isFocusMode) {
          event.preventDefault();
          exitFocusMode();
        }

        return;
      }

      if (
        event.key.toLowerCase() !== "f" ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      toggleFocusMode();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, exitFocusMode, isFocusMode, toggleFocusMode]);

  return {
    exitFocusMode,
    isFocusMode: enabled && isFocusMode,
    toggleFocusMode,
  };
}
