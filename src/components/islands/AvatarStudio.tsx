/**
 * Avatar studio: build your ভাবু. The brand "!" is the base, so every avatar
 * is on-brand and no face photo is ever needed for teens.
 *  Face 5 expressions · Hat টুপি/grad cap/astronaut/gamchha · Prop (unlocked
 *  by badges) · Ground 4 colours + 3 patterns · Frame = tier ring
 */
import { useState } from 'react';
import type { AvatarConfig, Tier } from '../../data/types';
import { FACE_OPTIONS, HAT_OPTIONS, PROP_OPTIONS, GROUND_OPTIONS, BODY_OPTIONS } from '../../lib/bhabu';
import { BADGE_MAP } from '../../lib/badges';
import { TIER_LABEL } from '../../lib/bn';
import { sound } from '../../lib/fx';
import { Avatar, Icon } from './ui';

interface Props {
  value: AvatarConfig;
  tier: Tier | null;
  badges: Record<string, string>;
  onSave: (a: AvatarConfig) => void | Promise<void>;
  locked?: boolean;
}

type Tab = 'face' | 'hat' | 'prop' | 'ground' | 'body';
const TABS: { id: Tab; bn: string }[] = [
  { id: 'face', bn: 'মুখ' },
  { id: 'hat', bn: 'টুপি' },
  { id: 'prop', bn: 'যন্ত্র' },
  { id: 'ground', bn: 'পটভূমি' },
  { id: 'body', bn: 'রং' },
];

export default function AvatarStudio({ value, tier, badges, onSave, locked = false }: Props) {
  const [a, setA] = useState<AvatarConfig>(value);
  const [tab, setTab] = useState<Tab>('face');
  const dirty = JSON.stringify(a) !== JSON.stringify(value);
  const set = (patch: Partial<AvatarConfig>) => { setA((x) => ({ ...x, ...patch })); sound.pop(); };

  const options: { id: string; bn: string; lockedBy?: string; preview: AvatarConfig }[] =
    tab === 'face' ? FACE_OPTIONS.map((o) => ({ ...o, preview: { ...a, face: o.id } }))
    : tab === 'hat' ? HAT_OPTIONS.map((o) => ({ ...o, preview: { ...a, hat: o.id } }))
    : tab === 'prop' ? PROP_OPTIONS.map((o) => ({ ...o, lockedBy: o.badge && !badges[o.badge] ? o.badge : undefined, preview: { ...a, prop: o.id } }))
    : tab === 'ground' ? GROUND_OPTIONS.map((o) => ({ ...o, preview: { ...a, ground: o.id } }))
    : BODY_OPTIONS.map((o) => ({ ...o, preview: { ...a, body: o.id } }));
  const current = a[tab as keyof AvatarConfig];

  return (
    <div className="grid gap-5 md:grid-cols-[14rem_1fr]">
      <div className="flex flex-col items-center gap-3">
        <Avatar avatar={a} tier={tier ?? 'none'} className="h-48 w-48" title="তোমার ভাবু" />
        <p className="text-sm text-ink-soft">ফ্রেম: {tier ? `${TIER_LABEL[tier].bn} রিং` : 'স্তর পেলে রিং যোগ হবে'}</p>
        <div className="flex gap-2">
          <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || locked} onClick={() => onSave(a)}>সেভ করো</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!dirty} onClick={() => setA(value)}>আগের মতো</button>
        </div>
        <button type="button" className="text-sm font-bold text-link underline-offset-4 hover:underline" onClick={() => {
          const r = <T,>(xs: { id: T; badge?: string }[]) => { const ok = xs.filter((x) => !x.badge || badges[x.badge]); return ok[Math.floor(Math.random() * ok.length)].id; };
          set({ face: r(FACE_OPTIONS), hat: r(HAT_OPTIONS), prop: r(PROP_OPTIONS), ground: r(GROUND_OPTIONS), body: r(BODY_OPTIONS) });
        }}>🎲 এলোমেলো</button>
      </div>
      <div>
        <div role="tablist" className="flex gap-1 overflow-x-auto rounded-2xl bg-tint p-1" aria-label="অবতারের অংশ">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`flex-1 shrink-0 rounded-xl px-3 py-2 text-sm font-bold ${tab === t.id ? 'bg-surface shadow-sm' : 'text-ink-soft'}`}>{t.bn}</button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5" role="radiogroup">
          {options.map((o) => {
            const on = current === o.id;
            const lockedOpt = !!o.lockedBy;
            return (
              <button key={o.id} type="button" role="radio" aria-checked={on} disabled={lockedOpt}
                onClick={() => set({ [tab]: o.id } as Partial<AvatarConfig>)}
                title={lockedOpt ? `খুলবে: ${BADGE_MAP[o.lockedBy!]?.bn} ব্যাজ — ${BADGE_MAP[o.lockedBy!]?.how}` : o.bn}
                className={`relative flex flex-col items-center gap-1 rounded-2xl border-2 p-2 text-xs font-semibold transition ${on ? 'border-coral bg-coral-soft' : 'border-line hover:border-teal'} ${lockedOpt ? 'opacity-60' : ''}`}>
                <span className={lockedOpt ? 'grayscale' : ''}><Avatar avatar={o.preview} className="h-14 w-14" /></span>
                <span className="leading-tight">{o.bn}</span>
                {lockedOpt && <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-deep text-white"><Icon name="lock" className="h-3.5 w-3.5" /></span>}
              </button>
            );
          })}
        </div>
        {tab === 'prop' && <p className="hint mt-2">যন্ত্রগুলো ব্যাজ জিতলে খোলে — তালায় চাপ দিয়ে দেখো কোন ব্যাজ লাগবে।</p>}
      </div>
    </div>
  );
}
