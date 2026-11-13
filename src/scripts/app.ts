/**
 * Global behaviour for every page (vanilla, no framework → tiny & fast on 3G).
 * React islands handle the heavy interactive pages (quiz, pitch, ID, profile).
 */
import {
  getState, subscribe, setPref, setFlag, currentStreak, toast, countShare,
  toggleSave, toggleFollow, toggleLike, isSaved, markMythRead, type Notice,
} from '../lib/store';
import { sound, confetti, prefersReducedMotion, vibrate } from '../lib/fx';
import { iconSvg, flameSvg } from '../lib/icons';
import { bhabuSvg } from '../lib/bhabu';
import { bn } from '../lib/bn';
import { dhakaDay, thoughtIndex } from '../lib/time';
import { shareTargets, nativeShare, copyLink, renderCard, downloadBlob, type CardSpec } from '../lib/share';
import { getBackend } from '../lib/backend';

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
const today = dhakaDay();
const path = location.pathname;

/* ───────────── Theme + language ───────────── */
function applyPrefs() {
  const { theme, lang } = getState().prefs;
  const d = document.documentElement;
  if (theme === 'system') d.removeAttribute('data-theme');
  else d.setAttribute('data-theme', theme);
  d.setAttribute('data-lang', lang);
  $$('[data-theme-set]').forEach((b) => {
    const on = b.dataset.themeSet === theme;
    b.setAttribute('aria-checked', String(on));
    b.classList.toggle('bg-surface', on);
    b.classList.toggle('shadow-sm', on);
  });
  $$('[data-lang-set]').forEach((b) => {
    const on = b.dataset.langSet === lang;
    b.setAttribute('aria-checked', String(on));
    b.classList.toggle('bg-surface', on);
    b.classList.toggle('shadow-sm', on);
  });
}
$$('[data-theme-set]').forEach((b) => b.addEventListener('click', () => { setPref('theme', b.dataset.themeSet as 'system'); applyPrefs(); }));
$$('[data-lang-set]').forEach((b) => b.addEventListener('click', () => { setPref('lang', b.dataset.langSet as 'bn'); applyPrefs(); }));

/* ───────────── Menu dialog ───────────── */
const menu = $<HTMLDialogElement>('#bj-menu');
$$('[data-menu-open]').forEach((b) => b.addEventListener('click', () => menu?.showModal()));
$$('[data-menu-close]').forEach((b) => b.addEventListener('click', () => menu?.close()));
menu?.addEventListener('click', (e) => { if (e.target === menu) menu.close(); });

/* ───────────── Sound toggle (off by default) ───────────── */
function applySound() {
  const on = getState().prefs.sound;
  $$('[data-sound-toggle]').forEach((b) => {
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'শব্দ বন্ধ করো' : 'শব্দ চালু করো');
    $('[data-sound-on]', b)?.toggleAttribute('hidden', !on);
    $('[data-sound-off]', b)?.toggleAttribute('hidden', on);
  });
}
$$('[data-sound-toggle]').forEach((b) =>
  b.addEventListener('click', () => {
    setPref('sound', !getState().prefs.sound);
    applySound();
    if (getState().prefs.sound) sound.badge();
  }),
);

/* ───────────── Streak flame / login, notices, account ───────────── */
function applyIdentity() {
  const s = getState();
  const streak = currentStreak(s);
  $$('[data-streak-slot]').forEach((slot) => {
    if (s.user || streak > 0) {
      slot.innerHTML = `<a href="/me" class="inline-flex h-9 items-center gap-1 rounded-xl px-2.5 font-bold text-ink hover:bg-tint" aria-label="${bn(streak)} দিনের স্ট্রিক — আমার পেজ">${flameSvg(streak, 'w-6 h-6')}<span class="text-[1.05rem]">${bn(streak)}</span></a>`;
    }
  });
  const unread = s.notices.filter((n) => !n.read).length;
  $$('[data-notice-dot]').forEach((d) => d.toggleAttribute('hidden', unread === 0));
  const sub = $('[data-menu-account-sub]');
  if (sub && s.user) sub.textContent = `${s.user.nickname} · ${bn(s.points)} পয়েন্ট`;
}

