/**
 * Backend selector. Demo mode (browser-local) unless Supabase env vars exist.
 * Import `getBackend()` from islands; the Supabase SDK is only downloaded
 * when it is actually configured.
 */
import type { Backend } from './types';
import { demoBackend } from './demo';

export const IS_DEMO = !(import.meta.env.PUBLIC_SUPABASE_URL && import.meta.env.PUBLIC_SUPABASE_ANON_KEY);

let chosen: Promise<Backend> | null = null;
export function getBackend(): Promise<Backend> {
  chosen ??= IS_DEMO ? Promise.resolve(demoBackend) : import('./supabase').then((m) => m.supabaseBackend);
  return chosen;
}

export * from './types';
