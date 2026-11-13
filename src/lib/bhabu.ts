/**
 * ভাবু — the brand "!" character, drawn as pure SVG strings so the exact
 * same drawing renders in Astro (set:html), React (dangerouslySetInnerHTML),
 * the share-card canvas and build-time OG images.
 *
 * Rules (Website Plan p.20): ভাবু is the narrator, never decoration — max one
 * per screen, always reacting to something. Never touches the logo.
 */
import type { AvatarConfig, FaceId, HatId, PropId, GroundId, BodyId } from '../data/types';

export const C = {
  teal: '#0B6E79',
  deep: '#063C43',
  coral: '#FF6B5B',
  sun: '#FFC93C',
  mint: '#E6F5F3',
  warm: '#FFFBF4',
  white: '#FFFFFF',
};

const BODY_FILL: Record<BodyId, string> = { teal: C.teal, coral: C.coral, deep: C.deep };

export interface BhabuOptions {
  face?: FaceId;
  body?: BodyId;
  /** colour of the "." under the "!" */
  dot?: 'coral' | 'sun' | 'teal';
  /** eyebrow colour: dark on light grounds, white on dark grounds */
  brows?: 'dark' | 'light' | 'none';
  sparks?: boolean;
  hat?: HatId;
  prop?: PropId;
  /** tilt in degrees (the "!" leans like italics) */
  tilt?: number;
  /** pupils look direction override */
  look?: 'center' | 'up' | 'side';
  title?: string;
  className?: string;
  uid?: string;
  /** inner only (no <svg> wrapper) — for composing into avatars */
  bare?: boolean;
  animateSparks?: boolean;
}

/** Deterministic id from the drawing's options: identical on server and
 *  client (no hydration mismatch); identical drawings may share defs safely. */
function stableId(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return `bj${(h >>> 0).toString(36)}`;
}

/* Body path, upright, in a 120×190 box; head top ≈ y 37, tip ≈ y 144 */
const BODY = 'M34 54 C 33 30, 87 28, 87 52 C 87 74, 71 124, 67 139 C 65 147, 56 147, 54 139 C 50 124, 34 76, 34 54 Z';

function eyes(face: FaceId, look: BhabuOptions['look'], dark: string): string {
  const L = { cx: 50, cy: 60 };
  const R = { cx: 71, cy: 58 };
  const white = (e: { cx: number; cy: number }) => `<ellipse cx="${e.cx}" cy="${e.cy}" rx="10.5" ry="11.5" fill="#fff"/>`;
  const pupil = (e: { cx: number; cy: number }, dx: number, dy: number, r = 4.6) =>
    `<circle cx="${e.cx + dx}" cy="${e.cy + dy}" r="${r}" fill="${dark}"/><circle cx="${e.cx + dx + 1.6}" cy="${e.cy + dy - 1.8}" r="1.3" fill="#fff"/>`;
  const closed = (e: { cx: number; cy: number }) =>
    `<path d="M${e.cx - 8} ${e.cy + 3} Q ${e.cx} ${e.cy - 8} ${e.cx + 8} ${e.cy + 3}" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>`;
  let d = { dx: 1.5, dy: 2 };
  if (look === 'up') d = { dx: 2.5, dy: -4 };
  if (look === 'side') d = { dx: 4, dy: 0.5 };
  switch (face) {
    case 'happy':
      return closed(L) + closed(R);
    case 'wink':
      return closed(L) + white(R) + pupil(R, d.dx, d.dy);
    case 'think':
      return white(L) + white(R) + pupil(L, 3, -4.5, 4.2) + pupil(R, 3, -4.5, 4.2);
    case 'grin':
      return white(L) + white(R) + pupil(L, d.dx, d.dy) + pupil(R, d.dx, d.dy);
    case 'wow':
    default:
      return white(L) + white(R) + pupil(L, d.dx, d.dy + 1, 5) + pupil(R, d.dx, d.dy + 1, 5);
  }
}

