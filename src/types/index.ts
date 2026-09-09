// Barrel re-export so existing `from '../types'` imports keep working.
// (It used to also re-export the localStorage service, which is how 82 lines
// of dead persistence code stayed reachable from the type layer.)
export * from './models';
