import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

const scheduleStaleServiceWorkerCleanup = () => {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  try {
    const alreadyScheduled = window.sessionStorage.getItem("edio_sw_cleanup_scheduled") === "1";
    if (alreadyScheduled) return;
    window.sessionStorage.setItem("edio_sw_cleanup_scheduled", "1");
  } catch {
    // Some privacy modes can block sessionStorage; cleanup can still be scheduled once.
  }

  const cleanup = async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch {
      // Cache cleanup is a production safety net; never block the storefront.
    }
  };

  const scheduleAfterInitialLoad = () => {
    window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => void cleanup(), { timeout: 5000 });
        return;
      }

      void cleanup();
    }, 8000);
  };

  if (document.readyState === "complete") {
    scheduleAfterInitialLoad();
    return;
  }

  window.addEventListener("load", scheduleAfterInitialLoad, { once: true });
};

// Remove stale production service workers so auth and storefront UI cannot stay pinned to old bundles.
scheduleStaleServiceWorkerCleanup();
