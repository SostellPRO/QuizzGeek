import { useState, useEffect } from 'react';
import { html } from '../../utils.js';
import { useGame } from '../../contexts/GameContext.js';
import { Btn, Alert, Input } from '../../components/ui.js';

const AVATARS = [
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
  '🦁','🐸','🐵','🐔','🐧','🐦','🦆','🦅','🦉','🦇',
  '🐺','🐗','🦝','🦄','🦋','🐙','🦑','🐬','🦈','🐊',
  '🎮','🚀','⚡','🔥','🎸','🎯','🏆','💎','🌟','🍕',
];
const DEFAULT_VIS = 12;

export default function PlayerJoin({ suggestedCode = '' }) {
  const { socket, setPlayerSession, players, teams, gameState, navigate } = useGame();

  const [code,     setCode]     = useState(suggestedCode);
  const [pseudo,   setPseudo]   = useState('');
  const [teamId,   setTeamId]   = useState('');
  const [avatar,   setAvatar]   = useState(AVATARS[0]);
  const [showAll,  setShowAll]  = useState(false);
  const [showTeams,setShowTeams]= useState(false);
  const [alert,    setAlert]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  const visAvatars = showAll ? AVATARS : AVATARS.slice(0, DEFAULT_VIS);

  const join = async () => {
    const sessionCode = code.trim().toUpperCase();
    const p = pseudo.trim();
    if (!sessionCode) { setAlert({ type: 'error', message: 'Code de session requis.' }); return; }
    if (!p) { setAlert({ type: 'error', message: 'Pseudonyme requis.' }); return; }
    if (!socket) return;
    setLoading(true);
    setAlert(null);
    socket.emit('join:player', { sessionCode, pseudo: p, teamId: teamId || null, avatar }, (res) => {
      setLoading(false);
      if (!res?.ok) {
        setAlert({ type: 'error', message: res?.error || 'Connexion impossible.' });
        return;
      }
      const session = {
        playerId:       res.playerId,
        pseudo:         p,
        sessionCode,
        reconnectToken: res.reconnectToken,
        teamId:         res.teamId || teamId || null,
        teamName:       res.teamName || teams.find(t => t.id === teamId)?.name || null,
        avatar,
      };
      localStorage.setItem('quiz_player_session', JSON.stringify(session));
      setPlayerSession(session);
    });
  };

  const teamsList = (gameState?.teams || teams || []);
  const hasTeams  = teamsList.length > 0;

  return html`
    <div className="flex flex-col min-h-[100dvh] bg-bg px-4 py-6 max-w-md mx-auto">

      <!-- Back -->
      <button onClick=${() => navigate('home')} className="text-white/40 hover:text-white text-sm mb-6 self-start flex items-center gap-1">
        ← Accueil
      </button>

      <!-- Title -->
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🎮</div>
        <h1 className="font-display text-3xl font-black gradient-text">Rejoindre</h1>
        <p className="text-white/40 text-sm mt-1">Entre le code de session</p>
      </div>

      ${alert && html`<${Alert} type=${alert.type} message=${alert.message} />`}

      <!-- Form -->
      <div className="flex flex-col gap-4 mt-2">

        <!-- Session code -->
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-white/70">Code de session</label>
          <input
            type="text"
            value=${code}
            onInput=${e => setCode(e.target.value.toUpperCase())}
            placeholder="ex: 1234"
            maxLength="6"
            className="bg-bg-input border border-white/10 rounded-xl px-5 py-4 text-white text-2xl font-mono font-bold tracking-[0.3em] text-center placeholder-white/20 focus:border-accent/60 outline-none transition-colors"
            onKeyDown=${e => e.key === 'Enter' && join()}
          />
        </div>

        <!-- Pseudo -->
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-white/70">Pseudo</label>
          <input
            type="text"
            value=${pseudo}
            onInput=${e => setPseudo(e.target.value)}
            placeholder="Ton prénom / surnom"
            maxLength="24"
            className="bg-bg-input border border-white/10 rounded-xl px-4 py-3 text-white text-base placeholder-white/30 focus:border-accent/60 outline-none transition-colors min-h-[48px]"
            onKeyDown=${e => e.key === 'Enter' && join()}
          />
        </div>

        <!-- Avatar -->
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-white/70">Avatar</label>
          <div className="bg-bg-input rounded-xl border border-white/8 p-3">
            <div className="grid grid-cols-6 gap-2">
              ${visAvatars.map(em => html`
                <button
                  key=${em}
                  onClick=${() => setAvatar(em)}
                  className=${`text-2xl p-2 rounded-lg transition-all ${avatar === em ? 'bg-accent/25 border border-accent/60 scale-110' : 'hover:bg-white/5 border border-transparent'}`}
                >
                  ${em}
                </button>
              `)}
            </div>
            <button
              onClick=${() => setShowAll(!showAll)}
              className="text-xs text-white/40 hover:text-white/70 mt-2 w-full text-center transition-colors"
            >
              ${showAll ? '▲ Moins' : `▼ Voir plus (${AVATARS.length - DEFAULT_VIS} autres)`}
            </button>
          </div>
        </div>

        <!-- Teams (if available) -->
        ${hasTeams && html`
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/70">Équipe (optionnel)</label>
            <select
              value=${teamId}
              onChange=${e => setTeamId(e.target.value)}
              className="bg-bg-input border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-accent/60 outline-none transition-colors min-h-[48px] cursor-pointer"
            >
              <option value="">— Aucune équipe —</option>
              ${teamsList.map(t => html`<option key=${t.id} value=${t.id}>${t.name}</option>`)}
            </select>
          </div>
        `}

        <!-- Join button -->
        <button
          onClick=${join}
          disabled=${loading}
          className="w-full mt-2 py-4 rounded-2xl font-display font-black text-lg text-white bg-gradient-to-r from-violet-600 to-accent ring-pulse transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ${loading ? '⏳ Connexion…' : '▶ Rejoindre la partie'}
        </button>

      </div>
    </div>
  `;
}
