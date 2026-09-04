import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import AnimatedNumber from './AnimatedNumber';
import { prefersReducedMotion } from '../lib/motion';

/** Stands in for a browser that has answered the media query one way or another. */
function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }))
  );
}

describe('prefersReducedMotion', () => {
  it('reports true where the media query cannot be asked', () => {
    // jsdom does not implement matchMedia. Treating that as "reduce" is what
    // keeps animated values at their final figure under test, so a test can
    // assert the number it expects rather than whichever frame it caught.
    expect(prefersReducedMotion()).toBe(true);
  });

  it("reflects the viewer's setting when the query is available", () => {
    stubReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);

    stubReducedMotion(false);
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('AnimatedNumber', () => {
  it('renders the value, not an animation frame, when motion is reduced', () => {
    stubReducedMotion(true);
    render(<AnimatedNumber value={42} />);

    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('keeps the prefix, suffix and decimal places', () => {
    stubReducedMotion(true);
    render(<AnimatedNumber value={12.5} decimals={1} prefix="₹" suffix="L" />);

    expect(screen.getByText('₹12.5L')).toBeInTheDocument();
  });

  it('counts from zero to the value and lands exactly on it', async () => {
    stubReducedMotion(false);
    vi.useFakeTimers();

    // Drive the frame loop by hand so the count is observed rather than raced.
    let clock = 0;
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    render(<AnimatedNumber value={100} durationMs={400} />);

    // Starts at zero rather than at the target.
    expect(screen.getByText('0')).toBeInTheDocument();

    const advance = (ms: number) => {
      clock += ms;
      const pending = callbacks.splice(0, callbacks.length);
      act(() => {
        pending.forEach((cb) => cb(clock));
      });
    };

    advance(200);
    const midway = Number(screen.getByText(/\d/).textContent);
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(100);

    // Past the duration it is the exact target, not an eased approximation.
    advance(300);
    expect(screen.getByText('100')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('passes a non-finite value straight through instead of counting to NaN', () => {
    stubReducedMotion(false);
    render(<AnimatedNumber value={Number.NaN} />);

    expect(screen.getByText('NaN')).toBeInTheDocument();
  });
});
