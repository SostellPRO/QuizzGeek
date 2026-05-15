import { html } from '../utils.js';
import { useGame } from '../contexts/GameContext.js';
import { GameIcon, UiIcon } from '../components/ui.js';

// Palette rôles — base bleu ciel / bleu nuit
const ROLES = [
  { id: 'player',  iconType: 'game', iconName: 'profile', labelKey: 'role.player.label',  subKey: 'role.player.sub',  color: 'from-sky-400 to-cyan-500',   glow: 'rgba(14,165,233,.35)',  accent: '#0ea5e9' },
  { id: 'host',    iconType: 'game', iconName: 'host',    labelKey: 'role.host.label',    subKey: 'role.host.sub',    color: 'from-blue-400 to-indigo-500', glow: 'rgba(59,130,246,.30)', accent: '#3b82f6' },
  { id: 'display', iconType: 'game', iconName: 'display', labelKey: 'role.display.label', subKey: 'role.display.sub', color: 'from-cyan-400 to-sky-600',   glow: 'rgba(56,189,248,.28)',  accent: '#38bdf8' },
  { id: 'admin',   iconType: 'ui',   iconName: 'settings',labelKey: 'role.admin.label',   subKey: 'role.admin.sub',   color: 'from-slate-400 to-slate-600',glow: 'rgba(148,163,184,.20)', accent: '#94a3b8' },
];

// Couleurs distinctes par type de question
const Q_COLORS = {
  qcm:            { color: '#0ea5e9', glow: 'rgba(14,165,233,.25)' },   // sky blue
  true_false:     { color: '#10b981', glow: 'rgba(16,185,129,.25)' },   // emerald
  rapidite:       { color: '#f97316', glow: 'rgba(249,115,22,.25)'  },  // orange
  vote:           { color: '#3b82f6', glow: 'rgba(59,130,246,.25)'  },  // blue
  burger:         { color: '#a855f7', glow: 'rgba(168,85,247,.25)'  },  // violet
  video_challenge:{ color: '#ec4899', glow: 'rgba(236,72,153,.25)'  },  // rose/pink
  ceremony:       { color: '#f59e0b', glow: 'rgba(245,158,11,.25)'  },  // amber/gold
};

const MODES = [
  { iconName: 'category', labelKey: 'qtype.qcm',            ...Q_COLORS.qcm            },
  { iconName: 'correct',  labelKey: 'qtype.true_false',      ...Q_COLORS.true_false     },
  { iconName: 'rapidite', labelKey: 'qtype.rapidite',        ...Q_COLORS.rapidite       },
  { iconName: 'vote',     labelKey: 'qtype.vote',            ...Q_COLORS.vote           },
  { iconName: 'burger',   labelKey: 'qtype.burger',          ...Q_COLORS.burger         },
  { iconName: 'karaoke',  labelKey: 'qtype.video_challenge', ...Q_COLORS.video_challenge},
];

