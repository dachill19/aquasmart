import { useEffect, useRef, useState } from "react";

/**
 * Eases a displayed number toward its target instead of snapping, so a poll that
 * brings a new reading reads as the tank moving rather than a number flickering.
 * Reduced-motion visitors get the value immediately.
 */
export function useTween(target: number | null, ms = 900): number | null {
  const [shown, setShown] = useState<number | null>(target);
  const from = useRef<number | null>(target);

  useEffect(() => {
    if (target === null) {
      from.current = null;
      setShown(null);
      return;
    }
    const start = from.current;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (start === null || start === target || reduced) {
      from.current = target;
      setShown(target);
      return;
    }

    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = start + (target - start) * eased;
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return shown;
}
