/**
 * Runtime configuration.
 *
 * The API base URL used to be the hardcoded string `http://localhost:3001/api`
 * in nine different files. On the deployed site that is a mixed-content
 * request from an HTTPS page to localhost, so every call failed silently and
 * the app quietly fell back to browser storage.
 */

function readApiBase(): string {
  const configured = import.meta.env.VITE_API_URL?.trim();

  if (configured) return configured.replace(/\/+$/, '');

  if (import.meta.env.DEV) return 'http://localhost:3001/api';

  // Failing loudly beats shipping a build that looks fine and silently talks
  // to nothing.
  throw new Error(
    'VITE_API_URL is not set. Configure it at build time so the app knows where its API lives.'
  );
}

export const API_BASE_URL = readApiBase();

/** Origin without the /api suffix, for the websocket connection. */
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/, '');

/**
 * Demo login buttons are opt-in. They are useful for a showcase deployment and
 * inappropriate for a real tenant, so the decision is a build flag rather than
 * something baked into the component.
 */
export const DEMO_LOGIN_ENABLED = import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true';

export const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@velara.com' },
  { label: 'Manager', email: 'manager@velara.com' },
  { label: 'Sales', email: 'sneha@velara.com' },
] as const;