function mouth(face: FaceId, dark: string, body: string): string {
  switch (face) {
    case 'happy':
      return `<path d="M51 76 Q 61 92 72 75 Z" fill="${dark}"/><path d="M55 83 Q 61 87 67 82" fill="none" stroke="${C.coral === body ? '#FFB3AA' : '#FF8B7E'}" stroke-width="3" stroke-linecap="round"/>`;
    case 'wink':
      return `<path d="M53 78 Q 61 86 70 77" fill="none" stroke="${dark}" stroke-width="3.6" stroke-linecap="round"/>`;
    case 'think':
      return `<path d="M55 81 Q 61 78 68 80" fill="none" stroke="${dark}" stroke-width="3.4" stroke-linecap="round"/>`;
    case 'grin':
      return `<path d="M50 75 Q 61 93 73 74 Z" fill="${dark}"/><path d="M52 76.5 L71 75.5 L70.5 79 Q 61 81 53 79.5 Z" fill="#fff"/>`;
    case 'wow':
    default:
      return `<ellipse cx="61" cy="80" rx="4" ry="5.4" fill="${dark}"/>`;
  }
}

function brows(face: FaceId, color: string): string {
  if (face === 'happy' || face === 'grin') {
    return `<path d="M41 37 Q 48 32 55 35" fill="none" stroke="${color}" stroke-width="3.6" stroke-linecap="round"/><path d="M66 33 Q 73 29 80 33" fill="none" stroke="${color}" stroke-width="3.6" stroke-linecap="round"/>`;
  }
  if (face === 'think') {
    return `<path d="M41 39 Q 48 37 55 39" fill="none" stroke="${color}" stroke-width="3.6" stroke-linecap="round"/><path d="M65 29 Q 73 23 81 30" fill="none" stroke="${color}" stroke-width="3.6" stroke-linecap="round"/>`;
  }
  return `<path d="M40 36 Q 47 29 55 33" fill="none" stroke="${color}" stroke-width="3.6" stroke-linecap="round"/><path d="M66 31 Q 74 26 81 31" fill="none" stroke="${color}" stroke-width="3.6" stroke-linecap="round"/>`;
}

function sparks(animate: boolean): string {
  const cls = animate ? ' class="spark-anim"' : '';
  return `<g${cls} stroke="${C.sun}" stroke-width="6.5" stroke-linecap="round">
    <line x1="61" y1="19" x2="63" y2="4"/><line x1="46" y1="22" x2="39" y2="11"/><line x1="76" y1="22" x2="85" y2="12"/>
  </g>`;
}

function hat(h: HatId, uid: string): string {
  switch (h) {
    case 'tupi': // knitted winter cap with pom-pom
      return `<g><path d="M33 46 C 31 18, 89 14, 88 44 Z" fill="${C.sun}"/>
        <path d="M30 44 Q 60 36 91 42 L 91 49 Q 60 43 30 51 Z" fill="${C.coral}"/>
        <path d="M44 28 L46 41 M56 22 L57 39 M68 22 L68 39 M79 27 L78 40" stroke="#E0A91F" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="61" cy="17" r="7.5" fill="${C.coral}"/></g>`;
    case 'grad': // graduation cap
      return `<g><path d="M44 34 L44 44 Q 61 50 78 43 L78 34 Z" fill="${C.deep}"/>
        <path d="M30 31 L60 19 L93 30 L63 42 Z" fill="${C.deep}"/>
        <path d="M30 31 L60 19 L93 30 L63 42 Z" fill="none" stroke="#0E5A63" stroke-width="1.5"/>
        <circle cx="61" cy="30.5" r="2.6" fill="${C.sun}"/>
        <path d="M61 30.5 Q 82 32 88 35 L 88 49" fill="none" stroke="${C.sun}" stroke-width="2.6" stroke-linecap="round"/>
        <rect x="85" y="47" width="6" height="9" rx="2" fill="${C.sun}"/></g>`;
    case 'astro': // astronaut helmet bubble
      return `<g><ellipse cx="61" cy="62" rx="39" ry="40" fill="rgba(230,245,243,.20)" stroke="#E8F4F2" stroke-width="4.5"/>
        <path d="M33 47 Q 38 32 52 26" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".85"/>
        <rect x="31" y="96" width="60" height="11" rx="5.5" fill="#DDE7E6" stroke="#9FB7B5" stroke-width="2"/>
        <circle cx="40" cy="101.5" r="2.4" fill="${C.coral}"/><circle cx="48" cy="101.5" r="2.4" fill="${C.sun}"/></g>`;
    case 'gamchha': { // Bangladeshi checked gamchha tied as a headband
      const p = `gm${uid}`;
      return `<g><defs><pattern id="${p}" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="${C.coral}"/><rect width="8" height="2.4" fill="#fff" opacity=".85"/><rect width="2.4" height="8" fill="#fff" opacity=".85"/><rect x="5" width="1.3" height="8" fill="${C.teal}" opacity=".7"/>
        </pattern></defs>
        <path d="M32 44 Q 60 33 90 39 L 90 47 Q 60 41 33 52 Z" fill="url(#${p})"/>
        <path d="M89 40 L103 32 L100 46 Z" fill="url(#${p})"/><path d="M89 46 L104 52 L94 58 Z" fill="url(#${p})"/>
        <circle cx="90" cy="43" r="4.4" fill="${C.coral}" stroke="#fff" stroke-width="1.5"/></g>`;
    }
    default:
      return '';
  }
}

