// Shared UI components
import { html } from '../utils.js';

let lastUiSoundAt = 0;
const uiAudioCache = new Map();

const UI_SOUND_BY_VARIANT = {
  primary: '/sounds/04button.mp3',
  secondary: '/sounds/04button.mp3',
  ghost: '/sounds/04button.mp3',
  nav: '/sounds/04button.mp3',
  tv: '/sounds/04button.mp3',
  warning: '/sounds/03notification.mp3',
  success: '/sounds/05confirm%20success.mp3',
  danger: '/sounds/06error2.mp3',
};

function playUiAudio(src, volume = 0.42) {
  let base = uiAudioCache.get(src);
  if (!base) {
    base = new Audio(src);
    base.preload = 'auto';
    uiAudioCache.set(src, base);
  }
  const audio = base.cloneNode();
  audio.volume = volume;
  audio.play().catch(() => {});
}

function playUiFeedback(variant = 'primary') {
  try {
    navigator.vibrate?.(variant === 'danger' ? [18, 24, 18] : 14);
  } catch {}

  try {
    const now = performance.now();
    if (now - lastUiSoundAt < 70) return;
    lastUiSoundAt = now;
    playUiAudio(UI_SOUND_BY_VARIANT[variant] || UI_SOUND_BY_VARIANT.primary, variant === 'danger' ? 0.62 : 0.42);
  } catch {}
}

const SYSTEM_ICON_PATHS = {
  settings: '<path d="M9.4 3.1 10 1h4l.6 2.1 1.8.8 1.9-1 2.8 2.8-1 1.9.8 1.8L23 10v4l-2.1.6-.8 1.8 1 1.9-2.8 2.8-1.9-1-1.8.8L14 23h-4l-.6-2.1-1.8-.8-1.9 1-2.8-2.8 1-1.9-.8-1.8L1 14v-4l2.1-.6.8-1.8-1-1.9 2.8-2.8 1.9 1 1.8-.8Z"/><circle cx="12" cy="12" r="3.2"/>',
  back: '<path d="M14 5 7 12l7 7"/><path d="M8 12h13"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.1-6 8-6s6.5 2 8 6"/>',
  volume: '<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 9.2a4 4 0 0 1 0 5.6"/><path d="M18.5 6.5a8 8 0 0 1 0 11"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M19 9l-5 6"/><path d="M14 9l5 6"/>',
  menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
  close: '<path d="M6 6 18 18"/><path d="M18 6 6 18"/>',
  play: '<path d="M8 5v14l11-7Z"/>',
  screen: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M9 21h6"/><path d="M12 16v5"/>',
};

