// Shared UI components
import { html } from '../utils.js';

// ── Button ───────────────────────────────────────────────────
export const Btn = ({ variant = 'primary', size = 'md', pulse, wide, onClick, disabled, children, className = '', style }) => {
  const base = 'inline-flex items-center justify-center gap-2 font-bold rounded-lg transition-all duration-200 cursor-pointer select-none border shadow-sm hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]';
  const sizes = {
    sm: 'px-4 py-2 text-sm min-h-[38px]',
    md: 'px-5 py-3 text-base min-h-[48px]',
    lg: 'px-7 py-4 text-lg min-h-[56px]',
  };
  const variants = {
    primary:   'bg-gradient-to-r from-accent to-sky-500 hover:brightness-110 border-white/10 text-white shadow-accent',
    success:   'bg-gradient-to-r from-teal-500 to-emerald-500 hover:brightness-110 border-white/10 text-slate-950',
    danger:    'bg-gradient-to-r from-rose-500 to-red-500 hover:brightness-110 border-white/10 text-white',
    warning:   'bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 border-white/10 text-slate-950 font-extrabold',
    secondary: 'app-panel hover:bg-white/10 border-white/10 text-white/90',
    ghost:     'bg-white/[0.035] hover:bg-white/10 border-white/10 text-white/70 hover:text-white',
    tv:        'bg-gradient-to-r from-sky-500 to-cyan-400 border-white/10 text-slate-950 hover:brightness-110',
    nav:       'app-panel hover:bg-accent/16 border-white/10 text-white/90 hover:border-sky-400/50',
  };
  const cls = [
    base,
    sizes[size] || sizes.md,
    variants[variant] || variants.primary,
    wide ? 'w-full' : '',
    pulse ? 'ring-pulse' : '',
    disabled ? 'opacity-50 cursor-not-allowed' : '',
    className,
  ].filter(Boolean).join(' ');

  return html`<button
    className=${cls}
    style=${style}
    onClick=${onClick}
    disabled=${disabled}
  >${children}</button>`;
};

// ── Card ────────────────────────────────────────────────────
export const Card = ({ children, className = '', style, glow }) => html`
  <div className=${'rounded-lg app-surface p-5 ' + (glow ? 'border-sky-400/40 shadow-accent ' : '') + className} style=${style}>
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
      <div className=${'w-full ' + width + ' app-surface rounded-lg shadow-2xl animate-fade-in overflow-hidden'}>
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
