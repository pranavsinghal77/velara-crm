import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * `fetch` is stubbed by default and every test starts from a clean slate.
 *
 * The previous setup left `fetch` live, so `npm test` fired real requests at
 * localhost:3001 - the suite passed with a wall of ECONNREFUSED noise and
 * would have behaved differently on a machine where that port was listening.
 */

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error(
        'Unstubbed fetch call. Mock the request explicitly in the test that needs it.'
      );
    })
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
