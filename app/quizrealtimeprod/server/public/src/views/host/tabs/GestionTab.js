import { useState } from 'react';
import { html } from '../../../utils.js';
import { useGame } from '../../../contexts/GameContext.js';
import { Btn } from '../../../components/ui.js';

export default function GestionTab() {
  const { gameState: gs, players, teams, hostAction } = useGame();
  const [points, setPoints] = useState(100);
  const [teamName, setTeamName] = useState('');

  const phase = gs?.status || 'lobby';

  const kickPlayer = (playerId) => {
    if (!confirm('Ejecter ce joueur ?')) return;
    hostAction('kick_player', { playerId });
  };

  const awardPlayer = (playerId) => {
    const pts = parseInt(prompt('Points a attribuer (negatif = retirer) :', '100'));
    if (isNaN(pts)) return;
    hostAction('award_manual_points', { playerId, points: pts });
  };

  const createTeam = () => {
    const name = teamName.trim();
    if (!name) return;
    hostAction('create_team', { name });
    setTeamName('');
  };

  const renameTeam = (team) => {
    const name = prompt('Nouveau nom de l equipe :', team.name);
    if (!name?.trim()) return;
    hostAction('rename_team', { teamId: team.id, newName: name.trim() });
  };

  const connPlayers = players.filter(p => p.connected);

  return html`
    <div className="flex flex-col gap-5">
      <section className="rounded-lg app-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-sky-200">Participants</div>
            <h2 className="mt-1 text-xl font-black text-white">
              Joueurs connectes
              <span className="ml-2 font-mono text-base text-white/42">${connPlayers.length}</span>
            </h2>
          </div>
          ${phase === 'lobby' && html`
            <${Btn} variant="danger" size="sm" onClick=${() => confirm('Ejecter tous les joueurs ?') && hostAction('eject_all_players')}>
              Ejecter tous
            <//>
          `}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        ${connPlayers.length === 0 && html`
          <div className="rounded-lg app-panel py-10 text-center text-sm text-white/38">Aucun joueur connecte</div>
        `}
        ${connPlayers.map(p => html`
          <div key=${p.id || p.playerId} className="flex items-center gap-3 rounded-lg app-panel px-4 py-3 transition-colors hover:border-sky-300/28">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/7 text-2xl">${p.avatar || '🎮'}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-extrabold text-white">${p.pseudo || '?'}</div>
              ${p.teamName && html`<div className="text-xs text-white/40">${p.teamName}</div>`}
            </div>
            <div className="shrink-0 rounded-full bg-teal-400/12 px-2.5 py-1 font-mono text-sm font-black text-teal-300">${p.scoreTotal ?? 0}</div>
            <div className="flex gap-1">
              <button
                onClick=${() => awardPlayer(p.id || p.playerId)}
                className="min-h-[34px] rounded-lg bg-white/6 px-2.5 text-xs font-black text-white/48 transition-colors hover:bg-teal-400/14 hover:text-teal-200"
                title="Attribuer des points"
              >+/-</button>
              <button
                onClick=${() => kickPlayer(p.id || p.playerId)}
                className="min-h-[34px] rounded-lg bg-white/6 px-2.5 text-xs font-black text-white/48 transition-colors hover:bg-rose-500/16 hover:text-rose-300"
                title="Ejecter"
              >X</button>
            </div>
          </div>
        `)}
      </section>

      <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-white/42">Equipes</h3>
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value=${teamName}
              onInput=${e => setTeamName(e.target.value)}
              placeholder="Nom de l equipe"
              className="min-h-[42px] flex-1 rounded-lg border border-white/10 bg-bg-input/90 px-4 py-2 text-sm text-white outline-none transition-colors focus:border-sky-400/70"
              onKeyDown=${e => e.key === 'Enter' && createTeam()}
            />
            <${Btn} variant="primary" size="sm" onClick=${createTeam}>Creer<//>
          </div>
          ${teams.length === 0 && html`
            <div className="rounded-lg app-panel py-6 text-center text-sm text-white/38">Aucune equipe creee</div>
          `}
          ${teams.length > 0 && html`
          <div className="flex flex-col gap-2">
            ${teams.map(t => html`
              <div key=${t.id} className="flex items-center justify-between rounded-lg app-panel px-4 py-3">
                <div>
                  <div className="text-sm font-extrabold text-white">${t.name}</div>
                  <div className="text-xs text-white/40">${players.filter(p => p.teamId === t.id).length} membre(s)</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-teal-400/12 px-2.5 py-1 font-mono text-sm font-black text-teal-300">${t.scoreTotal ?? t.score ?? 0}</div>
                  <button onClick=${() => renameTeam(t)} className="min-h-[34px] rounded-lg bg-white/6 px-2.5 text-xs font-black text-white/48 transition-colors hover:bg-white/10">Renommer</button>
                  <button onClick=${() => confirm('Supprimer cette equipe ?') && hostAction('delete_team', { teamId: t.id })} className="min-h-[34px] rounded-lg bg-white/6 px-2.5 text-xs font-black text-white/48 transition-colors hover:bg-rose-500/16 hover:text-rose-300">X</button>
                </div>
              </div>
            `)}
          </div>
          `}
        </section>

      <section className="rounded-lg app-surface p-4">
        <h3 className="mb-3 text-sm font-extrabold text-white/72">Points en masse</h3>
        <div className="flex gap-2">
          <input
            type="number"
            value=${points}
            onInput=${e => setPoints(parseInt(e.target.value) || 0)}
            className="min-h-[42px] flex-1 rounded-lg border border-white/10 bg-bg-input/90 px-4 py-2 font-mono text-sm text-white outline-none transition-colors focus:border-sky-400/70"
          />
          <${Btn} variant="success" size="sm" onClick=${() => hostAction('award_all', { points })}>
            Tous +${points}
          <//>
        </div>
      </section>
    </div>
  `;
}
