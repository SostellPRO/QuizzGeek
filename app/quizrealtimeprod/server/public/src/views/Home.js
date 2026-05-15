import { html } from '../utils.js';
import { useGame } from '../contexts/GameContext.js';
import { GameIcon, UiIcon } from '../components/ui.js';

const ROLES = [
  { id: 'player',  iconType: 'game', iconName: 'profile', labelKey: 'role.player.label',  subKey: 'role.player.sub',  color: 'from-sky-500 to-violet-600',  glow: 'rgba(124,92,255,.35)',  accent: '#7c5cff' },
  { id: 'host',    iconType: 'game', iconName: 'host',    labelKey: 'role.host.label',    subKey: 'role.host.sub',    color: 'from-violet-500 to-purple-600', glow: 'rgba(139,92,246,.30)', accent: '#8b5cf6' },
  { id: 'display', iconType: 'game', iconName: 'display', labelKey: 'role.display.label', subKey: 'role.display.sub', color: 'from-indigo-400 to-blue-600',  glow: 'rgba(99,102,241,.30)',  accent: '#6366f1' },
  { id: 'admin',   iconType: 'ui',   iconName: 'settings',labelKey: 'role.admin.label',   subKey: 'role.admin.sub',   color: 'from-slate-400 to-slate-600',  glow: 'rgba(148,163,184,.20)', accent: '#94a3b8' },
];

const MODES = [
  { iconName: 'category', labelKey: 'qtype.qcm',            color: '#7c3aed' },
  { iconName: 'correct',  labelKey: 'qtype.true_false',      color: '#4f46e5' },
  { iconName: 'rapidite', labelKey: 'qtype.rapidite',        color: '#6d28d9' },
  { iconName: 'vote',     labelKey: 'qtype.vote',            color: '#3730a3' },
  { iconName: 'burger',   labelKey: 'qtype.burger',          color: '#5b21b6' },
  { iconName: 'karaoke',  labelKey: 'qtype.video_challenge', color: '#4338ca' },
];