const GAME_ICON_PATHS = {
  buzzer: '<circle cx="32" cy="32" r="27" fill="#240817"/><circle cx="32" cy="33" r="22" fill="#631427"/><ellipse cx="32" cy="27" rx="17" ry="12" fill="#ff4964"/><path d="M17 44c7 8 23 8 30 0" fill="none" stroke="#ffb3be" stroke-width="3" stroke-linecap="round"/><path d="M15 14 8 8M49 14l7-6M8 32H2M62 32h-6" stroke="#ffd166" stroke-width="4" stroke-linecap="round"/>',
  round: '<path d="M18 54V11" stroke="#d7e2ff" stroke-width="5" stroke-linecap="round"/><path d="M20 12c10-7 18 7 28 0v24c-10 7-18-7-28 0V12Z" fill="#4facfe"/><path d="M26 14v20M34 17v20M42 14v20" stroke="#12213d" stroke-width="3" opacity=".55"/><path d="M12 55h20" stroke="#f8fafc" stroke-width="5" stroke-linecap="round"/>',
  category: '<rect x="10" y="14" width="32" height="36" rx="5" fill="#32245f"/><rect x="18" y="8" width="36" height="38" rx="5" fill="#4facfe"/><path d="M25 18h20M25 27h15M25 36h20" stroke="#ecfeff" stroke-width="4" stroke-linecap="round"/>',
  scores: '<rect x="9" y="34" width="12" height="18" rx="3" fill="#60a5fa"/><rect x="26" y="20" width="12" height="32" rx="3" fill="#ffd166"/><rect x="43" y="28" width="12" height="24" rx="3" fill="#38ef7d"/><path d="M7 54h50" stroke="#f8fafc" stroke-width="4" stroke-linecap="round"/><path d="m32 7 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z" fill="#f5576c"/>',
  bonus: '<path d="M32 5 39 21l17 2-13 11 4 17-15-9-15 9 4-17L8 23l17-2 7-16Z" fill="#ffd166"/><circle cx="32" cy="31" r="10" fill="#241027"/><path d="M28 31h8M32 27v8" stroke="#ffd166" stroke-width="4" stroke-linecap="round"/>',
  rapidite: '<path d="M36 4 14 35h15l-4 25 25-35H34l2-21Z" fill="#ffcc00"/><path d="M13 15H5M18 25H3M51 44h8" stroke="#f8fafc" stroke-width="4" stroke-linecap="round"/>',
  vote: '<rect x="11" y="28" width="42" height="24" rx="5" fill="#4f2678"/><path d="M20 28h24l-4-8H24l-4 8Z" fill="#a78bfa"/><rect x="21" y="10" width="24" height="18" rx="3" fill="#f8fafc"/><path d="M27 19h12" stroke="#4f2678" stroke-width="4" stroke-linecap="round"/><path d="M24 42h16" stroke="#e9d5ff" stroke-width="4" stroke-linecap="round"/>',
  burger: '<path d="M15 27c3-11 31-11 34 0H15Z" fill="#f8b84e"/><path d="M13 31h38" stroke="#38ef7d" stroke-width="5" stroke-linecap="round"/><path d="M15 38h34" stroke="#ff4964" stroke-width="6" stroke-linecap="round"/><path d="M16 45h32" stroke="#ffd166" stroke-width="6" stroke-linecap="round"/><path d="M18 52h28" stroke="#f8b84e" stroke-width="7" stroke-linecap="round"/><circle cx="26" cy="21" r="1.8" fill="#fff7d6"/><circle cx="35" cy="19" r="1.8" fill="#fff7d6"/>',
  karaoke: '<rect x="10" y="13" width="27" height="36" rx="5" fill="#1d2b53"/><path d="M17 23h13M17 32h9" stroke="#9ee7ff" stroke-width="4" stroke-linecap="round"/><circle cx="46" cy="20" r="8" fill="#f5576c"/><path d="M42 26 31 49M27 54l8-7" stroke="#f8fafc" stroke-width="5" stroke-linecap="round"/>',
  music: '<path d="M24 15v29a7 7 0 1 1-4-6V13l26-5v28a7 7 0 1 1-4-6V18l-18 4Z" fill="#38ef7d"/><path d="M11 18c4-5 8-5 12 0M43 49c4 2 8 2 12 0" stroke="#f8fafc" stroke-width="4" stroke-linecap="round"/>',
  correct: '<circle cx="32" cy="32" r="26" fill="#103d2a"/><path d="m19 33 8 8 18-20" stroke="#38ef7d" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>',
  wrong: '<circle cx="32" cy="32" r="26" fill="#4a1018"/><path d="M22 22 42 42M42 22 22 42" stroke="#ff6b7a" stroke-width="8" stroke-linecap="round"/>',
  profile: '<circle cx="32" cy="22" r="12" fill="#4facfe"/><path d="M12 55c4-13 12-20 20-20s16 7 20 20" fill="#1d4ed8"/><path d="M22 44c5 5 15 5 20 0" stroke="#bfdbfe" stroke-width="4" stroke-linecap="round"/>',
  host: '<path d="M18 45h28l5-23H13l5 23Z" fill="#f093fb"/><path d="M24 45v8M40 45v8M18 53h28" stroke="#f8fafc" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="30" r="3" fill="#231733"/><circle cx="40" cy="30" r="3" fill="#231733"/><path d="M30 36h4" stroke="#231733" stroke-width="3" stroke-linecap="round"/>',
  display: '<rect x="8" y="12" width="48" height="32" rx="5" fill="#16213e"/><path d="M17 23h30M17 32h18" stroke="#4facfe" stroke-width="4" stroke-linecap="round"/><path d="M26 50h12M32 44v6" stroke="#f8fafc" stroke-width="4" stroke-linecap="round"/>',
  gamepad: '<path d="M18 22h28c7 0 12 7 10 14l-3 10c-1 4-7 5-10 2l-5-5H26l-5 5c-3 3-9 2-10-2L8 36c-2-7 3-14 10-14Z" fill="#f5576c"/><path d="M20 34h12M26 28v12" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="43" cy="32" r="3" fill="#fff"/><circle cx="49" cy="38" r="3" fill="#fff"/>',
};

export const UiIcon = ({ name = 'settings', className = '', title = '' }) => html`
  <span className=${'inline-flex items-center justify-center leading-none align-[-0.16em] ' + className} title=${title} aria-hidden=${title ? undefined : 'true'}>
    <svg viewBox="0 0 24 24" className="block h-full w-full overflow-visible" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML=${{ __html: SYSTEM_ICON_PATHS[name] || SYSTEM_ICON_PATHS.settings }} />
  </span>
`;

export const GameIcon = ({ name = 'category', className = '', title = '' }) => html`
  <span className=${'inline-flex items-center justify-center leading-none align-[-0.16em] drop-shadow-[0_8px_16px_rgba(0,0,0,.22)] ' + className} title=${title} aria-hidden=${title ? undefined : 'true'}>
    <svg viewBox="0 0 64 64" className="block h-full w-full overflow-visible" dangerouslySetInnerHTML=${{ __html: GAME_ICON_PATHS[name] || GAME_ICON_PATHS.category }} />
  </span>
`;

