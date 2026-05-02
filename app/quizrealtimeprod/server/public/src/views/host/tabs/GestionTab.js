import { useState } from 'react';
import { html } from '../../../utils.js';
import { useGame } from '../../../contexts/GameContext.js';
import { Btn, Badge, Card } from '../../../components/ui.js';

export default function GestionTab() {
  const { gameState: gs, players, teams, hostAction, socket, hostSession } = useGame();
  const [points, setPoints]   = useState(100);
  const [newTeam, setNewTeam] = useState('');

  const phase   = gs?.status || 'lobby';
  const sc      = hostSession?.sessionCode;
  const hk      = hostSession?.hostKey;

  const kickPlayer = (playerId) => {
    if (!confirm('Éjecter ce joueur ?')) return;
    hostAction('kick_player', { playerId });
  };

  const awardPlayer = (playerId) => {
    const pts = parseInt(prompt(`Points à attribuer (négatif = retirer) :`, '100'));
    if (isNaN(pts)) return;
    hostAction('award_manual_points', { playerId, points: pts });
  };

  const connPlayers = players.filter(p => p.connected);

  return html`
    <div className="flex flex-col gap-5">

      <!-- Player count -->
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white/80">
          Joueurs connectés
          <span className="ml-2 text-sm font-medium text-white/40">(${connPlayers.length})</span>
        </h2>
        ${phase === 'lobby' && html`
          <${Btn} variant="danger" size="sm" onClick=${() => hostAction('eject_all_players')}>
            Éjecter tous
          <//>
        `}
      </div>

      <!-- Players list -->
      <div className="flex flex-col gap-2">
        ${connPlayers.length === 0 && html`
          <div className="text-center py-8 text-white/30 text-sm">Aucun joueur connecté</div>
        `}
        ${connPlayers.map(p => html`
          <div key=${p.id || p.playerId} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-card border border-white/8">
            <span className="text-2xl">${p.avatar || '🎮'}</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">${p.pseudo || '?'}</div>
              ${p.teamName && html`<div className="text-xs text-white/40">${p.teamName}</div>`}
            </div>
            <div className="font-mono font-bold text-neon-green text-sm flex-shrink-0">${p.scoreTotal ?? 0}</div>
            <div className="flex gap-1">
              <button
                onClick=${() => awardPlayer(p.id || p.playerId)}
                className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-white/40 hover:text-emerald-400 transition-colors"
                title="Attribuer des points"
              >±</button>
              <button
                onClick=${() => kickPlayer(p.id || p.playerId)}
                className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-colors"
                title="Éjecter"
              >✕</button>
            </div>
          </div>
        `)}
      </div>

      <!-- Teams section -->
      ${teams.length > 0 && html`
        <div>
          <h3 className="text-sm font-semibold text-white/60 mb-3 uppercase tracking-wider">Équipes</h3>
          <div className="flex flex-col gap-2">
            ${teams.map(t => html`
              <div key=${t.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-bg-card border border-white/8">
                <div>
                  <div className="font-semibold text-sm">${t.name}</div>
                  <div className="text-xs text-white/40">${(t.memberIds || []).length} membre(s)</div>
                </div>
                <div className="font-mono font-bold text-neon-green text-sm">${t.score ?? 0}</div>
              </div>
            `)}
          </div>
        </div>
      `}

      <!-- Bulk award -->
      <div className="rounded-xl bg-bg-card border border-white/8 p-4">
        <h3 className="text-sm font-semibold text-white/60 mb-3">Points en masse</h3>
        <div className="flex gap-2">
          <input
            type="number"
            value=${points}
            onInput=${e => setPoints(parseInt(e.target.value) || 0)}
            className="flex-1 bg-bg-input border border-white/10 rounded-xl px-4 py-2 text-white text-sm font-mono focus:border-accent/60 outline-none transition-colors min-h-[42px]"
          />
          <${Btn} variant="success" size="sm" onClick=${() => hostAction('award_all', { points })}>
            Tous +${points}
          <//>
        </div>
      </div>

    </div>
  `;
}