const FEATURES = [
  { iconName: 'category', titleKey: 'feature.qcm.title',      color: '#7c3aed' },
  { iconName: 'buzzer',   titleKey: 'feature.buzzer.title',   color: '#6d28d9' },
  { iconName: 'vote',     titleKey: 'feature.vote.title',     color: '#3730a3' },
  { iconName: 'burger',   titleKey: 'feature.burger.title',   color: '#5b21b6' },
  { iconName: 'karaoke',  titleKey: 'feature.video.title',    color: '#4338ca' },
  { iconName: 'scores',   titleKey: 'feature.ceremony.title', color: '#4f46e5' },
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
      window.open(window.location.origin + '/#' + id, '_blank', 'noopener');
    } else {
      navigate(id);
    }
  };

  return html`
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-start overflow-x-hidden px-4 py-5 sm:px-8"
         style=${{ gap: 'clamp(16px,3vh,28px)' }}>

      <div aria-hidden="true" style=${{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none', overflow:'hidden' }}>
        <div style=${{ position:'absolute', top:'-18vw', left:'-12vw', width:'60vw', height:'60vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(124,92,255,.15) 0%, transparent 70%)', filter:'blur(50px)' }} />
        <div style=${{ position:'absolute', bottom:'-12vw', right:'-10vw', width:'50vw', height:'50vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(67,56,202,.18) 0%, transparent 70%)', filter:'blur(50px)' }} />
      </div>

      <div className="relative z-10 w-full max-w-5xl animate-fade-in flex flex-col"
           style=${{ gap: 'clamp(14px,2.5vh,24px)' }}>

        <!-- ── HERO ── -->
        <div className="text-center flex flex-col items-center" style=${{ gap: 'clamp(6px,1.2vh,12px)' }}>

          <div className="inline-flex items-center gap-2 rounded-full app-chip px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-sky-200">
            <span className="h-2 w-2 rounded-full bg-teal-300 animate-pulse" style=${{ boxShadow:'0 0 8px #2dd4bf' }}></span>
            ${t('home.badge')}
          </div>

          <h1 className="font-display font-black leading-none gradient-text" style=${{ fontSize:'clamp(3.2rem,9vw,5.8rem)', margin:'0' }}>
            QuizzGeek
          </h1>

          <p className="text-white/50 font-medium whitespace-nowrap overflow-hidden text-ellipsis w-full"
             style=${{ fontSize:'clamp(.8rem,1.4vw,1rem)' }}>
            ${t('home.tagline')}
          </p>

          <div className="flex flex-wrap justify-center gap-1.5">
            ${MODES.map(m => html`
              <span key=${m.labelKey}
                className="inline-flex items-center gap-1.5 font-bold text-white"
                style=${{
                  background: 'linear-gradient(130deg, ' + m.color + ' 0%, #1e1b4b 100%)',
                  borderRadius: '8px',
                  padding: '5px 12px',
                  fontSize: '.8rem',
                  boxShadow: '0 2px 10px ' + m.color + '50',
                }}>
                <${GameIcon} name=${m.iconName} className="h-4 w-4" />
                ${t(m.labelKey)}
              </span>
            `)}
          </div>
        </div>

        <!-- ── RÔLES ── -->
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          ${ROLES.map(r => html`
            <button
              key=${r.id}
              onClick=${() => go(r.id)}
              className=${'group relative overflow-hidden rounded-2xl app-surface text-left transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl active:scale-[.97]'}
              style=${{ boxShadow:'0 0 0 1px rgba(255,255,255,.08)', padding:'clamp(14px,2.2vw,22px)' }}
            >
              <div className=${'absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r rounded-t-2xl ' + r.color}></div>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
                   style=${{ background: 'radial-gradient(ellipse at 50% 0%, ' + r.glow + ', transparent 65%)' }}></div>

              <div className="relative z-10 flex flex-col gap-3 h-full">
                <div className="flex items-start justify-between">
                  <span className="flex items-center justify-center rounded-xl app-panel transition-transform duration-300 group-hover:scale-110"
                        style=${{ width:'clamp(44px,6.5vw,60px)', height:'clamp(44px,6.5vw,60px)' }}>
                    ${roleIcon(r)}
                  </span>
                  <span className="text-white/25 group-hover:text-white/60 transition-colors text-base mt-1">↗</span>
                </div>
                <div>
                  <div className="font-black text-white" style=${{ fontSize:'clamp(.9rem,1.8vw,1.1rem)' }}>
                    ${t(r.labelKey)}
                  </div>
                  <div className="mt-0.5 text-white/45 leading-5" style=${{ fontSize:'clamp(.72rem,1.3vw,.82rem)' }}>
                    ${t(r.subKey)}
                  </div>
                </div>
                <div className="mt-auto">
                  <div className="h-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                       style=${{ background: 'linear-gradient(to right, ' + r.accent + ', transparent)' }}></div>
                </div>
              </div>
            </button>
          `)}
        </section>

        <!-- ── SÉPARATEUR ── -->
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/6"></div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/22">${t('home.whatCanDo')}</span>
          <div className="flex-1 h-px bg-white/6"></div>
        </div>

        <!-- ── FEATURES compact ── -->
        <section className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          ${FEATURES.map(f => html`
            <div key=${f.titleKey}
                 className="rounded-xl app-panel flex flex-col items-center gap-2 text-center"
                 style=${{ padding:'10px 8px' }}>
              <span className="flex items-center justify-center rounded-lg"
                    style=${{
                      width: '36px', height: '36px',
                      background: f.color + '20',
                      border: '1px solid ' + f.color + '40',
                    }}>
                <${GameIcon} name=${f.iconName} className="h-5 w-5" />
              </span>
              <div className="text-white font-bold leading-tight" style=${{ fontSize:'.72rem' }}>${t(f.titleKey)}</div>
            </div>
          `)}
        </section>

        <!-- ── CTA CRÉER UN QUIZ ── -->
        <div className="text-center pb-2">
          <button
            onClick=${() => go('admin')}
            className="inline-flex items-center gap-3 font-black text-white rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl active:scale-[.97]"
            style=${{
              fontSize: 'clamp(1rem,1.8vw,1.15rem)',
              padding: 'clamp(14px,2vw,18px) clamp(28px,4vw,48px)',
              background: 'linear-gradient(135deg, #7c3aed 0%, #4338ca 50%, #1d4ed8 100%)',
              boxShadow: '0 6px 32px rgba(124,58,237,.50), inset 0 1px 0 rgba(255,255,255,.18)',
              border: '1px solid rgba(255,255,255,.15)',
            }}
          >
            <${UiIcon} name="settings" className="h-6 w-6" />
            ${t('home.createQuiz')}
            <span style=${{ fontSize:'.9rem', opacity:'.7' }}>→</span>
          </button>
        </div>

      </div>
    </div>
  `;
}
