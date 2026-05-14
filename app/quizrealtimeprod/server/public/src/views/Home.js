import { html } from '../utils.js';
import { useGame } from '../contexts/GameContext.js';
import { GameIcon, UiIcon } from '../components/ui.js';

const ROLES = [
  { id: 'player', iconType: 'game', iconName: 'profile', labelKey: 'role.player.label', subKey: 'role.player.sub', color: 'from-sky-500 to-violet-600', glow: 'rgba(124,92,255,.30)', accent: '#7c5cff' },
  { id: 'host', iconType: 'game', iconName: 'host', labelKey: 'role.host.label', subKey: 'role.host.sub', color: 'from-teal-400 to-emerald-500', glow: 'rgba(45,212,130,.25)', accent: '#2dd4bf' },
  { id: 'display', iconType: 'game', iconName: 'display', labelKey: 'role.display.label', subKey: 'role.display.sub', color: 'from-cyan-400 to-blue-500', glow: 'rgba(56,189,248,.25)', accent: '#38bdf8' },
  { id: 'admin', iconType: 'ui', iconName: 'settings', labelKey: 'role.admin.label', subKey: 'role.admin.sub', color: 'from-amber-400 to-rose-500', glow: 'rgba(245,158,11,.25)', accent: '#f59e0b' },
];

const MODES = [
  { iconName: 'category', labelKey: 'qtype.qcm',           color: '#7c3aed' },
  { iconName: 'correct',  labelKey: 'qtype.true_false',     color: '#4f46e5' },
  { iconName: 'rapidite', labelKey: 'qtype.rapidite',       color: '#6d28d9' },
  { iconName: 'vote',     labelKey: 'qtype.vote',           color: '#3730a3' },
  { iconName: 'burger',   labelKey: 'qtype.burger',         color: '#5b21b6' },
  { iconName: 'karaoke',  labelKey: 'qtype.video_challenge',color: '#4338ca' },
];

const FEATURES = [
  { iconName: 'category', titleKey: 'feature.qcm.title',      descKey: 'feature.qcm.desc',      color: '#7c3aed' },
  { iconName: 'buzzer',   titleKey: 'feature.buzzer.title',   descKey: 'feature.buzzer.desc',   color: '#6d28d9' },
  { iconName: 'vote',     titleKey: 'feature.vote.title',     descKey: 'feature.vote.desc',     color: '#3730a3' },
  { iconName: 'burger',   titleKey: 'feature.burger.title',   descKey: 'feature.burger.desc',   color: '#5b21b6' },
  { iconName: 'karaoke',  titleKey: 'feature.video.title',    descKey: 'feature.video.desc',    color: '#4338ca' },
  { iconName: 'scores',   titleKey: 'feature.ceremony.title', descKey: 'feature.ceremony.desc', color: '#4f46e5' },
];

const roleIcon = (r) => (
  r.iconType === 'ui'
    ? html`<${UiIcon} name=${r.iconName} className="h-full w-full" />`
    : html`<${GameIcon} name=${r.iconName} className="h-full w-full" />`
);

