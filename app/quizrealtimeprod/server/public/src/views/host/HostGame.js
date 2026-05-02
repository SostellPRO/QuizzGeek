import { useState } from 'react';
import { html } from '../../utils.js';
import { useGame } from '../../contexts/GameContext.js';
import { SessionBanner } from '../../components/ui.js';
import PilotageTab from './tabs/PilotageTab.js';
import GestionTab from './tabs/GestionTab.js';

const TABS = [
  { id: 'pilotage', label: '⚡ Pilotage' },
  { id: 'gestion',  label: '👥 Joueurs' },
];

export default function HostGame() {
  const { gameState: gs, players, hostSession, hostAction, navigate, musicMuted, toggleMute } = useGame();
  const [tab, setTab] = useState('pilotage');

  const phase    = gs?.status || 'lobby';
  const connPlayers = players.filter(p => p.connected).length;

  const disconnect = () => {
    if (!confirm('Quitter la session host ?')) return;
    navigate('home');
  };

  return html`
    <div className="flex flex-col min-h-[100dvh] bg-bg">

      <!-- Top bar -->
      <div className="sticky top-0 z-20 bg-bg-alt border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick=${disconnect} className="text-white/30 hover:text-white text-sm transition-colors">←</button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white/50 text-xs">Session</span>
                <span className="font-mono font-bold text-accent tracking-widest text-sm">${hostSession?.sessionCode}</span>
              </div>
              <div className="text-xs text-white/30">
                ${gs?.quizTitle ? html`📚 ${gs.quizTitle}` : 'En attente…'}
                ${connPlayers > 0 ? html` · <span className="text-neon-green">${connPlayers} joueur(s)</span>` : ''}
              </div>
            </div>
          </div>
          <button
            onClick=${toggleMute}
            className="text-xl w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            title=${musicMuted ? 'Activer la musique' : 'Couper la musique'}
          >
            ${musicMuted ? '🔇' : '🔊'}
          </button>
        </div>

        <!-- Tabs -->
        <div className="flex border-t border-white/5">
          ${TABS.map(t => html`
            <button
              key=${t.id}
              onClick=${() => setTab(t.id)}
              className=${`flex-1 py-3 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              ${t.label}
            </button>
          `)}
        </div>
      </div>

      <!-- Tab content -->
      <div className="flex-1 px-4 py-5 max-w-2xl mx-auto w-full">
        ${tab === 'pilotage' && html`<${PilotageTab} />`}
        ${tab === 'gestion'  && html`<${GestionTab} />`}
      </div>

    </div>
  `;
}
