/**
 * Doodle icons = topic icons (atom = physics, leaf = nature, planet = space…).
 * Flat, brand-coloured, 64×64. UI icons (search, share…) live in icons.ts.
 */
import type { DoodleName } from '../data/types';

const T = '#0B6E79', D = '#063C43', CO = '#FF6B5B', S = '#FFC93C', SKY = '#4FB3E0', LEAF = '#3BA56B', W = '#FFFFFF';

const PATHS: Record<DoodleName, string> = {
  atom: `<g fill="none" stroke="${T}" stroke-width="4"><ellipse cx="32" cy="32" rx="27" ry="10"/><ellipse cx="32" cy="32" rx="27" ry="10" transform="rotate(60 32 32)"/><ellipse cx="32" cy="32" rx="27" ry="10" transform="rotate(120 32 32)"/></g><circle cx="32" cy="32" r="7" fill="${CO}"/>`,
  bulb: `<circle cx="32" cy="25" r="17" fill="${S}"/><path d="M24 36 Q32 42 40 36 L39 44 L25 44 Z" fill="${S}"/><rect x="24" y="45" width="16" height="5" rx="2.5" fill="${T}"/><rect x="26" y="52" width="12" height="5" rx="2.5" fill="${T}"/><path d="M24 22 Q26 15 32 14" stroke="${W}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>`,
  butterfly: `<ellipse cx="20" cy="22" rx="14" ry="13" fill="${CO}"/><ellipse cx="44" cy="22" rx="14" ry="13" fill="${CO}"/><ellipse cx="22" cy="44" rx="11" ry="10" fill="${S}"/><ellipse cx="42" cy="44" rx="11" ry="10" fill="${S}"/><rect x="29" y="14" width="6" height="40" rx="3" fill="${T}"/><path d="M30 15 Q26 6 22 5 M34 15 Q38 6 42 5" stroke="${T}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  dna: `<path d="M20 4 C 48 18, 16 46, 44 60" stroke="${T}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M44 4 C 16 18, 48 46, 20 60" stroke="${CO}" stroke-width="5" fill="none" stroke-linecap="round"/><g stroke="#9DB8C9" stroke-width="3" stroke-linecap="round"><line x1="25" y1="11" x2="39" y2="11"/><line x1="29" y1="23" x2="35" y2="23"/><line x1="25" y1="40" x2="39" y2="40"/><line x1="25" y1="53" x2="39" y2="53"/></g>`,
  drop: `<path d="M32 4 C 32 4, 12 28, 12 40 A 20 20 0 0 0 52 40 C 52 28, 32 4, 32 4 Z" fill="${SKY}"/><path d="M22 40 Q 22 48 28 51" stroke="${W}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  eye: `<circle cx="32" cy="32" r="26" fill="none" stroke="${T}" stroke-width="7"/><circle cx="32" cy="32" r="13" fill="${S}"/><circle cx="32" cy="32" r="7" fill="${D}"/><circle cx="35.5" cy="28.5" r="2.6" fill="${W}"/>`,
  fish: `<path d="M8 32 C 18 16, 42 14, 50 32 C 42 50, 18 48, 8 32 Z" fill="${SKY}"/><path d="M48 32 L61 21 L61 43 Z" fill="${SKY}"/><circle cx="20" cy="29" r="3.2" fill="${D}"/><path d="M30 24 Q 34 32 30 40" stroke="${W}" stroke-width="2.5" fill="none" opacity=".7"/>`,
  leaf: `<path d="M32 4 C 52 16, 54 42, 32 60 C 10 42, 12 16, 32 4 Z" fill="${LEAF}"/><path d="M32 12 L32 58 M32 28 L22 20 M32 38 L42 30 M32 46 L23 40" stroke="${W}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  moon: `<path d="M40 6 A 26 26 0 1 0 58 44 A 22 22 0 1 1 40 6 Z" fill="${S}"/>`,
  paw: `<ellipse cx="32" cy="42" rx="13" ry="11" fill="${T}"/><ellipse cx="15" cy="27" rx="6" ry="7.5" fill="${T}"/><ellipse cx="25" cy="16" rx="6" ry="7.5" fill="${T}"/><ellipse cx="39" cy="16" rx="6" ry="7.5" fill="${T}"/><ellipse cx="49" cy="27" rx="6" ry="7.5" fill="${T}"/>`,
  planet: `<circle cx="32" cy="32" r="17" fill="${CO}"/><path d="M18 27 Q 30 24 44 30" stroke="#FF8F82" stroke-width="3" fill="none"/><ellipse cx="32" cy="34" rx="29" ry="8" fill="none" stroke="${S}" stroke-width="4.5" transform="rotate(-14 32 34)"/><path d="M15 32 A17 17 0 0 0 49 32" fill="${CO}" transform="rotate(-14 32 34)"/>`,
  sparkle: `<path d="M32 2 C 34 22, 42 30, 62 32 C 42 34, 34 42, 32 62 C 30 42, 22 34, 2 32 C 22 30, 30 22, 32 2 Z" fill="${S}"/>`,
  mosquito: `<ellipse cx="22" cy="20" rx="13" ry="7" fill="#CFE9F2" transform="rotate(-25 22 20)"/><ellipse cx="38" cy="18" rx="13" ry="7" fill="#CFE9F2" transform="rotate(20 38 18)"/><ellipse cx="32" cy="34" rx="6" ry="14" fill="${D}" transform="rotate(-30 32 34)"/><circle cx="22" cy="24" r="5" fill="${D}"/><line x1="18" y1="27" x2="6" y2="40" stroke="${D}" stroke-width="2.5" stroke-linecap="round"/><g stroke="${D}" stroke-width="2" stroke-linecap="round" fill="none"><path d="M30 38 L22 52 L18 58"/><path d="M34 40 L32 54 L30 60"/><path d="M38 36 L46 50 L52 56"/></g><circle cx="20.5" cy="22.5" r="1.4" fill="${CO}"/>`,
  flask: `<path d="M24 4 L40 4 M27 4 L27 24 L10 54 Q 8 60 14 60 L50 60 Q 56 60 54 54 L37 24 L37 4" fill="${W}" stroke="${D}" stroke-width="3.5" stroke-linejoin="round"/><path d="M17 44 L47 44 L52 54 Q 53 57 50 57 L14 57 Q 11 57 12 54 Z" fill="${T}"/><circle cx="26" cy="50" r="2.5" fill="#BFE3DD"/><circle cx="35" cy="47" r="1.8" fill="#BFE3DD"/>`,
  heart: `<path d="M32 56 C 10 42, 4 30, 8 20 C 12 9, 26 8, 32 18 C 38 8, 52 9, 56 20 C 60 30, 54 42, 32 56 Z" fill="${CO}"/><path d="M14 22 Q 16 15 23 14" stroke="${W}" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".7"/>`,
  bolt: `<path d="M38 2 L12 36 L28 36 L22 62 L52 24 L35 24 Z" fill="${S}" stroke="#E0A91F" stroke-width="2" stroke-linejoin="round"/>`,
  frog: `<ellipse cx="32" cy="40" rx="26" ry="18" fill="${LEAF}"/><circle cx="19" cy="22" r="10" fill="${LEAF}"/><circle cx="45" cy="22" r="10" fill="${LEAF}"/><circle cx="19" cy="22" r="6" fill="${W}"/><circle cx="45" cy="22" r="6" fill="${W}"/><circle cx="20" cy="23" r="3" fill="${D}"/><circle cx="46" cy="23" r="3" fill="${D}"/><path d="M20 42 Q 32 50 44 42" stroke="${D}" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="32" cy="50" rx="7" ry="4" fill="#9ED8AE"/>`,
  pot: `<path d="M22 6 Q 18 12 22 18 M32 4 Q 28 10 32 16 M42 6 Q 38 12 42 18" stroke="#9FB7B5" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="6" y="26" width="52" height="6" rx="3" fill="${D}"/><path d="M10 32 L54 32 L50 54 Q 49 60 43 60 L21 60 Q 15 60 14 54 Z" fill="${T}"/><rect x="2" y="34" width="8" height="5" rx="2.5" fill="${D}"/><rect x="54" y="34" width="8" height="5" rx="2.5" fill="${D}"/><path d="M18 40 L46 40" stroke="${S}" stroke-width="3"/>`,
  telescope: `<g transform="rotate(-28 32 24)"><rect x="8" y="16" width="40" height="14" rx="4" fill="${CO}"/><rect x="44" y="12" width="10" height="22" rx="3" fill="${D}"/><rect x="16" y="16" width="5" height="14" fill="${S}"/></g><path d="M30 34 L18 62 M32 34 L32 62 M34 34 L46 62" stroke="${D}" stroke-width="3.5" stroke-linecap="round"/>`,
  book: `<path d="M4 14 Q 18 6 32 14 L32 56 Q 18 48 4 56 Z" fill="${W}" stroke="${D}" stroke-width="3" stroke-linejoin="round"/><path d="M32 14 Q 46 6 60 14 L60 56 Q 46 48 32 56 Z" fill="${S}" stroke="${D}" stroke-width="3" stroke-linejoin="round"/><path d="M10 24 L26 21 M10 32 L26 29 M10 40 L26 37 M38 22 L54 24" stroke="${T}" stroke-width="2.5" stroke-linecap="round"/>`,
};

export function doodleSvg(name: DoodleName, opts: { className?: string; title?: string } = {}): string {
  const aria = opts.title ? `role="img" aria-label="${opts.title}"` : 'aria-hidden="true" focusable="false"';
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" ${aria} class="${opts.className ?? ''}">${PATHS[name] ?? PATHS.sparkle}</svg>`;
}

export const DOODLE_FOR_TOPIC: Record<string, DoodleName> = {
  food: 'pot',
  health: 'heart',
  nature: 'leaf',
  space: 'planet',
  chemistry: 'flask',
  biology: 'dna',
  physics: 'atom',
  body: 'heart',
  history: 'book',
  tech: 'bolt',
};
