/**
 * Build-time OG images (1200×630) and app icons.
 *
 * Bangla needs real OpenType shaping (pre-base vowel reordering, conjuncts,
 * reph). We shape every string with HarfBuzz (harfbuzzjs, WASM), turn the
 * shaped glyphs into SVG paths, and let resvg rasterise paths only — no text
 * layout in resvg, no shaping bugs. Fonts: full OFL TTFs in scripts/og-fonts.
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import hbPromise from 'harfbuzzjs';
import { bhabuSvg } from './bhabu';

type FontKey = 'bold' | 'medium' | 'display' | 'stamp';
const FILES: Record<FontKey, string> = {
  bold: 'HindSiliguri-Bold.ttf',
  medium: 'HindSiliguri-Medium.ttf',
  display: 'BalooDa2-ExtraBold.ttf',
  stamp: 'AnekBangla-CondensedExtraBold.ttf',
};
const FONT_DIR = join(process.cwd(), 'scripts', 'og-fonts');

/* eslint-disable @typescript-eslint/no-explicit-any */
let ready: Promise<{ hb: any; fonts: Record<FontKey, { font: any; upem: number }> }> | null = null;
function init() {
  ready ??= (hbPromise as unknown as Promise<any>).then((hb) => {
    const fonts = {} as Record<FontKey, { font: any; upem: number }>;
    (Object.keys(FILES) as FontKey[]).forEach((k) => {
      const blob = hb.createBlob(readFileSync(join(FONT_DIR, FILES[k])));
      const face = hb.createFace(blob, 0);
      fonts[k] = { font: hb.createFont(face), upem: face.upem };
    });
    return { hb, fonts };
  });
  return ready;
}

const pathCache = new Map<string, string>();
type Shaped = { g: number; ax: number; dx: number; dy: number }[];

async function shaper() {
  const { hb, fonts } = await init();
  const shape = (k: FontKey, text: string): Shaped => {
    const buf = hb.createBuffer();
    buf.addText(text);
    buf.guessSegmentProperties();
    hb.shape(fonts[k].font, buf);
    const r = buf.json() as Shaped;
    buf.destroy();
    return r;
  };
  const measure = (k: FontKey, text: string, size: number) => (shape(k, text).reduce((a, g) => a + g.ax, 0) * size) / fonts[k].upem;
  const draw = (k: FontKey, text: string, size: number, x: number, y: number, fill: string) => {
    const { font, upem } = fonts[k];
    const s = size / upem;
    let pen = 0;
    let out = '';
    for (const g of shape(k, text)) {
      const key = `${k}:${g.g}`;
      let d = pathCache.get(key);
      if (d === undefined) {
        d = font.glyphToPath(g.g) as string;
        pathCache.set(key, d);
      }
      if (d) out += `<path d="${d}" transform="translate(${(x + (pen + g.dx) * s).toFixed(2)} ${(y - g.dy * s).toFixed(2)}) scale(${s.toFixed(5)} ${(-s).toFixed(5)})"/>`;
      pen += g.ax;
    }
    return { svg: `<g fill="${fill}">${out}</g>`, width: pen * s };
  };
  const wrap = (k: FontKey, text: string, size: number, max: number, maxLines: number) => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (measure(k, t, size) > max && line) {
        lines.push(line);
        line = w;
      } else line = t;
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      const cut = lines.slice(0, maxLines);
      cut[maxLines - 1] = cut[maxLines - 1].replace(/\s*\S+$/, '') + '…';
      return cut;
    }
    return lines;
  };
  return { draw, measure, wrap };
}

export type OgSpec = {
  eyebrow: string;
  title: string;
  line?: string;
  verdict?: 'true' | 'myth' | 'partial';
  theme?: 'warm' | 'teal';
  face?: 'wow' | 'happy' | 'think' | 'wink' | 'grin';
};

const STAMP = { true: { t: 'সত্য!', c: '#0B6E79' }, myth: { t: 'মিথ!', c: '#E5503F' }, partial: { t: 'আংশিক!', c: '#B07A00' } };

