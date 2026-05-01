import { toast } from "@/hooks/use-toast";

/**
 * Register the service worker for offline / repeat-visit caching.
 *
 * Guards:
 * - Production builds only (import.meta.env.PROD)
 * - Browser supports SW
 * - NOT inside an iframe (avoids stale content inside Lovable's preview)
 * - NOT on lovable.app preview hosts
 */
export async function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  const inIframe = window.self !== window.top;
  if (inIframe) return;

  const host = window.location.hostname;
  const isPreviewHost =
    host.endsWith(".lovable.app") && host.includes("id-preview");
  if (isPreviewHost) return;

  try {
    const { Workbox } = await import("workbox-window");
    const wb = new Workbox("/sw.js");

    wb.addEventListener("waiting", () => {
      // A new version is ready — let the user opt in to refresh.
      toast({
        title: "Update available",
        description: "A new version of EDIO is ready. Refresh to update.",
        action: undefined,
        duration: 10000,
      });

      // Auto-activate after the user navigates / next reload.
      // Users can also click refresh manually.
      const onControlling = () => {
        window.location.reload();
      };
      wb.addEventListener("controlling", onControlling);

      // Tell the waiting SW to skip waiting on next load
      wb.messageSkipWaiting();
    });

    await wb.register();
  } catch (err) {
    // Silently ignore — caching is a progressive enhancement
    console.warn("[sw] registration failed", err);
  }
}