function prop(p: PropId): string {
  // drawn to the lower-right of the body, outside the tilt group
  switch (p) {
    case 'tube':
      return `<g transform="translate(86 104) rotate(18)"><rect x="0" y="0" width="15" height="44" rx="7.5" fill="#fff" stroke="${C.deep}" stroke-width="3"/>
        <path d="M1.5 22 L13.5 22 L13.5 36.5 Q 7.5 43 1.5 36.5 Z" fill="${C.teal}"/><circle cx="5" cy="27" r="1.8" fill="#BFE3DD"/><circle cx="9.5" cy="31" r="1.4" fill="#BFE3DD"/>
        <rect x="-2.5" y="-3" width="20" height="6" rx="3" fill="${C.deep}"/></g>`;
    case 'telescope':
      return `<g transform="translate(78 110)"><g transform="rotate(-28 18 10)"><rect x="0" y="4" width="34" height="12" rx="4" fill="${C.coral}"/><rect x="30" y="1" width="9" height="18" rx="3" fill="${C.deep}"/><rect x="8" y="4" width="4" height="12" fill="${C.sun}"/></g>
        <path d="M16 18 L6 44 M18 18 L18 46 M20 18 L30 44" stroke="${C.deep}" stroke-width="3" stroke-linecap="round"/></g>`;
    case 'book':
      return `<g transform="translate(80 120)"><path d="M0 4 Q 13 -2 24 5 L24 32 Q 13 26 0 31 Z" fill="#fff" stroke="${C.deep}" stroke-width="2.6" stroke-linejoin="round"/>
        <path d="M24 5 Q 35 -2 47 4 L47 31 Q 35 26 24 32 Z" fill="${C.sun}" stroke="${C.deep}" stroke-width="2.6" stroke-linejoin="round"/>
        <path d="M5 11 L19 10 M5 17 L19 16 M29 11 L42 10" stroke="${C.teal}" stroke-width="2" stroke-linecap="round"/></g>`;
    case 'magnifier':
      return `<g transform="translate(82 104)"><line x1="23" y1="25" x2="36" y2="42" stroke="${C.deep}" stroke-width="7" stroke-linecap="round"/>
        <circle cx="15" cy="15" r="14" fill="rgba(230,245,243,.75)" stroke="${C.sun}" stroke-width="5"/><path d="M8 11 Q 11 6 17 6" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>`;
    default:
      return '';
  }
}