/* ───────────── Toasts — ভাবু reacts ───────────── */
const toasts = $('#bj-toasts');
window.addEventListener('bj:toast', (e) => {
  const d = (e as CustomEvent).detail as { message: string; mood?: Notice['mood']; kind?: string; href?: string };
  if (!toasts) return;
  const el = document.createElement(d.href ? 'a' : 'div');
  if (d.href) (el as HTMLAnchorElement).href = d.href;
  const badge = d.kind === 'badge';
  el.className = `pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl px-3 py-2.5 pr-4 font-semibold shadow-[0_12px_30px_-12px_rgb(6_60_67/.5)] reveal-up ${badge ? 'bg-sun text-deep' : d.kind === 'error' ? 'bg-coral text-white' : 'bg-deep text-white'}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="w-7 shrink-0">${bhabuSvg({ face: d.mood ?? (badge ? 'wow' : 'happy'), body: badge ? 'teal' : 'coral', dot: badge ? 'coral' : 'sun', brows: badge ? 'dark' : 'light', sparks: badge, className: 'w-full h-auto' })}</span><span class="leading-snug">${d.message}</span>`;
  toasts.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s, transform .3s'; el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; }, 3800);
  setTimeout(() => el.remove(), 4200);
});
window.addEventListener('bj:badge', () => {
  sound.badge();
  confetti({ count: 70, y: innerHeight * 0.75 });
  vibrate(20);
});

/* ───────────── Logo easter egg: tap "!" 7 times → ভাবু spins ───────────── */
let taps = 0;
let tapTimer: number | undefined;
$$('[data-logo-bang]').forEach((b) =>
  b.addEventListener('click', () => {
    taps++;
    sound.tick();
    clearTimeout(tapTimer);
    tapTimer = window.setTimeout(() => (taps = 0), 1800);
    if (taps >= 7) {
      taps = 0;
      const svg = $('svg', b);
      svg?.classList.remove('spin-once');
      void (svg as unknown as HTMLElement)?.offsetWidth;
      svg?.classList.add('spin-once');
      sound.whoosh();
      toast('উফ! মাথা ঘুরছে… ভাবা যায়! 😵‍💫', { mood: 'wow' });
    }
  }),
);

/* ───────────── Share sheet ───────────── */
const shareDlg = $<HTMLDialogElement>('#bj-share');
let currentShare: { url: string; title: string; text?: string; card?: CardSpec } | null = null;
const coarse = matchMedia('(pointer: coarse)').matches;