function decor(dark: boolean) {
  const a = dark ? '#FFFFFF' : '#0B6E79';
  const s = (x: number, y: number, r: number, c: string, o: number) =>
    `<path transform="translate(${x} ${y})" d="M0 ${-r} Q ${r * 0.16} ${-r * 0.16} ${r} 0 Q ${r * 0.16} ${r * 0.16} 0 ${r} Q ${-r * 0.16} ${r * 0.16} ${-r} 0 Q ${-r * 0.16} ${-r * 0.16} 0 ${-r} Z" fill="${c}" opacity="${o}"/>`;
  return [
    s(860, 80, 22, '#FFC93C', 1), s(1140, 140, 14, a, 0.45), s(1090, 560, 18, '#FF6B5B', 0.7), s(830, 520, 10, a, 0.4),
    `<circle cx="1160" cy="300" r="7" fill="#FFC93C"/><circle cx="960" cy="600" r="6" fill="${a}" opacity=".35"/>`,
    `<path d="M1010 70 q 9 -12 18 0 t 18 0" stroke="#FF6B5B" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>`,
  ].join('');
}

export async function ogSvg(o: OgSpec): Promise<string> {
  const { draw, measure, wrap } = await shaper();
  const dark = o.theme === 'teal';
  const bg = dark ? '#0B6E79' : '#FFFBF4';
  const plate = dark ? '#063C43' : '#FFFFFF';
  const ink = dark ? '#FFFFFF' : '#063C43';
  const soft = dark ? '#CFE9E6' : '#436E73';
  const tSize = o.title.length > 48 ? 50 : 58;
  const parts: string[] = [];

  let y: number;
  if (o.verdict) {
    const st = STAMP[o.verdict];
    const w = measure('stamp', st.t, 56) + 56;
    parts.push(`<g transform="translate(100 112) rotate(-6)"><rect x="0" y="0" width="${w}" height="86" rx="16" fill="#fff" stroke="${st.c}" stroke-width="7"/>${draw('stamp', st.t, 56, 28, 64, st.c).svg}</g>`);
    parts.push(draw('bold', o.eyebrow, 28, 100 + w + 34, 176, '#D94A3B').svg);
    y = 262;
  } else {
    parts.push(draw('bold', o.eyebrow, 30, 100, 140, dark ? '#FFC93C' : '#D94A3B').svg);
    y = 218;
  }
  for (const l of wrap('bold', o.title, tSize, 640, 3)) {
    parts.push(draw('bold', l, tSize, 100, y, ink).svg);
    y += tSize * 1.34;
  }
  y += 4;
  if (o.line) {
    for (const l of wrap('medium', o.line, 28, 650, 2)) {
      if (y > 470) break;
      parts.push(draw('medium', l, 28, 100, y, soft).svg);
      y += 42;
    }
  }
  const logo1 = draw('display', 'ভাবা', 46, 100, 532, dark ? '#FFFFFF' : '#0B6E79');
  const logo2 = draw('display', 'যায়!', 46, 100 + logo1.width + 12, 532, '#FF6B5B');
  parts.push(logo1.svg, logo2.svg, draw('bold', 'bhabajay.com', 24, 100 + logo1.width + logo2.width + 40, 528, soft).svg);

  const figure = bhabuSvg({ face: o.face ?? (o.verdict === 'myth' ? 'wow' : o.verdict === 'partial' ? 'think' : 'happy'), body: dark ? 'coral' : 'teal', dot: dark ? 'sun' : 'coral', brows: dark ? 'light' : 'dark', bare: true, uid: 'og' });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="${bg}"/>${decor(dark)}
    <rect x="60" y="56" width="760" height="518" rx="40" fill="${plate}"/>
    ${parts.join('')}
    <g transform="translate(860 110) scale(2.3)">${figure}</g>
  </svg>`;
}

export async function renderOgPng(o: OgSpec): Promise<Buffer> {
  const svg = await ogSvg(o);
  return new Resvg(svg, { font: { loadSystemFonts: false }, fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}

/** App icon (PWA): ভাবু on a teal ground */
export function renderIconPng(size: number): Buffer {
  const fig = bhabuSvg({ face: 'wow', body: 'coral', dot: 'sun', brows: 'light', bare: true, uid: 'ic' });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="${size >= 512 ? 0 : 110}" fill="#0B6E79"/><g transform="translate(118 40) scale(2.3)">${fig}</g></svg>`;
  return new Resvg(svg, { font: { loadSystemFonts: false }, fitTo: { mode: 'width', value: size } }).render().asPng();
}