/** The full character. viewBox 0 0 120 190. */
export function bhabuSvg(o: BhabuOptions = {}): string {
  const face = o.face ?? 'wow';
  const bodyFill = BODY_FILL[o.body ?? 'coral'];
  const dark = C.deep;
  const browColor = o.brows === 'light' ? '#fff' : o.brows === 'none' ? 'transparent' : (o.body === 'deep' ? C.sun : dark);
  const dotFill = o.dot === 'sun' ? C.sun : o.dot === 'teal' ? C.teal : C.coral;
  const tilt = o.tilt ?? 10;
  const uid = o.uid ?? stableId(JSON.stringify(o));
  const hatId = o.hat ?? 'none';
  const showBrows = o.brows !== 'none' && hatId !== 'tupi' && hatId !== 'grad' && hatId !== 'gamchha';
  const showSparks = (o.sparks ?? true) && hatId === 'none';

  const inner = `
  <g transform="rotate(${tilt} 60 100)">
    ${showSparks ? sparks(!!o.animateSparks) : ''}
    ${showBrows ? brows(face, browColor) : ''}
    <path d="${BODY}" fill="${bodyFill}"/>
    <path d="M40 60 C 40 44, 52 37, 62 36" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="5" stroke-linecap="round"/>
    ${eyes(face, o.look, dark)}
    ${mouth(face, dark, bodyFill)}
    ${hat(hatId, uid)}
    <circle cx="60" cy="166" r="12.5" fill="${dotFill}"/>
  </g>
  ${prop(o.prop ?? 'none')}`;

  if (o.bare) return inner;
  const label = o.title ? `<title>${o.title}</title>` : '';
  const aria = o.title ? `role="img" aria-label="${o.title}"` : 'aria-hidden="true" focusable="false"';
  return `<svg viewBox="0 0 120 190" xmlns="http://www.w3.org/2000/svg" ${aria} class="${o.className ?? ''}">${label}${inner}</svg>`;
}

/* ───────────── Avatar (ভাবু avatar studio) ───────────── */

const GROUND_FILL: Record<string, string> = { teal: C.teal, coral: C.coral, sun: C.sun, mint: C.mint };
export const TIER_RING: Record<string, string> = {
  curious: '#8FD3C8',
  explorer: C.teal,
  initiator: C.coral,
  legend: C.sun,
};

function groundDefs(g: GroundId, uid: string): { defs: string; fill: string } {
  if (g === 'dots') {
    return { defs: `<pattern id="gd${uid}" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="18" height="18" fill="${C.mint}"/><circle cx="4" cy="4" r="2.6" fill="${C.coral}" opacity=".55"/><circle cx="13" cy="13" r="2.6" fill="${C.teal}" opacity=".45"/></pattern>`, fill: `url(#gd${uid})` };
  }
  if (g === 'stars') {
    return { defs: `<pattern id="gd${uid}" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="${C.deep}"/><path d="M10 4 L11.6 8.4 L16 10 L11.6 11.6 L10 16 L8.4 11.6 L4 10 L8.4 8.4 Z" fill="${C.sun}"/><circle cx="30" cy="28" r="1.8" fill="#fff"/><circle cx="28" cy="8" r="1.2" fill="#fff" opacity=".8"/><path d="M30 22 L30.8 24.2 L33 25 L30.8 25.8 L30 28 L29.2 25.8 L27 25 L29.2 24.2 Z" fill="#fff" opacity=".7"/></pattern>`, fill: `url(#gd${uid})` };
  }
  if (g === 'stripes') {
    return { defs: `<pattern id="gd${uid}" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="16" height="16" fill="${C.sun}"/><rect width="7" height="16" fill="#FFD966"/></pattern>`, fill: `url(#gd${uid})` };
  }
  return { defs: '', fill: GROUND_FILL[g] ?? C.sun };
}

export interface AvatarOptions {
  tier?: 'curious' | 'explorer' | 'initiator' | 'legend' | 'none';
  title?: string;
  className?: string;
  uid?: string;
}