export default function Home() {
  const { navigate, t } = useGame();

  const go = (id) => {
    if (id === 'display' || id === 'player') {
      window.open(`${window.location.origin}/#${id}`, '_blank', 'noopener');
    } else {
      navigate(id);
    }
  };

  return html`
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-start overflow-hidden px-4 py-10 sm:px-6 gap-8">
      <div aria-hidden="true" style=${{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none', overflow:'hidden' }}>
        <div style=${{ position:'absolute', top:'-15vw', left:'-10vw', width:'55vw', height:'55vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(124,92,255,.13) 0%, transparent 70%)', filter:'blur(40px)' }} />
        <div style=${{ position:'absolute', bottom:'-10vw', right:'-8vw', width:'45vw', height:'45vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(45,212,191,.10) 0%, transparent 70%)', filter:'blur(40px)' }} />
      </div>

      <div className="relative z-10 w-full max-w-4xl animate-fade-in flex flex-col gap-8">
        <div className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full app-chip px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-sky-200">
            <span className="h-2 w-2 rounded-full bg-teal-300 animate-pulse" style=${{ boxShadow:'0 0 6px #2dd4bf' }}></span>
            ${t('home.badge')}
          </div>
          <h1 className="font-display font-black leading-none gradient-text" style=${{ fontSize:'clamp(3.5rem,10vw,6rem)', marginBottom:'0.5rem' }}>
            QuizzGeek
          </h1>
          <p style=${{ fontSize:'clamp(.9rem,1.8vw,1.1rem)', color:'rgba(255,255,255,.45)', maxWidth:'38rem', margin:'0 auto' }}>
            ${t('home.tagline')}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          ${MODES.map(m => html`
            <span key=${m.labelKey} className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-white" style=${{ background: 'linear-gradient(130deg, ' + m.color + ' 0%, #1e1b4b 100%)', borderRadius: '8px', boxShadow: '0 2px 10px ' + m.color + '44' }}>
              <${GameIcon} name=${m.iconName} className="h-4 w-4" /> ${t(m.labelKey)}
            </span>
          `)}
        </div>

        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          ${ROLES.map(r => html`
            <button
              key=${r.id}
              onClick=${() => go(r.id)}
              className="group relative overflow-hidden rounded-2xl app-surface text-left transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl active:translate-y-0 active:scale-[.98]"
              style=${{ boxShadow:'0 0 0 1px rgba(255,255,255,.07)', padding:'clamp(14px,2.5vw,22px)' }}
            >
              <div className=${'absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r rounded-t-2xl ' + r.color}></div>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 rounded-2xl" style=${{ background: `radial-gradient(ellipse at 50% 0%, ${r.glow}, transparent 65%)` }}></div>
              <div className="relative z-10 flex flex-col gap-3 h-full">
                <div className="flex items-start justify-between">
                  <span className="flex items-center justify-center rounded-xl app-panel transition-transform duration-300 group-hover:scale-110" style=${{ width:'clamp(44px,7vw,56px)', height:'clamp(44px,7vw,56px)', fontSize:'clamp(1.4rem,3vw,1.8rem)' }}>
                    ${roleIcon(r)}
                  </span>
                  <span className="rounded-full bg-white/6 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white/35 group-hover:text-white/55 transition-colors mt-1">↗</span>
                </div>
                <div>
                  <div className="font-black text-white" style=${{ fontSize:'clamp(.95rem,1.8vw,1.05rem)' }}>${t(r.labelKey)}</div>
                  <div className="mt-0.5 text-white/40" style=${{ fontSize:'clamp(.72rem,1.3vw,.8rem)' }}>${t(r.subKey)}</div>
                </div>
                <div className="mt-auto pt-2">
                  <div className="h-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style=${{ background: `linear-gradient(to right, ${r.accent}, transparent)` }}></div>
                </div>
              </div>
            </button>
          `)}
        </section>

        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-white/6"></div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/20">${t('home.whatCanDo')}</span>
          <div className="flex-1 h-px bg-white/6"></div>
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          ${FEATURES.map(f => html`
            <div key=${f.titleKey} className="rounded-xl app-panel flex items-start gap-3" style=${{ padding:'clamp(12px,2vw,16px)' }}>
              <span className="flex-shrink-0 flex items-center justify-center rounded-lg mt-0.5" style=${{ width:'36px', height:'36px', background: f.color + '18', border:'1px solid '+f.color+'30' }}><${GameIcon} name=${f.iconName} className="h-7 w-7" /></span>
              <div>
                <div className="font-black text-white" style=${{ fontSize:'.88rem' }}>${t(f.titleKey)}</div>
                <div className="mt-0.5 leading-4 text-white/38" style=${{ fontSize:'.75rem' }}>${t(f.descKey)}</div>
              </div>
            </div>
          `)}
        </section>

        <div className="text-center pb-2">
          <button onClick=${() => go('admin')} className="ui-btn ui-btn-secondary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-bold text-white/70 transition-all hover:text-white app-surface" style=${{ fontSize:'.85rem', border:'1px solid rgba(255,255,255,.06)' }}>
            <${UiIcon} name="settings" className="h-4 w-4" /> ${t('home.createQuiz')}
          </button>
        </div>
      </div>
    </div>
  `;
}