async function openShare(btn: HTMLElement) {
  const url = btn.dataset.shareUrl || location.pathname;
  const title = btn.dataset.shareTitle || document.title;
  const text = btn.dataset.shareText;
  let card: CardSpec | undefined;
  try { card = btn.dataset.card ? JSON.parse(btn.dataset.card) : undefined; } catch { /* ignore */ }
  currentShare = { url, title, text, card };
  if (coarse && 'share' in navigator && !btn.hasAttribute('data-share-sheet')) {
    const ok = await nativeShare({ url, title, text });
    if (ok) return;
  }
  if (!shareDlg) return;
  const t = shareTargets({ url, title, text });
  ($('[data-share-wa]', shareDlg) as HTMLAnchorElement).href = t.whatsapp;
  ($('[data-share-ms]', shareDlg) as HTMLAnchorElement).href = t.messenger;
  ($('[data-share-fb]', shareDlg) as HTMLAnchorElement).href = t.facebook;
  $('[data-share-preview]', shareDlg)!.textContent = title;
  $('[data-share-card]', shareDlg)!.toggleAttribute('hidden', !card);
  $('[data-share-native]', shareDlg)!.toggleAttribute('hidden', !('share' in navigator));
  $('[data-copy-label]', shareDlg)!.textContent = 'লিংক কপি';
  shareDlg.showModal();
}
document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-share]');
  if (btn) { e.preventDefault(); void openShare(btn); }
});
if (shareDlg) {
  shareDlg.addEventListener('click', (e) => { if (e.target === shareDlg) shareDlg.close(); });
  $('[data-share-close]', shareDlg)?.addEventListener('click', () => shareDlg.close());
  $$('[data-share-wa],[data-share-ms],[data-share-fb]', shareDlg).forEach((a) => a.addEventListener('click', () => { countShare(); setTimeout(() => shareDlg.close(), 200); }));
  $('[data-share-copy]', shareDlg)?.addEventListener('click', async () => {
    if (!currentShare) return;
    const ok = await copyLink(currentShare.url);
    $('[data-copy-label]', shareDlg)!.textContent = ok ? 'কপি হয়েছে ✓' : 'হলো না';
    if (ok) countShare();
  });
  $('[data-share-native]', shareDlg)?.addEventListener('click', async () => {
    if (currentShare) await nativeShare(currentShare);
  });
  $('[data-share-card]', shareDlg)?.addEventListener('click', async () => {
    if (!currentShare?.card) return;
    const label = $('[data-card-label]', shareDlg)!;
    label.textContent = 'বানাচ্ছি…';
    try {
      const blob = await renderCard({ ...currentShare.card, url: location.host + currentShare.url });
      downloadBlob(blob, `bhabajay-${currentShare.url.split('/').filter(Boolean).pop() || 'card'}.png`);
      label.textContent = 'নেমেছে ✓';
      countShare();
    } catch {
      label.textContent = 'আবার চেষ্টা';
    }
  });
}

/* ───────────── Save · Like · Follow ───────────── */
function setToggle(btn: HTMLElement, on: boolean) {
  btn.setAttribute('aria-pressed', String(on));
  const label = $('[data-label]', btn);
  if (label) label.textContent = on ? btn.dataset.onLabel ?? '' : btn.dataset.offLabel ?? '';
}
function syncToggles() {
  const s = getState();
  $$('[data-save]').forEach((b) => { const [type, id] = b.dataset.save!.split(':'); setToggle(b, isSaved(type, id)); });
  $$('[data-like]').forEach((b) => setToggle(b, s.likes.includes(b.dataset.like!)));
  $$('[data-follow]').forEach((b) => setToggle(b, s.follows.includes(b.dataset.follow!)));
}
document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const save = t.closest<HTMLElement>('[data-save]');
  if (save) {
    const [type, id] = save.dataset.save!.split(':');
    const on = toggleSave(type as 'post', id);
    sound.pop();
    toast(on ? 'সেভ হয়েছে — "আমি" পেজে পাবে' : 'সেভ থেকে সরানো হলো', { mood: on ? 'happy' : 'think', href: on ? '/me#saved' : undefined });
    syncToggles();
    return;
  }
  const like = t.closest<HTMLElement>('[data-like]');
  if (like) {
    const on = toggleLike(like.dataset.like!);
    if (on) { sound.pop(); vibrate(); }
    syncToggles();
    return;
  }
  const follow = t.closest<HTMLElement>('[data-follow]');
  if (follow) {
    const slug = follow.dataset.follow!;
    const on = toggleFollow(slug);
    void getBackend().then((b) => b.setFollow(slug, on));
    sound.pop();
    toast(on ? 'ফলো করছ! নতুন পোস্ট এলে জানাব (সেটিংস: "আমি" পেজ)' : 'আনফলো করা হলো', { mood: on ? 'wow' : 'think' });
    syncToggles();
  }
});

