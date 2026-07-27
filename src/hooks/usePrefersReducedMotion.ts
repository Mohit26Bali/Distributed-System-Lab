import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function getInitial(): boolean {
  if (typeof window === "undefined") return false; // SSR: no media query to read yet
  return window.matchMedia(QUERY).matches;
}

/**
 * Framer Motion doesn't respect this media query on its own — CSS-only
 * transitions can use Tailwind's `motion-reduce:` variant instead, but
 * anything driven by an explicit `transition` prop (PacketDot) needs this.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(getInitial);

  useEffect(() => {
    const mediaQuery = window.matchMedia(QUERY);

    function handleChange(event: MediaQueryListEvent) {
      setPrefersReduced(event.matches);
    }

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReduced;
}
