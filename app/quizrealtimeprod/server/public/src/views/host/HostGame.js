import { useEffect, useState } from 'react';
import { html } from '../../utils.js';
import { useGame } from '../../contexts/GameContext.js';
import { Alert } from '../../components/ui.js';
import PilotageTab from './tabs/PilotageTab.js';
import GestionTab from './tabs/GestionTab.js';

const TABS = [
  { id: 'pilotage', label: 'Pilotage', icon: '⚡' },
  { id: 'gestion', label: 'Joueurs', icon: '👥' },
];

const PHASE_LABELS = {
  lobby: 'Lobby',
  round_intro: 'Presentation',
  training_video: 'Entrainement',
  question: 'Question',
  waiting: 'Attente',
  answer_reveal: 'Solution',
  manual_scoring: 'Arbitrage',
  round_end: 'Fin de manche',
  results: 'Resultats',
  end: 'Finale',
};

export default function HostGame() {
  const { gameState: gs, players, hostSession, setHostSession, navigate } = useGame();
  const [tab, setTab] = useState('pilotage');
  const [actionError, setActionError] = useState('');

  const phase = gs?.status || 'lobby';
  const connectedPlayers = players.filter(p => p.connected && !p.isBot).length;
  const bots = players.filter(p => p.isBot).length;

  const disconnect = () => {
    if (!confirm('Quitter la session host ?')) return;
    localStorage.removeItem('quiz_host_session_code');
    localStorage.removeItem('quiz_host_key');
    setHostSession({ sessionCode: '', hostKey: '', connected: false });
    navigate('home');
  };

  useEffect(() => {
    const onError = (event) => {
      setActionError(event.detail?.message || 'Action impossible.');
      window.setTimeout(() => setActionError(''), 4500);
    };
    window.addEventListener('quiz:host-error', onError);
    return () => window.removeEventListener('quiz:host-error', onError);
  }, []);

  return html`
    <div className="flex min-h-[100dvh] flex-col">
      <header className="sticky top-0 z-20 border-b border-white/8 bg-bg-alt/82 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick=${disconnect}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg app-chip text-white/58 transition-colors hover:text-white"
                title="Quitter"
              >
                ←
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full app-chip px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white/42">Session</span>
                  <span className="font-mono text-sm font-black tracking-widest text-sky-300">${hostSession?.sessionCode}</span>
                  <span className="rounded-full bg-teal-400/12 px-2.5 py-1 text-xs font-bold text-teal-200">${PHASE_LABELS[phase] || phase}</span>
                </div>
                <div className="mt-1 truncate text-sm text-white/48">
                  ${gs?.quizTitle || 'En attente de quiz'}
                </div>
              </div>
            </div>

            <div className="hidden grid-cols-2 gap-2 sm:grid">
              <div className="rounded-lg app-panel px-3 py-2 text-right">
                <div className="text-xs font-semibold text-white/38">Joueurs</div>
                <div className="font-mono text-lg font-black text-teal-300">${connectedPlayers}</div>
              </div>
              <div className="rounded-lg app-panel px-3 py-2 text-right">
                <div className="text-xs font-semibold text-white/38">Bots</div>
                <div className="font-mono text-lg font-black text-amber-300">${bots}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg app-panel p-1">
            ${TABS.map(t => html`
              <button
                key=${t.id}
                onClick=${() => setTab(t.id)}
                className=${`flex min-h-[42px] items-center justify-center gap-2 rounded-lg text-sm font-extrabold transition-all ${
                  tab === t.id
                    ? 'bg-sky-400/16 text-sky-100 shadow-neon-blue'
                    : 'text-white/48 hover:bg-white/8 hover:text-white'
                }`}
              >
                <span>${t.icon}</span>
                <span>${t.label}</span>
              </button>
            `)}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-5">
        ${actionError && html`<div className="mb-4"><${Alert} type="error" message=${actionError} /></div>`}
        ${tab === 'pilotage' && html`<${PilotageTab} />`}
        ${tab === 'gestion' && html`<${GestionTab} />`}
      </main>
    </div>
  `;
}
