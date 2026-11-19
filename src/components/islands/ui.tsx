/** Small shared React pieces for islands (ভাবু, avatar, loader, icons). */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { emptyState, getState, subscribe, type State } from '../../lib/store';

/**
 * Local store, hydration-safe: the server render (and the first client
 * render) see the empty state; the real browser state arrives after mount.
 */
export function useStore(): State {
  const [s, set] = useState<State>(emptyState);
  useEffect(() => {
    set(getState());
    return subscribe(set);
  }, []);
  return s;
}
import { bhabuSvg, avatarSvg, type BhabuOptions } from '../../lib/bhabu';
import { iconSvg, flameSvg } from '../../lib/icons';
import { doodleSvg } from '../../lib/doodles';
import type { AvatarConfig, DoodleName, Tier } from '../../data/types';

export function Bhabu({ className = 'w-16', ...o }: BhabuOptions & { className?: string }) {
  const html = useMemo(() => bhabuSvg({ ...o, className: 'w-full h-auto' }), [JSON.stringify(o)]);
  return <span className={`inline-block shrink-0 ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Avatar({ avatar, tier = 'none', className = 'w-14 h-14', title }: { avatar: AvatarConfig; tier?: Tier | 'none'; className?: string; title?: string }) {
  const html = useMemo(() => avatarSvg(avatar, { tier, title, className: 'w-full h-full' }), [JSON.stringify(avatar), tier, title]);
  return <span className={`inline-block shrink-0 rounded-full ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Icon({ name, className = 'w-5 h-5', label }: { name: string; className?: string; label?: string }) {
  return <span className="inline-flex" dangerouslySetInnerHTML={{ __html: iconSvg(name, className, label) }} />;
}

export function Flame({ streak, className = 'w-6 h-6' }: { streak: number; className?: string }) {
  return <span className="inline-flex" dangerouslySetInnerHTML={{ __html: flameSvg(streak, className) }} />;
}

export function Doodle({ name, className = 'w-10 h-10' }: { name: DoodleName; className?: string }) {
  return <span className={`inline-block shrink-0 ${className}`} dangerouslySetInnerHTML={{ __html: doodleSvg(name, { className: 'w-full h-full' }) }} />;
}

/** Loading ভাবু: the "!" bounces like a thinking dot; slow network → a fun fact. */
export function Loader({ label = 'ভাবছি…' }: { label?: string }) {
  const [fact, setFact] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const list: string[] = JSON.parse(document.getElementById('bj-facts')?.textContent || '[]');
        if (list.length) setFact(list[Math.floor(Math.random() * list.length)]);
      } catch {
        /* ignore */
      }
    }, 1200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="grid place-items-center gap-3 py-10 text-center" role="status" aria-live="polite">
      <span className="block w-10 animate-bounce-dot">
        <Bhabu face="think" body="teal" dot="coral" sparks={false} className="w-10" />
      </span>
      <p className="font-semibold text-ink-soft">{label}</p>
      {fact && <p className="max-w-xs text-sm text-ink-soft">💡 {fact}</p>}
    </div>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string | null; children: ReactNode; htmlFor: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <p className="hint mt-1">{hint}</p>}
      {error && <p className="error-text mt-1" role="alert">{error}</p>}
    </div>
  );
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** Series chips: which series the person is curious about (stored as slugs). */
export function InterestPicker({ options, value, onChange, max = 8 }: { options: { slug: string; title: string }[]; value: string[]; onChange: (v: string[]) => void; max?: number }) {
  return (
    <fieldset>
      <legend className="label">কোন বিষয়ে কৌতূহল? <span className="font-normal text-ink-soft">(যতগুলো খুশি, {max}টা পর্যন্ত)</span></legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.slug);
          return (
            <button key={o.slug} type="button" aria-pressed={on} className={`chip min-h-11 ${on ? 'is-active' : ''}`}
              onClick={() => onChange(on ? value.filter((x) => x !== o.slug) : value.length >= max ? value : [...value, o.slug])}>
              {o.title}{on && ' ✓'}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
