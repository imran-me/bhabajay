/**
 * Delight effects: sound (off by default, synthesized — no audio files),
 * confetti in brand colours, and a reduced-motion guard.
 */
import { getState } from './store';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* ───────────── Sound ───────────── */
let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!getState().prefs.sound) return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.12) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

export const sound = {
  pop: () => tone(880, 0, 0.09, 'triangle', 0.1),
  tick: () => tone(1400, 0, 0.03, 'square', 0.03),
  cheer: () => {
    tone(523, 0, 0.12, 'triangle');
    tone(659, 0.08, 0.12, 'triangle');
    tone(784, 0.16, 0.22, 'triangle');
  },
  think: () => {
    tone(330, 0, 0.14, 'sine', 0.08);
    tone(294, 0.12, 0.2, 'sine', 0.07);
  },
  /** brand sound logo: ভা-বা-যা-য়! */
  badge: () => {
    tone(587, 0, 0.1, 'triangle');
    tone(698, 0.1, 0.1, 'triangle');
    tone(880, 0.2, 0.1, 'triangle');
    tone(1175, 0.32, 0.3, 'sine', 0.14);
  },
  whoosh: () => {
    const c = ac();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(1600, c.currentTime + 0.35);
    g.gain.setValueAtTime(0.04, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.4);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.45);
  },
};

/* ───────────── Confetti ───────────── */
const COLORS = ['#FF6B5B', '#FFC93C', '#0B6E79', '#4FC1C9', '#FFFFFF'];

export function confetti(opts: { x?: number; y?: number; count?: number } = {}) {
  if (typeof document === 'undefined' || prefersReducedMotion()) return;
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '90' });
  document.body.appendChild(canvas);
  const g = canvas.getContext('2d')!;
  g.scale(dpr, dpr);
  const ox = opts.x ?? innerWidth / 2;
  const oy = opts.y ?? innerHeight * 0.45;
  const parts = Array.from({ length: opts.count ?? 110 }, () => {
    const a = Math.random() * Math.PI * 2;
    const v = 4 + Math.random() * 9;
    return {
      x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6,
      w: 6 + Math.random() * 7, h: 4 + Math.random() * 5, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
      c: COLORS[(Math.random() * COLORS.length) | 0], shape: Math.random() < 0.25 ? 'star' : Math.random() < 0.5 ? 'dot' : 'rect',
    };
  });
  const start = performance.now();
  function star(x: number, y: number, s: number) {
    g.beginPath();
    g.moveTo(x, y - s);
    g.quadraticCurveTo(x + s * 0.16, y - s * 0.16, x + s, y);
    g.quadraticCurveTo(x + s * 0.16, y + s * 0.16, x, y + s);
    g.quadraticCurveTo(x - s * 0.16, y + s * 0.16, x - s, y);
    g.quadraticCurveTo(x - s * 0.16, y - s * 0.16, x, y - s);
    g.fill();
  }
  function frame(t: number) {
    const el = t - start;
    g.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.32;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      g.globalAlpha = Math.max(0, 1 - el / 1900);
      g.fillStyle = p.c;
      if (p.shape === 'star') star(p.x, p.y, p.w * 0.8);
      else if (p.shape === 'dot') { g.beginPath(); g.arc(p.x, p.y, p.h * 0.6, 0, Math.PI * 2); g.fill(); }
      else { g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore(); }
    }
    if (el < 1900) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}

export function vibrate(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}