const FEATURES = [
  { iconName: 'category', titleKey: 'feature.qcm.title',      descKey: 'feature.qcm.desc',      ...Q_COLORS.qcm            },
  { iconName: 'buzzer',   titleKey: 'feature.buzzer.title',   descKey: 'feature.buzzer.desc',   ...Q_COLORS.rapidite       },
  { iconName: 'vote',     titleKey: 'feature.vote.title',     descKey: 'feature.vote.desc',     ...Q_COLORS.vote           },
  { iconName: 'burger',   titleKey: 'feature.burger.title',   descKey: 'feature.burger.desc',   ...Q_COLORS.burger         },
  { iconName: 'karaoke',  titleKey: 'feature.video.title',    descKey: 'feature.video.desc',    ...Q_COLORS.video_challenge},
  { iconName: 'scores',   titleKey: 'feature.ceremony.title', descKey: 'feature.ceremony.desc', ...Q_COLORS.ceremony       },
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
         style=${{ gap: 'clamp(12px,2.2vh,22px)' }}>

      <div aria-hidden="true" style=${{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none', overflow:'hidden' }}>
        <div style=${{ position:'absolute', top:'-15vw', right:'-10vw', width:'55vw', height:'55vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(14,165,233,.12) 0%, transparent 70%)', filter:'blur(60px)' }} />
        <div style=${{ position:'absolute', bottom:'-10vw', left:'-8vw', width:'45vw', height:'45vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(56,189,248,.08) 0%, transparent 70%)', filter:'blur(50px)' }} />
      </div>

      <div className="relative z-10 w-full max-w-5xl animate-fade-in flex flex-col"
           style=${{ gap: 'clamp(12px,2.2vh,22px)' }}>

        <!-- ── HERO ── -->
        <div className="text-center flex flex-col items-center" style=${{ gap: 'clamp(5px,1vh,10px)' }}>

          <div className="inline-flex items-center gap-2 rounded-full app-chip px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-sky-300">
            <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" style=${{ boxShadow:'0 0 8px #38bdf8' }}></span>
            ${t('home.badge')}
          </div>

          <h1 className="font-display font-black leading-none gradient-text" style=${{ fontSize:'clamp(2.8rem,8vw,5.2rem)', margin:'0' }}>
            QuizzGeek
          </h1>

          <p className="font-medium whitespace-nowrap overflow-hidden text-ellipsis w-full"
             style=${{ fontSize:'clamp(.78rem,1.3vw,.95rem)', color:'rgba(125,211,252,.65)' }}>
            ${t('home.tagline')}
          </p>

          <div className="flex flex-wrap justify-center gap-1.5">
            ${MODES.map(m => html`
              <span key=${m.labelKey}
                className="inline-flex items-center gap-1.5 font-bold text-white"
                style=${{
                  background: 'linear-gradient(130deg, ' + m.color + '30 0%, ' + m.color + '10 100%)',
                  borderRadius: '8px',
                  padding: '5px 11px',
                  fontSize: '.78rem',
                  border: '1px solid ' + m.color + '55',
                  boxShadow: '0 2px 12px ' + m.glow,
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
              style=${{ padding:'clamp(12px,2vw,20px)' }}
            >
              <div className=${'absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r rounded-t-2xl ' + r.color}></div>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
                   style=${{ background: 'radial-gradient(ellipse at 50% 0%, ' + r.glow + ', transparent 65%)' }}></div>
              <div className="relative z-10 flex flex-col gap-3 h-full">
                <div className="flex items-start justify-between">
                  <span className="flex items-center justify-center rounded-xl app-panel transition-transform duration-300 group-hover:scale-110"
                        style=${{ width:'clamp(42px,6vw,56px)', height:'clamp(42px,6vw,56px)' }}>
                    ${roleIcon(r)}
                  </span>
                  <span className="group-hover:opacity-80 transition-opacity text-sm mt-1"
                        style=${{ color: r.accent, opacity: 0.35 }}>↗</span>
                </div>
                <div>
                  <div className="font-black text-white" style=${{ fontSize:'clamp(.88rem,1.6vw,1.05rem)' }}>
                    ${t(r.labelKey)}
                  </div>
                  <div className="mt-0.5 leading-5" style=${{ fontSize:'clamp(.7rem,1.2vw,.8rem)', color:'rgba(125,211,252,.50)' }}>
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
          <div className="flex-1 h-px" style=${{ background:'rgba(56,189,248,.12)' }}></div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style=${{ color:'rgba(56,189,248,.30)' }}>${t('home.whatCanDo')}</span>
          <div className="flex-1 h-px" style=${{ background:'rgba(56,189,248,.12)' }}></div>
        </div>

        <!-- ── FEATURES ── -->
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          ${FEATURES.map(f => html`
            <div key=${f.titleKey}
                 className="rounded-xl flex items-center gap-3"
                 style=${{
                   padding: 'clamp(10px,1.8vh,16px) clamp(12px,2vw,18px)',
                   background: 'linear-gradient(135deg, ' + f.color + '14 0%, rgba(5,14,28,.6) 100%)',
                   border: '1px solid ' + f.color + '30',
                   borderLeft: '3px solid ' + f.color,
                   boxShadow: '0 4px 24px ' + f.glow,
                 }}>
              <span className="flex-shrink-0 flex items-center justify-center rounded-xl"
                    style=${{
                      width: 'clamp(36px,5vw,46px)', height: 'clamp(36px,5vw,46px)',
                      background: f.color + '1a',
                      border: '1px solid ' + f.color + '45',
                    }}>
                <${GameIcon} name=${f.iconName} className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <div className="font-black text-white leading-tight" style=${{ fontSize:'clamp(.78rem,1.3vw,.9rem)' }}>
                  ${t(f.titleKey)}
                </div>
                <div className="mt-0.5 leading-4" style=${{ fontSize:'clamp(.67rem,1.1vw,.75rem)', color:'rgba(125,211,252,.45)' }}>
                  ${t(f.descKey)}
                </div>
              </div>
            </div>
          `)}
        </section>

        <!-- ── CTA CRÉER UN QUIZ ── -->
        <div className="text-center pb-2">
          <button
            onClick=${() => go('admin')}
            className="inline-flex items-center gap-3 font-black text-white rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl active:scale-[.97]"
            style=${{
              fontSize: 'clamp(.95rem,1.6vw,1.1rem)',
              padding: 'clamp(12px,1.8vh,16px) clamp(28px,4vw,48px)',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 50%, #0369a1 100%)',
              boxShadow: '0 6px 32px rgba(14,165,233,.45), inset 0 1px 0 rgba(255,255,255,.20)',
              border: '1px solid rgba(56,189,248,.30)',
            }}
          >
            <${UiIcon} name="settings" className="h-5 w-5" />
            ${t('home.createQuiz')}
            <span style=${{ fontSize:'.85rem', opacity:'.75' }}>→</span>
          </button>
        </div>

      </div>
    </div>
  `;
}
