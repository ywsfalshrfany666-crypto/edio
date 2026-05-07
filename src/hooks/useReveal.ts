import { useEffect } from "react";

/**
 * Lightweight scroll reveal.
 * Adds `is-visible` to any element with `data-reveal` once it enters the viewport.
 * Respects prefers-reduced-motion.
 */
export function useReveal() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

    if (reduce) {
      elements.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < viewportHeight * 0.92) el.classList.add("is-visible");
    });
    document.documentElement.classList.add("motion-ready");

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = el.dataset.revealDelay;
            if (delay) {
              const safeDelay = Math.min(Number(delay) || 0, 160);
              el.style.transitionDelay = `${safeDelay}ms`;
            }
            el.classList.add("is-visible");
            io.unobserve(el);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
    );

    elements.forEach((el) => io.observe(el));

    // Re-scan when the route changes / new nodes mount
    const observed = new WeakSet<Element>(elements);
    const mo = new MutationObserver(() => {
      document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-visible)").forEach((el) => {
        if (!observed.has(el)) {
          io.observe(el);
          observed.add(el);
        }
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      document.documentElement.classList.remove("motion-ready");
    };
  }, []);
}