// ── Button ───────────────────────────────────────────────────
export const Btn = ({ variant = 'primary', size = 'md', pulse, wide, onClick, disabled, children, className = '', style, feedback = true }) => {
  const base = 'ui-btn inline-flex items-center justify-center gap-2 font-bold rounded-lg cursor-pointer select-none border shadow-sm';
  const sizes = {
    sm: 'px-4 py-2 text-sm min-h-[40px]',
    md: 'px-5 py-3 text-base min-h-[50px]',
    lg: 'px-7 py-4 text-lg min-h-[58px]',
  };
  const variants = {
    primary:   'ui-btn-primary border-white/10 text-white shadow-accent',
    success:   'ui-btn-success border-white/10 text-slate-950',
    danger:    'ui-btn-danger border-white/10 text-white',
    warning:   'ui-btn-warning border-white/10 text-slate-950 font-extrabold',
    secondary: 'ui-btn-secondary border-white/10 text-white/90',
    ghost:     'ui-btn-ghost border-white/10 text-white/72 hover:text-white',
    tv:        'ui-btn-tv border-white/10 text-slate-950',
    nav:       'ui-btn-nav border-white/10 text-white/90',
  };
  const cls = [
    base,
    sizes[size] || sizes.md,
    variants[variant] || variants.primary,
    wide ? 'w-full' : '',
    pulse ? 'ring-pulse is-next-action' : '',
    disabled ? 'opacity-50 cursor-not-allowed' : '',
    className,
  ].filter(Boolean).join(' ');
  const handleClick = (event) => {
    if (disabled) return;
    if (feedback) playUiFeedback(variant);
    onClick?.(event);
  };

  return html`<button
    className=${cls}
    data-variant=${variant}
    style=${style}
    onClick=${handleClick}
    disabled=${disabled}
  >${children}</button>`;
};

// ── Card ────────────────────────────────────────────────────
export const Card = ({ children, className = '', style, glow }) => html`
  <div className=${'animate-soft-slide-up rounded-lg app-surface p-5 ' + (glow ? 'border-sky-400/40 shadow-accent ' : '') + className} style=${style}>
    ${children}
  </div>
`;

// ── Badge ───────────────────────────────────────────────────
export const Badge = ({ color = 'violet', children, className = '' }) => {
  const colors = {
    violet: 'bg-accent/15 text-violet-200 border-accent/30',
    green:  'bg-teal-500/15 text-teal-200 border-teal-500/30',
    orange: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    red:    'bg-rose-500/15 text-rose-400 border-rose-500/30',
    blue:   'bg-sky-500/15 text-sky-200 border-sky-500/30',
    gray:   'bg-white/8 text-white/50 border-white/10',
  };
  return html`<span className=${'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm ' + (colors[color] || colors.gray) + ' ' + className}>
    ${children}
  </span>`;
};


// ── Waiting dots ─────────────────────────────────────────────
export const Dots = () => html`
  <div className="dot-bounce mt-4 justify-center">
    <span></span><span></span><span></span>
  </div>
`;

// ── Alert ────────────────────────────────────────────────────
export const Alert = ({ type = 'info', message }) => {
  if (!message) return null;
  const styles = {
    info:    'bg-blue-500/15 border-blue-500/30 text-blue-300',
    error:   'bg-rose-500/15 border-rose-500/30 text-rose-300',
    success: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    warning: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  };
  return html`
    <div className=${'rounded-xl border px-4 py-3 text-sm font-medium ' + (styles[type] || styles.info)}>
      ${message}
    </div>
  `;
};

// ── Session banner ───────────────────────────────────────────
export const SessionBanner = ({ code, label, right }) => html`
  <div className="flex items-center justify-between px-4 py-2.5 bg-bg-alt/86 backdrop-blur-xl border-b border-white/8 text-sm sticky top-0 z-10">
    <span className="text-white/50">Session : <strong className="text-sky-300 font-mono tracking-widest">${code}</strong></span>
    ${label && html`<span className="text-white/70">${label}</span>`}
    ${right  && html`<span>${right}</span>`}
  </div>
`;

// ── Modal ────────────────────────────────────────────────────
export const Modal = ({ show, onClose, title, children, width = 'max-w-lg' }) => {
  if (!show) return null;
  return html`
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick=${(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className=${'w-full ' + width + ' app-surface rounded-lg shadow-2xl animate-soft-slide-up overflow-hidden'}>
        ${title && html`
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
            <h3 className="text-lg font-bold">${title}</h3>
            <button onClick=${onClose} className="text-white/40 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5">✕</button>
          </div>
        `}
        <div className="p-6">${children}</div>
      </div>
    </div>
  `;
};