/** Circular avatar, viewBox 0 0 200 200, tier ring outside. */
export function avatarSvg(a: AvatarConfig, o: AvatarOptions = {}): string {
  const uid = o.uid ?? stableId(JSON.stringify(a) + (o.tier ?? ''));
  const { defs, fill } = groundDefs(a.ground, uid);
  const darkGround = a.ground === 'teal' || a.ground === 'stars' || a.ground === 'coral';
  const bodyOnGround: BodyId = a.ground === 'teal' && a.body === 'teal' ? 'coral' : a.ground === 'coral' && a.body === 'coral' ? 'teal' : a.body;
  const tier = o.tier ?? 'none';
  const ring = tier === 'none' ? '' : tier === 'legend'
    ? `<circle cx="100" cy="100" r="95" fill="none" stroke="url(#lg${uid})" stroke-width="9"/>`
    : `<circle cx="100" cy="100" r="95" fill="none" stroke="${TIER_RING[tier]}" stroke-width="9"/>`;
  const legendGrad = tier === 'legend'
    ? `<linearGradient id="lg${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE08A"/><stop offset=".45" stop-color="${C.sun}"/><stop offset=".6" stop-color="#FFF4C9"/><stop offset="1" stop-color="#E0A91F"/>
        <animateTransform attributeName="gradientTransform" type="rotate" from="0 .5 .5" to="360 .5 .5" dur="6s" repeatCount="indefinite"/></linearGradient>`
    : '';
  const figure = bhabuSvg({
    face: a.face,
    body: bodyOnGround,
    hat: a.hat,
    prop: 'none',
    dot: a.ground === 'coral' ? 'sun' : 'coral',
    brows: darkGround ? 'light' : 'dark',
    sparks: true,
    bare: true,
    uid,
  });
  const propSvg = prop(a.prop);
  const label = o.title ? `<title>${o.title}</title>` : '';
  const aria = o.title ? `role="img" aria-label="${o.title}"` : 'aria-hidden="true" focusable="false"';
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" ${aria} class="${o.className ?? ''}">${label}
    <defs>${defs}${legendGrad}<clipPath id="cp${uid}"><circle cx="100" cy="100" r="88"/></clipPath></defs>
    <circle cx="100" cy="100" r="88" fill="${fill}"/>
    <g clip-path="url(#cp${uid})"><g transform="translate(44 18) scale(.92)">${figure}${propSvg}</g></g>
    ${ring}
  </svg>`;
}

export const DEFAULT_AVATAR: AvatarConfig = { face: 'wow', hat: 'none', prop: 'none', ground: 'sun', body: 'teal' };

export const FACE_OPTIONS: { id: FaceId; bn: string }[] = [
  { id: 'wow', bn: 'অবাক' },
  { id: 'happy', bn: 'খুশি' },
  { id: 'think', bn: 'ভাবুক' },
  { id: 'wink', bn: 'চোখ টিপি' },
  { id: 'grin', bn: 'হাসিমুখ' },
];
export const HAT_OPTIONS: { id: HatId; bn: string }[] = [
  { id: 'none', bn: 'কিছু না' },
  { id: 'tupi', bn: 'টুপি' },
  { id: 'grad', bn: 'গ্র্যাজুয়েশন ক্যাপ' },
  { id: 'astro', bn: 'নভোচারীর হেলমেট' },
  { id: 'gamchha', bn: 'গামছা' },
];
export const PROP_OPTIONS: { id: PropId; bn: string; badge?: string }[] = [
  { id: 'none', bn: 'কিছু না' },
  { id: 'tube', bn: 'টেস্টটিউব', badge: 'first-quiz' },
  { id: 'magnifier', bn: 'আতশ কাচ', badge: 'myth-buster' },
  { id: 'book', bn: 'বই', badge: 'streak-7' },
  { id: 'telescope', bn: 'টেলিস্কোপ', badge: 'perfect-5' },
];
export const GROUND_OPTIONS: { id: GroundId; bn: string }[] = [
  { id: 'sun', bn: 'হলুদ' },
  { id: 'teal', bn: 'টিল' },
  { id: 'coral', bn: 'কোরাল' },
  { id: 'mint', bn: 'মিন্ট' },
  { id: 'dots', bn: 'বিন্দু' },
  { id: 'stars', bn: 'তারা' },
  { id: 'stripes', bn: 'ডোরা' },
];
export const BODY_OPTIONS: { id: BodyId; bn: string }[] = [
  { id: 'teal', bn: 'টিল' },
  { id: 'coral', bn: 'কোরাল' },
  { id: 'deep', bn: 'গাঢ় টিল' },
];
