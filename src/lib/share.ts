/**
 * Sharing: Messenger/WhatsApp forwards are the real distribution (Research 01).
 * Share sheet order: WhatsApp, Messenger, Facebook, copy link, download card.
 * On phones we use the native share sheet.
 *
 * Share cards are drawn on <canvas> in the browser so Bangla conjuncts are
 * shaped by the browser's own text engine (HarfBuzz) — readable at thumbnail size.
 */
import { bhabuSvg, C } from './bhabu';
import { countShare } from './store';

export interface ShareData {
  url: string;
  title: string;
  text?: string;
}

export const absolute = (url: string) => (url.startsWith('http') ? url : `${location.origin}${url}`);

export const shareTargets = (d: ShareData) => {
  const url = absolute(d.url);
  const msg = `${d.text ?? d.title}\n${url}`;
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(msg)}`,
    messenger: isMobile ? `fb-messenger://share/?link=${encodeURIComponent(url)}` : `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  };
};

export async function nativeShare(d: ShareData, file?: File): Promise<boolean> {
  if (!navigator.share) return false;
  try {
    const payload: globalThis.ShareData = { title: d.title, text: d.text ?? d.title, url: absolute(d.url) };
    if (file && navigator.canShare?.({ files: [file] })) payload.files = [file];
    await navigator.share(payload);
    countShare();
    return true;
  } catch (e) {
    return (e as DOMException)?.name === 'AbortError';
  }
}

export async function copyLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(absolute(url));
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = absolute(url);
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/* ───────────── Canvas share card (1:1, 1080×1080) ───────────── */

export interface CardSpec {
  kind: 'myth' | 'quiz' | 'post' | 'fame' | 'thought';
  verdict?: 'true' | 'myth' | 'partial';
  eyebrow?: string;
  title: string;
  line?: string;
  source?: string;
  big?: string;
  url?: string;
}

const VERDICT = {
  true: { label: 'সত্য!', color: C.teal },
  myth: { label: 'মিথ!', color: '#E5503F' },
  partial: { label: 'আংশিক!', color: '#B07A00' },
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export async function renderCard(spec: CardSpec): Promise<Blob> {
  const S = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const g = canvas.getContext('2d')!;
  await Promise.all([
    document.fonts.load('700 64px "Anek Bangla Variable"', 'অআক'),
    document.fonts.load('500 40px "Anek Bangla Variable"', 'অআক'),
    document.fonts.load('800 60px "Baloo Da 2"', 'ভাবা'),
    document.fonts.load('800 80px "Anek Condensed"', 'মিথ'),
  ]).catch(() => undefined);

  const dark = spec.kind === 'fame' || spec.kind === 'quiz';
  g.fillStyle = dark ? C.teal : C.warm;
  g.fillRect(0, 0, S, S);
  try {
    const pat = await loadImage(dark ? '/patterns/teal.svg' : '/patterns/warm.svg');
    const p = g.createPattern(pat, 'repeat');
    if (p) {
      g.save();
      g.scale(1.6, 1.6);
      g.fillStyle = p;
      g.fillRect(0, 0, S, S);
      g.restore();
    }
  } catch {
    /* pattern optional */
  }

  // text plate (Playbook: patterns stay behind solid plates)
  g.fillStyle = dark ? 'rgba(6,60,67,.92)' : 'rgba(255,255,255,.94)';
  roundRect(g, 70, 150, S - 140, 640, 48);
  g.fill();

  const ink = dark ? '#FFFFFF' : C.deep;
  let y = 250;

  if (spec.verdict) {
    const v = VERDICT[spec.verdict];
    g.save();
    g.translate(150, 200);
    g.rotate(-0.1);
    g.font = '800 84px "Anek Condensed", "Anek Bangla Variable"';
    const w = g.measureText(v.label).width + 60;
    g.lineWidth = 9;
    g.strokeStyle = v.color;
    g.fillStyle = '#fff';
    roundRect(g, -10, -84, w, 120, 22);
    g.fill();
    g.stroke();
    g.fillStyle = v.color;
    g.fillText(v.label, 20, 4);
    g.restore();
    y = 380;
  } else if (spec.eyebrow) {
    g.font = '700 40px "Anek Bangla Variable"';
    g.fillStyle = dark ? C.sun : '#D94A3B';
    g.fillText(spec.eyebrow, 130, 240);
    y = 330;
  }

  if (spec.big) {
    g.font = '800 170px "Baloo Da 2", "Anek Bangla Variable"';
    g.fillStyle = C.sun;
    g.fillText(spec.big, 124, y + 110);
    y += 200;
  }

  g.font = `700 ${spec.title.length > 60 ? 58 : 68}px "Anek Bangla Variable"`;
  g.fillStyle = ink;
  const lines = wrap(g, spec.title, S - 280).slice(0, 4);
  for (const l of lines) {
    g.fillText(l, 130, y);
    y += spec.title.length > 60 ? 86 : 98;
  }

  if (spec.line) {
    g.font = '500 38px "Anek Bangla Variable"';
    g.fillStyle = dark ? '#CFE9E6' : '#436E73';
    for (const l of wrap(g, spec.line, S - 300).slice(0, 3)) {
      g.fillText(l, 130, y + 12);
      y += 58;
    }
  }
  if (spec.source) {
    g.font = '700 34px "Anek Bangla Variable"';
    g.fillStyle = dark ? C.sun : C.teal;
    g.fillText(`সূত্র: ${spec.source}`, 130, Math.min(y + 50, 760));
  }

  // logo bottom-left (never touched by doodles)
  g.font = '800 64px "Baloo Da 2", "Anek Bangla Variable"';
  g.fillStyle = dark ? '#fff' : C.teal;
  g.fillText('ভাবা', 90, 950);
  const w1 = g.measureText('ভাবা ').width;
  g.fillStyle = C.coral;
  g.fillText('যায়!', 90 + w1, 950);
  g.font = '600 30px "Inter Variable", sans-serif';
  g.fillStyle = dark ? '#CFE9E6' : '#436E73';
  g.fillText((spec.url ?? 'bhabajay.com').replace(/^https?:\/\//, ''), 92, 1000);

  // ভাবু reacting, bottom-right
  const face = spec.verdict === 'myth' ? 'wow' : spec.verdict === 'partial' ? 'think' : 'happy';
  const svg = bhabuSvg({ face, body: dark ? 'coral' : 'teal', dot: dark ? 'sun' : 'coral', brows: dark ? 'light' : 'dark' }).replace('<svg ', '<svg width="240" height="380" ');
  try {
    const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    g.drawImage(img, S - 290, S - 420, 220, 348);
  } catch {
    /* ignore */
  }

  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}
