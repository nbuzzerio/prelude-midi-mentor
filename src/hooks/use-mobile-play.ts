import { useCallback, useEffect, useRef, useState } from "react";

type LockableScreenOrientation = ScreenOrientation &
  Readonly<{
    lock?: (orientation: "landscape") => Promise<void>;
    unlock?: () => void;
  }>;

async function requestFullscreen(): Promise<boolean> {
  if (
    document.fullscreenElement !== null ||
    document.documentElement.requestFullscreen === undefined
  ) {
    return false;
  }

  try {
    await document.documentElement.requestFullscreen();
    return document.fullscreenElement === document.documentElement;
  } catch {
    return false;
  }
}

async function exitFullscreen(): Promise<void> {
  if (
    document.fullscreenElement !== document.documentElement ||
    document.exitFullscreen === undefined
  ) {
    return;
  }

  try {
    await document.exitFullscreen();
  } catch {
    // Fullscreen exit is best-effort.
  }
}

async function lockLandscapeOrientation(): Promise<boolean> {
  const orientation = (
    screen as Screen & { orientation?: LockableScreenOrientation }
  ).orientation;

  if (orientation?.lock === undefined) {
    return false;
  }

  try {
    await orientation.lock("landscape");
    return true;
  } catch {
    return false;
  }
}

function unlockOrientation(): void {
  const orientation = (
    screen as Screen & { orientation?: LockableScreenOrientation }
  ).orientation;

  if (orientation?.unlock === undefined) {
    return;
  }

  try {
    orientation.unlock();
  } catch {
    // Orientation unlock is best-effort.
  }
}

export function useMobilePlay() {
  const [isMobilePlayMode, setIsMobilePlayMode] = useState(false);
  const browserRequestTokenRef = useRef(0);
  const enteredFullscreenRef = useRef(false);
  const lockedOrientationRef = useRef(false);

  const cleanupBrowserState = useCallback(() => {
    browserRequestTokenRef.current += 1;

    if (lockedOrientationRef.current) {
      lockedOrientationRef.current = false;
      unlockOrientation();
    }

    if (enteredFullscreenRef.current) {
      enteredFullscreenRef.current = false;
      void exitFullscreen();
    }
  }, []);

  const enterMobilePlay = useCallback(() => {
    setIsMobilePlayMode(true);

    const requestToken = browserRequestTokenRef.current + 1;
    browserRequestTokenRef.current = requestToken;

    void (async () => {
      const enteredFullscreen = await requestFullscreen();

      if (enteredFullscreen) {
        if (browserRequestTokenRef.current === requestToken) {
          enteredFullscreenRef.current = true;
        } else {
          await exitFullscreen();
        }
      }

      if (browserRequestTokenRef.current !== requestToken) {
        return;
      }

      const lockedOrientation = await lockLandscapeOrientation();

      if (!lockedOrientation) {
        return;
      }

      if (browserRequestTokenRef.current === requestToken) {
        lockedOrientationRef.current = true;
      } else {
        unlockOrientation();
      }
    })();
  }, []);

  const exitMobilePlay = useCallback(() => {
    setIsMobilePlayMode(false);
    cleanupBrowserState();
  }, [cleanupBrowserState]);

  useEffect(
    () => () => {
      cleanupBrowserState();
    },
    [cleanupBrowserState],
  );

  return {
    enterMobilePlay,
    exitMobilePlay,
    isMobilePlayMode,
  };
}