/* ───────────── Flip cards (Wall of Fame) ───────────── */
document.addEventListener('click', (e) => {
  const f = (e.target as HTMLElement).closest<HTMLElement>('[data-flip]');
  if (!f) return;
  const card = f.closest('.flip');
  if (!card) return;
  card.classList.toggle('is-flipped');
  const flipped = card.classList.contains('is-flipped');
  $('.flip-front', card)?.setAttribute('aria-hidden', String(flipped));
  $('.flip-back', card)?.setAttribute('aria-hidden', String(!flipped));
  sound.pop();
});

/* ───────────── "ভাবা যায়!" reveal plates ───────────── */
document.addEventListener('click', (e) => {
  const plate = (e.target as HTMLElement).closest<HTMLElement>('[data-reveal]');
  if (!plate || plate.dataset.revealed) return;
  plate.dataset.revealed = '1';
  plate.style.animation = 'var(--animate-shake)';
  sound.pop();
  vibrate(15);
  setTimeout(() => {
    $('[data-reveal-cover]', plate)?.setAttribute('hidden', '');
    const content = $('[data-reveal-content]', plate);
    content?.removeAttribute('hidden');
    if (content) content.style.animation = 'var(--animate-pop)';
    const r = plate.getBoundingClientRect();
    confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 60 });
    sound.cheer();
  }, 450);
});

/* ───────────── Mark-as-read sentinels ───────────── */
const readObs = new IntersectionObserver((entries) => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    const el = en.target as HTMLElement;
    if (el.dataset.markRead) markMythRead(el.dataset.markRead);
    readObs.unobserve(el);
  }
}, { threshold: 1 });
$$('[data-mark-read]').forEach((el) => readObs.observe(el));

/* ───────────── Peek: end of a long article → ভাবু peeks up ───────────── */
const peekEnd = $('[data-peek-end]');
if (peekEnd) {
  let shown = false;
  const obs = new IntersectionObserver(([en]) => {
    if (!en.isIntersecting || shown || scrollY < 400) return;
    shown = true;
    obs.disconnect();
    const peek = document.createElement('a');
    peek.href = peekEnd.dataset.peekHref || '/myth';
    peek.className = 'fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] right-4 z-30 flex items-end gap-1 lg:bottom-0';
    peek.setAttribute('aria-label', 'আরেকটা পড়বে?');
    peek.innerHTML = `<span class="mb-16 max-w-[11rem] rounded-2xl rounded-br-sm bg-deep px-3 py-2 text-sm font-semibold leading-snug text-white shadow-lg">আরেকটা পড়বে?<span class="block text-sun">${peekEnd.dataset.peekLabel ?? ''}</span></span><span class="block w-16 overflow-hidden" style="height:84px"><span class="block w-16" style="animation:bj-peek .7s var(--ease-spring) both">${bhabuSvg({ face: 'wow', body: 'teal', dot: 'coral', brows: 'dark', className: 'w-full h-auto' })}</span></span>`;
    document.body.appendChild(peek);
    sound.pop();
    setTimeout(() => { peek.style.transition = 'opacity .4s'; peek.style.opacity = '0'; setTimeout(() => peek.remove(), 400); }, 9000);
  }, { threshold: 0.6 });
  obs.observe(peekEnd);
}

