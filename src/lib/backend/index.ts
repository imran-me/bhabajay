/**
 * Backend selector. Supabase when its env vars exist; otherwise the PHP/MySQL
 * API (/api/health.php) when reachable; otherwise demo mode (browser-local).
 * Import `getBackend()` from islands; the Supabase SDK is only downloaded
 * when it is actually configured.
 */
import type { Backend } from './types';
import { demoBackend } from './demo';

export const IS_DEMO = !(import.meta.env.PUBLIC_SUPABASE_URL && import.meta.env.PUBLIC_SUPABASE_ANON_KEY);

let chosen: Promise<Backend> | null = null;
export function getBackend(): Promise<Backend> {
  chosen ??= IS_DEMO
    ? // Hostinger: use PHP + MySQL under /api when it answers, else browser-local demo
      import('./php').then(async (m) => ((await m.apiAvailable()) ? m.phpBackend : demoBackend)).catch(() => demoBackend)
    : import('./supabase').then((m) => m.supabaseBackend);
  return chosen;
}

export * from './types';
