"""Mobile/desktop layout check for the built site.

Usage:
  npm run build && npm run preview      (in another terminal; default http://localhost:4321)
  python tests/ui_check.py [--base URL] [--routes /,/about] [--shots DIR] [--widths 320,360]

For each route x width it fails on:
  - horizontal page scroll (scrollWidth > innerWidth)
  - an element whose right edge pokes past the viewport (text/box overflow)
  - a visible link/button/input whose centre is covered by another element
    (fixed bars, overlays, mascots), after scrolling it into view
  - tap targets smaller than 44x44 px in the mobile widths (reported as warnings;
    inline text links inside paragraphs are skipped)
Exit code 1 when any failure is found.
"""
import argparse, sys, json
from pathlib import Path
from playwright.sync_api import sync_playwright

DEFAULT_ROUTES = [
    '/', '/about', '/series', '/series/rannagharer-biggan', '/myth', '/journal', '/mentors', '/teachers',
    '/wall-of-fame', '/bhabur-duniya', '/code-of-conduct', '/privacy', '/404', '/contact', '/ask',
]
WIDTHS = [320, 360, 390, 414, 768, 1024, 1440]

JS = r"""
() => {
  const W = innerWidth, out = { hscroll: 0, overflow: [], covered: [], small: [] };
  out.hscroll = document.scrollingElement.scrollWidth - W;
  const vis = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect();
    return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && r.width > 0 && r.height > 0; };
  const name = (el) => (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '') + ' "' + (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30) + '"');
  // overflow past right edge (ignore elements inside horizontal scrollers / clipped parents)
  const clipped = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return true; } return false; };
  for (const el of document.body.querySelectorAll('*')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > W + 1 && !clipped(el) && getComputedStyle(el).position !== 'fixed') out.overflow.push(name(el) + ' right=' + Math.round(r.right));
    if (out.overflow.length > 8) break;
  }
  return out;
}
"""

TARGETS = r"""
(mobile) => {
  const res = { covered: [], small: [] };
  const els = [...document.querySelectorAll('a[href], button, input, select, textarea, [role=button], summary')];
  const name = (el) => el.tagName.toLowerCase() + ' "' + ((el.innerText || el.getAttribute('aria-label') || el.getAttribute('name') || el.getAttribute('href') || '').trim().slice(0, 30)) + '"';
  for (const el of els) {
    const s = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (s.visibility === 'hidden' || s.display === 'none' || r.width < 2 || r.height < 2 || el.closest('[hidden],[aria-hidden=true],dialog:not([open])')) continue;
    if (s.position === 'fixed' || el.closest('[data-bottom-tabs],[data-topbar]')) continue;
    // the hidden side of a flip card is not tappable by design
    if (el.closest('.flip:not(.is-flipped) .flip-back, .flip.is-flipped .flip-front')) continue;
    if (!el.matches('summary') && el.closest('details:not([open])') && !el.closest('summary')) continue;
    el.scrollIntoView({ block: 'center' });
    const q = el.getBoundingClientRect();
    if (q.bottom < 0 || q.top > innerHeight || q.right < 0 || q.left > innerWidth) continue;
    const x = Math.min(Math.max(q.left + q.width / 2, 1), innerWidth - 1), y = Math.min(Math.max(q.top + q.height / 2, 1), innerHeight - 1);
    const hit = document.elementFromPoint(x, y);
    if (hit && hit.closest('[role=status],[data-transient]') && getComputedStyle(hit.closest('[role=status],[data-transient]')).pointerEvents === 'none') continue;
    if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
      // a label wrapping the input is fine
      if (!(hit.tagName === 'LABEL' && hit.contains(el)) && !(el.labels && [...el.labels].includes(hit)))
        res.covered.push(name(el) + ' under ' + hit.tagName.toLowerCase() + '.' + String(hit.className).split(' ').slice(0, 3).join('.'));
    }
    if (mobile) {
      const inline = el.tagName === 'A' && el.closest('p, li > p, .prose') && s.display === 'inline';
      if (!inline && (q.width < 40 || q.height < 40)) res.small.push(name(el) + ` ${Math.round(q.width)}x${Math.round(q.height)}`);
    }
    if (res.covered.length > 10) break;
  }
  return res;
}
"""


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='http://localhost:4321', help='the URL `npm run preview` printed (port may differ)')
    ap.add_argument('--routes', default=','.join(DEFAULT_ROUTES))
    ap.add_argument('--widths', default=','.join(map(str, WIDTHS)))
    ap.add_argument('--shots', default='')
    ap.add_argument('--strict-taps', action='store_true', help='treat small tap targets as failures')
    a = ap.parse_args()
    fails, warns = [], []
    shots = Path(a.shots) if a.shots else None
    if shots:
        shots.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        for w in map(int, a.widths.split(',')):
            ctx = b.new_context(viewport={'width': w, 'height': 800 if w < 768 else 900}, is_mobile=w < 768, has_touch=w < 1024,
                                device_scale_factor=1, reduced_motion='reduce')
            page = ctx.new_page()
            for route in a.routes.split(','):
                tag = f'{route} @{w}'
                try:
                    page.goto(a.base + route, wait_until='networkidle', timeout=30000)
                except Exception as e:
                    fails.append(f'{tag}: load failed {e}')
                    continue
                page.wait_for_timeout(300)
                r = page.evaluate(JS)
                if r['hscroll'] > 0:
                    fails.append(f'{tag}: horizontal scroll {r["hscroll"]}px')
                for o in r['overflow']:
                    fails.append(f'{tag}: overflow {o}')
                t = page.evaluate(TARGETS, w < 768)
                for c in t['covered']:
                    fails.append(f'{tag}: covered {c}')
                for s in t['small'][:6]:
                    (fails if a.strict_taps else warns).append(f'{tag}: small tap target {s}')
                if shots:
                    page.evaluate('scrollTo(0,0)')
                    page.screenshot(path=str(shots / f'{route.strip("/").replace("/", "_") or "home"}-{w}.png'), full_page=True)
            ctx.close()
        b.close()
    for x in warns:
        print('WARN', x)
    for x in fails:
        print('FAIL', x)
    print(f'{len(fails)} failures, {len(warns)} warnings')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