/* ───────────── Wave hello: first visit of the day ───────────── */
function greeting() {
  const h = new Date(Date.now() + 6 * 3600_000).getUTCHours();
  if (h >= 5 && h < 12) return 'শুভ সকাল!';
  if (h >= 12 && h < 16) return 'শুভ দুপুর!';
  if (h >= 16 && h < 18) return 'শুভ বিকেল!';
  if (h >= 18 && h < 22) return 'শুভ সন্ধ্যা!';
  return 'এখনো জেগে আছ?';
}
const quiet = /^\/(id|admin|quiz\/|initiator\/pitch)/.test(path);
function waveHello() {
  const s = getState();
  if (s.flags.waveDay === today || quiet) return false;
  setFlag('waveDay', today);
  const name = s.user?.nickname;
  const wrap = document.createElement('div');
  wrap.className = 'fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 z-[70] flex items-end gap-2 lg:bottom-6 lg:left-6';
  wrap.setAttribute('role', 'status');
  wrap.innerHTML = `<span data-wave class="block w-20 origin-bottom" style="animation:var(--animate-wave)">${bhabuSvg({ face: 'happy', body: 'coral', dot: 'sun', brows: 'dark', animateSparks: true, className: 'w-full h-auto' })}</span>
    <span class="mb-14 rounded-2xl rounded-bl-sm bg-surface px-3.5 py-2 font-semibold shadow-[var(--shadow-lift)] ring-1 ring-line reveal-up">${greeting()}${name ? ` ${name}` : ''}<span class="block text-sm font-normal text-ink-soft">আজকের ভাবনা দেখেছ?</span></span>`;
  document.body.appendChild(wrap);
  setTimeout(() => {
    const bang = $('[data-logo-bang]:not([hidden])') ?? $('[data-logo-bang]');
    const target = bang?.getBoundingClientRect();
    const fig = $('[data-wave]', wrap)!;
    const bubble = fig.nextElementSibling as HTMLElement;
    bubble.style.transition = 'opacity .25s';
    bubble.style.opacity = '0';
    if (target && target.width && !prefersReducedMotion()) {
      const r = fig.getBoundingClientRect();
      const dx = target.left + target.width / 2 - (r.left + r.width / 2);
      const dy = target.top + target.height / 2 - (r.top + r.height / 2);
      fig.style.animation = 'none';
      fig.style.transition = 'transform .8s cubic-bezier(.6,-.2,.3,1), opacity .8s';
      fig.style.transform = `translate(${dx}px, ${dy}px) scale(${Math.max(0.12, target.height / r.height)})`;
      fig.style.opacity = '.2';
    } else {
      wrap.style.transition = 'opacity .4s';
      wrap.style.opacity = '0';
    }
    setTimeout(() => wrap.remove(), 900);
  }, 2800);
  return true;
}

/* ───────────── Daily fact pop-up: once a day, small, never full-screen ───────────── */
function dailyFact() {
  const s = getState();
  if (s.flags.factDay === today || quiet) return;
  let factsList: string[] = [];
  try { factsList = JSON.parse($('#bj-facts')?.textContent || '[]'); } catch { /* ignore */ }
  if (!factsList.length) return;
  setTimeout(() => {
    if (getState().flags.factDay === today) return;
    setFlag('factDay', today);
    const fact = factsList[thoughtIndex(factsList.length)];
    const card = document.createElement('aside');
    card.setAttribute('aria-label', 'আজকের মজার তথ্য');
    card.className = 'fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-md rounded-[20px] bg-surface p-4 pr-11 shadow-[var(--shadow-lift)] ring-1 ring-line reveal-up lg:inset-x-auto lg:bottom-6 lg:right-6';
    card.innerHTML = `<p class="text-sm font-bold text-coral-dark dark:text-coral">💡 আজকের মজার তথ্য</p><p class="mt-1 font-semibold leading-relaxed">${fact}</p><button type="button" class="btn-icon absolute right-1.5 top-1.5" aria-label="বন্ধ করো">${iconSvg('x')}</button>`;
    $('button', card)!.addEventListener('click', () => card.remove());
    document.body.appendChild(card);
    sound.pop();
    setTimeout(() => card.remove(), 14000);
  }, 9000);
}

/* ───────────── Boot ───────────── */
applyPrefs();
applySound();
applyIdentity();
syncToggles();
subscribe(() => { applyIdentity(); syncToggles(); });

const waved = waveHello();
if (!waved) dailyFact();

// Under Supabase, refresh the session mirror (magic-link / OAuth return)
void getBackend().then((b) => { if (b.mode === 'supabase') void b.getSession(); });
