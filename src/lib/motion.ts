import { useEffect, useRef, useState } from 'react';

/**
 * Motion helpers for the things CSS cannot do on its own.
 *
 * Everything visual lives in index.css; this file exists only for animation
 * that has to run through JavaScript — counting a number towards a new value,
 * and letting a component ask whether it should animate at all.
 */

/**
 * Whether the viewer has asked for less motion.
 *
 * Read at call time rather than cached at module load, because the setting can
 * change while the app is open. `matchMedia` is guarded because jsdom does not
 * implement it: under test this reports `true`, so animated values render at
 * their final figure and a test can assert the number it expects instead of
 * whatever frame it happened to catch.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Whether a count-up can be run at all.
 *
 * The animation walks the figure up from zero, so it is only safe where frames
 * actually arrive. `requestAnimationFrame` does not fire in a page that is not
 * painting — a background tab, a webview that has stopped drawing — and a
 * number stuck at its starting value is not a slow animation, it is the wrong
 * number on screen. A pipeline worth ₹15.4L rendered as ₹0.0L is worse than
 * one that appears without ceremony.
 */
function canAnimate(value: number): boolean {
  if (prefersReducedMotion() || !Number.isFinite(value)) return false;
  if (typeof requestAnimationFrame !== 'function') return false;
  // Checked once, at mount. A tab that becomes visible later simply gets the
  // figure without the count, which is the right trade.
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
  return true;
}

/**
 * Expo-out. The JS twin of `--ease-out-soft`, so a counting number and the card
 * it sits in decelerate on the same curve.
 */
function easeOut(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Counts from the previous value to the current one.
 *
 * Animates on mount (from zero) and again on every change, so a KPI that moves
 * because a lead was just created visibly moves rather than silently swapping
 * digits.
 *
 * When motion is reduced — or the value is not a finite number — the target is
 * returned straight from render rather than pushed through state. That keeps a
 * setState out of the effect body, and means there is no frame, however brief,
 * where the figure on screen is not the real one.
 */
export function useCountUp(value: number, durationMs = 700): number {
  const animate = canAnimate(value);

  const [display, setDisplay] = useState(animate ? 0 : value);
  // What is currently on screen. Written only from the frame loop, and read at
  // the start of a new run so a count interrupted by another change continues
  // from where it was instead of snapping back.
  const shown = useRef(display);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!animate) {
      // Keep the baseline current, so if the setting is switched back mid
      // session the next count starts from the figure on screen.
      shown.current = value;
      return;
    }

    const from = shown.current;
    if (from === value) return;

    const start = performance.now();
    let settled = false;

    const land = () => {
      settled = true;
      shown.current = value;
      setDisplay(value);
    };

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);

      if (t >= 1) {
        // Land exactly on the target; easing alone can leave it a hair short,
        // which on a currency figure is a visibly wrong number.
        land();
        frame.current = null;
        return;
      }

      const next = from + (value - from) * easeOut(t);
      shown.current = next;
      setDisplay(next);
      frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);

    // Backstop for frames that stop arriving part-way — the tab is hidden
    // mid-count, or the compositor pauses. `setTimeout` is throttled in a
    // background tab but it does still fire, where rAF does not, so the figure
    // ends up correct either way.
    const backstop = setTimeout(() => {
      if (settled) return;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      land();
    }, durationMs + 400);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      clearTimeout(backstop);
    };
  }, [value, durationMs, animate]);

  return animate ? display : value;
}
