import { registerSW } from "virtual:pwa-register";

export function registerServiceWorker(): void {
  registerSW({
    immediate: true,

    onRegisteredSW(_serviceWorkerUrl, registration) {
      console.info("Prelude service worker registered.", registration);
    },

    onRegisterError(error) {
      console.error("Prelude service worker registration failed.", error);
    },
  });
}
