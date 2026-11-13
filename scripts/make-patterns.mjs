#!/usr/bin/env node
/** Generates public/patterns/{warm,mint,teal}.svg — the Playbook doodle grounds. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'patterns');
mkdirSync(out, { recursive: true });

const sparkle = (x, y, s, fill, op = 1) =>
  `<path transform="translate(${x} ${y})" d="M0 ${-s} Q ${s * 0.16} ${-s * 0.16} ${s} 0 Q ${s * 0.16} ${s * 0.16} 0 ${s} Q ${-s * 0.16} ${s * 0.16} ${-s} 0 Q ${-s * 0.16} ${-s * 0.16} 0 ${-s} Z" fill="${fill}" opacity="${op}"/>`;
const dot = (x, y, r, fill, op = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${op}"/>`;
const squiggle = (x, y, stroke, op = 1, rot = 0) =>
  `<path transform="translate(${x} ${y}) rotate(${rot})" d="M0 0 q 4.5 -6 9 0 t 9 0" fill="none" stroke="${stroke}" stroke-width="2.6" stroke-linecap="round" opacity="${op}"/>`;
const burst = (x, y, stroke, op = 1) =>
  `<g transform="translate(${x} ${y})" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round" opacity="${op}"><line x1="0" y1="0" x2="-4" y2="-7"/><line x1="6" y1="-2" x2="6" y2="-10"/><line x1="12" y1="0" x2="16" y2="-7"/></g>`;
const mini = (x, y, body, dotC, op = 1, rot = 12) =>
  `<g transform="translate(${x} ${y}) rotate(${rot})" opacity="${op}"><path d="M-5.5 -9 C -5.5 -15 6.5 -15 6.5 -9 C 6.5 -5 2.5 4 1.8 6.5 C 1.4 8 -0.6 8 -1 6.5 C -1.8 4 -5.5 -5 -5.5 -9 Z" fill="${body}"/><circle cx="-2" cy="-8.5" r="2.2" fill="#fff"/><circle cx="2.6" cy="-9" r="2.2" fill="#fff"/><circle cx="-1.6" cy="-8.1" r="1" fill="#063C43"/><circle cx="3" cy="-8.6" r="1" fill="#063C43"/><circle cx="0.4" cy="12" r="2.6" fill="${dotC}"/></g>`;

function tile(c) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 260 260">
${sparkle(28, 30, 9, c.spark, c.sparkOp)}
${dot(84, 22, 3, c.dotA, c.dotOp)}
${squiggle(120, 34, c.squig, c.squigOp)}
${mini(196, 34, c.mini, c.miniDot, c.miniOp)}
${sparkle(236, 72, 6, c.spark2, c.sparkOp)}
${dot(58, 82, 2.4, c.dotB, c.dotOp)}
${burst(100, 96, c.burst, c.burstOp)}
${sparkle(156, 92, 11, c.spark, c.sparkOp)}
${dot(214, 118, 3.2, c.dotA, c.dotOp)}
${mini(30, 140, c.mini2, c.miniDot2, c.miniOp, -8)}
${squiggle(78, 150, c.squig2, c.squigOp, -12)}
${sparkle(132, 160, 6.5, c.spark2, c.sparkOp)}
${dot(178, 150, 2.4, c.dotB, c.dotOp)}
${squiggle(204, 172, c.squig, c.squigOp, 8)}
${sparkle(52, 214, 7, c.spark2, c.sparkOp)}
${dot(110, 206, 3, c.dotA, c.dotOp)}
${burst(150, 228, c.burst, c.burstOp)}
${sparkle(226, 226, 9, c.spark, c.sparkOp)}
${dot(10, 186, 2.2, c.dotB, c.dotOp)}
${mini(176, 236, c.mini, c.miniDot, c.miniOp, 18)}
</svg>`;
}

const variants = {
  warm: { spark: '#0B6E79', spark2: '#FF6B5B', sparkOp: 0.28, dotA: '#FFC93C', dotB: '#0B6E79', dotOp: 0.55, squig: '#FF6B5B', squig2: '#FFC93C', squigOp: 0.45, burst: '#FF6B5B', burstOp: 0.4, mini: '#FF6B5B', mini2: '#0B6E79', miniDot: '#FFC93C', miniDot2: '#FF6B5B', miniOp: 0.42 },
  mint: { spark: '#0B6E79', spark2: '#FF6B5B', sparkOp: 0.3, dotA: '#FFC93C', dotB: '#FF6B5B', dotOp: 0.6, squig: '#FF6B5B', squig2: '#0B6E79', squigOp: 0.45, burst: '#FF6B5B', burstOp: 0.45, mini: '#0B6E79', mini2: '#FF6B5B', miniDot: '#FF6B5B', miniDot2: '#FFC93C', miniOp: 0.45 },
  teal: { spark: '#FFFFFF', spark2: '#FFC93C', sparkOp: 0.55, dotA: '#FFC93C', dotB: '#3E9AA3', dotOp: 0.7, squig: '#FF6B5B', squig2: '#FFC93C', squigOp: 0.6, burst: '#FF6B5B', burstOp: 0.6, mini: '#FF6B5B', mini2: '#FF6B5B', miniDot: '#FFC93C', miniDot2: '#FFC93C', miniOp: 0.55 },
};

for (const [name, c] of Object.entries(variants)) {
  writeFileSync(join(out, `${name}.svg`), tile(c));
}
console.log('patterns written to', out);
