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

  // ── Rôle : Jouer (smartphone + éclair)
  profile:
    '<rect x="20" y="6" width="24" height="42" rx="6" fill="#0c2a4a"/>' +
    '<rect x="23" y="11" width="18" height="28" rx="3" fill="#4facfe"/>' +
    '<circle cx="32" cy="44" r="2.5" fill="#2a5f8a"/>' +
    '<path d="M29 18 29 34 43 26Z" fill="#fff"/>' +
    '<circle cx="46" cy="13" r="8" fill="#7c5cff"/>' +
    '<path d="M42 17l3 3 5-6" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',

  // ── Rôle : Animateur (micro)
  host:
    '<rect x="24" y="6" width="16" height="26" rx="8" fill="#6b21a8"/>' +
    '<rect x="27" y="9" width="10" height="20" rx="5" fill="#e879f9"/>' +
    '<path d="M16 26c0 10 7 16 16 16s16-6 16-16" fill="none" stroke="#e879f9" stroke-width="4.5" stroke-linecap="round"/>' +
    '<line x1="32" y1="42" x2="32" y2="54" stroke="#e879f9" stroke-width="4.5" stroke-linecap="round"/>' +
    '<path d="M22 54h20" stroke="#a21caf" stroke-width="4.5" stroke-linecap="round"/>',

  // ── Rôle : Écran TV (moniteur)
  display:
    '<rect x="5" y="9" width="54" height="36" rx="6" fill="#0a1f3d"/>' +
    '<rect x="9" y="13" width="46" height="28" rx="4" fill="#1e3a5f"/>' +
    '<rect x="14" y="18" width="36" height="3.5" rx="1.7" fill="#4facfe"/>' +
    '<rect x="14" y="26" width="24" height="3.5" rx="1.7" fill="#4facfe" opacity=".55"/>' +
    '<rect x="14" y="34" width="16" height="3.5" rx="1.7" fill="#4facfe" opacity=".3"/>' +
    '<circle cx="46" cy="20" r="4" fill="#38ef7d"/>' +
    '<path d="M24 49h16M32 45v4" stroke="#2a4a6e" stroke-width="4" stroke-linecap="round"/>',

  // ── QCM : 4 cases avec une sélectionnée
  category:
    '<rect x="6" y="8" width="22" height="20" rx="5" fill="#2e1065"/>' +
    '<rect x="36" y="8" width="22" height="20" rx="5" fill="#7c5cff"/>' +
    '<rect x="6" y="36" width="22" height="20" rx="5" fill="#2e1065"/>' +
    '<rect x="36" y="36" width="22" height="20" rx="5" fill="#2e1065"/>' +
    '<path d="M40 19l3.5 3.5 7-8" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<rect x="10" y="16" width="14" height="3" rx="1.5" fill="#4c1d95"/>' +
    '<rect x="10" y="44" width="14" height="3" rx="1.5" fill="#4c1d95"/>' +
    '<rect x="40" y="44" width="14" height="3" rx="1.5" fill="#4c1d95"/>',

  // ── Vrai / Faux : panneau bicolore
  correct:
    '<rect x="5" y="8" width="24" height="48" rx="6" fill="#052e16"/>' +
    '<rect x="35" y="8" width="24" height="48" rx="6" fill="#450a0a"/>' +
    '<path d="M11 33l7 7 10-12" stroke="#38ef7d" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M39 27l12 14M51 27 39 41" stroke="#ff6b7a" stroke-width="5.5" stroke-linecap="round"/>',

  // ── Rapidité / Buzzer : éclair
  rapidite:
    '<path d="M38 5 16 36h14l-5 23 28-34H38l2-20Z" fill="#fbbf24"/>' +
    '<path d="M38 5 16 36h14l-5 23 28-34H38l2-20Z" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M10 18H4M8 29H1M56 43h7" stroke="rgba(255,255,255,.5)" stroke-width="3.5" stroke-linecap="round"/>',

  // ── Vote / Use Your Words : bulles de dialogue
  vote:
    '<rect x="6" y="6" width="36" height="26" rx="6" fill="#1e3a5f"/>' +
    '<path d="M6 27l-6 9 14-5" fill="#1e3a5f"/>' +
    '<rect x="12" y="13" width="10" height="3" rx="1.5" fill="#38bdf8"/>' +
    '<rect x="12" y="21" width="20" height="3" rx="1.5" fill="#38bdf8" opacity=".6"/>' +
    '<rect x="22" y="32" width="36" height="24" rx="6" fill="#1a0533"/>' +
    '<path d="M58 49l6 9-14-4" fill="#1a0533"/>' +
    '<rect x="28" y="39" width="20" height="3" rx="1.5" fill="#a78bfa"/>' +
    '<rect x="28" y="47" width="12" height="3" rx="1.5" fill="#a78bfa" opacity=".6"/>',

  // ── Burger de la Mort : couches empilées
  burger:
    '<rect x="8" y="48" width="48" height="10" rx="5" fill="#7c2d12"/>' +
    '<rect x="10" y="36" width="44" height="10" rx="5" fill="#c2410c"/>' +
    '<rect x="8" y="24" width="48" height="10" rx="5" fill="#ea580c"/>' +
    '<rect x="10" y="12" width="44" height="10" rx="5" fill="#fb923c"/>' +
    '<ellipse cx="32" cy="8" rx="20" ry="6" fill="#f8b84e"/>' +
    '<ellipse cx="24" cy="7" rx="2" ry="1.5" fill="#fff7d6" opacity=".7"/>' +
    '<ellipse cx="34" cy="6" rx="2" ry="1.5" fill="#fff7d6" opacity=".7"/>',

  // ── Challenge Vidéo : clap de cinéma
  karaoke:
    '<rect x="8" y="22" width="40" height="32" rx="6" fill="#1c0a1a"/>' +
    '<rect x="11" y="26" width="34" height="24" rx="4" fill="#f5576c"/>' +
    '<circle cx="28" cy="38" r="7" fill="#1c0a1a"/>' +
    '<circle cx="28" cy="38" r="3.5" fill="#f5576c"/>' +
    '<path d="M48 30l12-6v24l-12-6V30Z" fill="#9d174d"/>' +
    '<rect x="8" y="13" width="40" height="9" rx="4" fill="#2d0a2a"/>' +
    '<path d="M16 13l4 9M26 13l4 9M36 13l4 9" stroke="#f5576c" stroke-width="3" stroke-linecap="round"/>',

  // ── Buzzer (Feature) : bouton d'alarme
  buzzer:
    '<circle cx="32" cy="36" r="22" fill="#1a0808"/>' +
    '<circle cx="32" cy="36" r="17" fill="#7f1d1d"/>' +
    '<circle cx="32" cy="34" rx="13" r="13" fill="#ef4444"/>' +
    '<ellipse cx="32" cy="29" rx="8" ry="4.5" fill="#fca5a5"/>' +
    '<path d="M32 8v6M32 8v6" stroke="#fcd34d" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M14 17l4 4M46 17l-4 4" stroke="#fcd34d" stroke-width="3.5" stroke-linecap="round"/>' +
    '<path d="M6 34h5M53 34h5" stroke="#fcd34d" stroke-width="3.5" stroke-linecap="round"/>',

  // ── Cérémonie finale : coupe
  scores:
    '<path d="M18 7h28v22c0 9-6 15-14 16-8-1-14-7-14-16V7Z" fill="#78350f"/>' +
    '<path d="M20 9h24v20c0 8-5 13-12 14-7-1-12-6-12-14V9Z" fill="#fbbf24"/>' +
    '<path d="M8 11h10v12c0 3-5 4-6 2L8 11Z" fill="#92400e"/>' +
    '<path d="M46 11h10l-4 14c-1 2-6 1-6-2V11Z" fill="#92400e"/>' +
    '<path d="M28 43v8M36 43v8" stroke="#78350f" stroke-width="4" stroke-linecap="round"/>' +
    '<rect x="20" y="51" width="24" height="5" rx="2.5" fill="#92400e"/>' +
    '<path d="M32 18l2.5 5 5.5.8-4 3.9 1 5.3-5-2.7-5 2.7 1-5.3-4-3.9 5.5-.8Z" fill="#fff8e1"/>',

  // ── Bonus
  bonus:
    '<path d="M32 5 39 21l17 2-13 11 4 17-15-9-15 9 4-17L8 23l17-2 7-16Z" fill="#ffd166"/>' +
    '<circle cx="32" cy="31" r="10" fill="#241027"/>' +
    '<path d="M28 31h8M32 27v8" stroke="#ffd166" stroke-width="4" stroke-linecap="round"/>',

  // ── Wrong
  wrong:
    '<circle cx="32" cy="32" r="26" fill="#4a1018"/>' +
    '<path d="M22 22 42 42M42 22 22 42" stroke="#ff6b7a" stroke-width="8" stroke-linecap="round"/>',

  // ── Music
  music:
    '<path d="M24 15v29a7 7 0 1 1-4-6V13l26-5v28a7 7 0 1 1-4-6V18l-18 4Z" fill="#38ef7d"/>',

  // ── Round flag
  round:
    '<path d="M18 54V11" stroke="#d7e2ff" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M20 12c10-7 18 7 28 0v24c-10 7-18-7-28 0V12Z" fill="#4facfe"/>' +
    '<path d="M12 55h20" stroke="#f8fafc" stroke-width="5" stroke-linecap="round"/>',

  // ── Gamepad
  gamepad:
    '<path d="M18 22h28c7 0 12 7 10 14l-3 10c-1 4-7 5-10 2l-5-5H26l-5 5c-3 3-9 2-10-2L8 36c-2-7 3-14 10-14Z" fill="#f5576c"/>' +
    '<path d="M20 34h12M26 28v12" stroke="#fff" stroke-width="4" stroke-linecap="round"/>' +
    '<circle cx="43" cy="32" r="3" fill="#fff"/>' +
    '<circle cx="49" cy="38" r="3" fill="#fff"/>',
};

export const UiIcon = ({ name = 'settings', className = '', title = '' }) => html`
  <span className=${'inline-flex items-center justify-center leading-none align-[-0.16em] ' + className} title=${title} aria-hidden=${title ? undefined : 'true'}>
    <svg viewBox="0 0 24 24" className="block h-full w-full overflow-visible" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML=${{ __html: SYSTEM_ICON_PATHS[name] || SYSTEM_ICON_PATHS.settings }} />
  </span>
`;

export const GameIcon = ({ name = 'category', className = '', title = '' }) => html`
  <span className=${'game-icon-mono-wrap inline-flex items-center justify-center leading-none align-[-0.16em] text-sky-200 ' + className} title=${title} aria-hidden=${title ? undefined : 'true'}>
    <svg viewBox="0 0 64 64" className="game-icon-mono block h-full w-full overflow-visible" dangerouslySetInnerHTML=${{ __html: GAME_ICON_PATHS[name] || GAME_ICON_PATHS.category }} />
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
