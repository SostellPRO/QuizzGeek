import { useEffect, useState } from 'react';
import { html } from '../../utils.js';
import { useGame } from '../../contexts/GameContext.js';
import { Btn, Alert, UiIcon } from '../../components/ui.js';

const AVATARS = [
  '😀','😎','🤓','🥳','🤩','😄','🚀','⚡','🔥','🎸',
  '🎯','🏆','💎','🌟','🍕','🎮','🧠','🎬','📺','🎤',
  '🪩','🕹️','🎲','👾','🧩','🍔','🎧','📣','🛸','✨',
];
const DEFAULT_VIS = 12;

export default function PlayerJoin({ suggestedCode = '' }) {
  const { socket, setPlayerSession, teams, gameState, navigate, soundPlay, t } = useGame();

  const [code, setCode] = useState(suggestedCode);
  const [pseudo, setPseudo] = useState('');
  const [teamId, setTeamId] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [showAll, setShowAll] = useState(false);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionTeams, setSessionTeams] = useState([]);

  const visAvatars = showAll ? AVATARS : AVATARS.slice(0, DEFAULT_VIS);

  useEffect(() => {
    const sessionCode = code.trim().toUpperCase();
    if (sessionCode.length < 4) {
      setSessionTeams([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/sessions/${encodeURIComponent(sessionCode)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        setSessionTeams(data?.session?.teams || []);
      })
      .catch(() => {
        if (!cancelled) setSessionTeams([]);
      });
    return () => { cancelled = true; };
  }, [code]);

  const join = async () => {
    soundPlay?.('answer');
    try { navigator.vibrate?.([16, 24, 36]); } catch {}
    const sessionCode = code.trim().toUpperCase();
    const p = pseudo.trim();
    if (!sessionCode) { soundPlay?.('error'); setAlert({ type: 'error', message: `${t('common.sessionCode')} requis.` }); return; }
    if (!p) { soundPlay?.('error'); setAlert({ type: 'error', message: `${t('player.pseudo')} requis.` }); return; }
    if (!socket) return;
    setLoading(true);
    setAlert(null);
    socket.emit('join:player', { sessionCode, pseudo: p, teamId: teamId || null, avatar }, (res) => {
      setLoading(false);
      if (!res?.ok) {
        soundPlay?.('error');
        setAlert({ type: 'error', message: res?.error || 'Connexion impossible.' });
        return;
      }
      soundPlay?.('success');
      const player = res.player || {};
      const session = {
        playerId: player.id,
        pseudo: player.pseudo || p,
        sessionCode,
        reconnectToken: player.reconnectToken,
        teamId: player.teamId || teamId || null,
        teamName: player.teamName || teams.find(t => t.id === teamId)?.name || null,
        avatar: player.avatar || avatar,
      };
      localStorage.setItem('quiz_player_session', JSON.stringify(session));
      setPlayerSession(session);
    });
  };

  const teamsList = (gameState?.teams?.length ? gameState.teams : teams?.length ? teams : sessionTeams || []);
  const hasTeams = teamsList.length > 0;

  return html`
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-6">
      <div className="w-full max-w-md animate-fade-in">
        <button onClick=${() => navigate('home')} className="mb-5 inline-flex rounded-lg app-chip px-3 py-2 text-sm font-bold text-white/58 transition-colors hover:text-white">
          <${UiIcon} name="back" className="mr-1 h-4 w-4" /> ${t('common.home')}
        </button>

        <div className="rounded-lg app-surface p-5 sm:p-6">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-lg app-panel text-4xl">${avatar}</div>
            <h1 className="font-display text-4xl font-black gradient-text">${t('player.joinTitle')}</h1>
            <p className="mt-2 text-sm text-white/48">${t('player.joinDesc')}</p>
          </div>

          ${alert && html`<div className="mb-4"><${Alert} type=${alert.type} message=${alert.message} /></div>`}

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">${t('common.sessionCode')}</label>
              <input
                type="text"
                value=${code}
                onInput=${e => setCode(e.target.value.toUpperCase())}
                placeholder="1234"
                maxLength="6"
                className="rounded-lg border border-white/10 bg-bg-input/90 px-5 py-4 text-center font-mono text-2xl font-black tracking-[0.3em] text-white outline-none transition-colors placeholder-white/20 focus:border-sky-400/70"
                onKeyDown=${e => e.key === 'Enter' && join()}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">${t('player.pseudo')}</label>
              <input
                type="text"
                value=${pseudo}
                onInput=${e => setPseudo(e.target.value)}
                placeholder=${t('player.pseudoPlaceholder')}
                maxLength="24"
                className="min-h-[50px] rounded-lg border border-white/10 bg-bg-input/90 px-4 py-3 text-base text-white outline-none transition-colors placeholder-white/30 focus:border-sky-400/70"
                onKeyDown=${e => e.key === 'Enter' && join()}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-white/70">${t('player.avatar')}</label>
              <div className="rounded-lg app-panel p-3">
                <div className="grid grid-cols-6 gap-2">
                  ${visAvatars.map(em => html`
                    <button
                      key=${em}
                      onClick=${() => { soundPlay?.('answer'); try { navigator.vibrate?.(12); } catch {}; setAvatar(em); }}
                      className=${`mobile-choice flex aspect-square items-center justify-center rounded-lg border text-2xl transition-all ${avatar === em ? 'scale-105 border-sky-300/70 bg-sky-400/18 shadow-neon-blue' : 'border-white/0 hover:border-white/12 hover:bg-white/8'}`}
                    >
                      ${em}
                    </button>
                  `)}
                </div>
                <button onClick=${() => setShowAll(!showAll)} className="mt-3 w-full rounded-lg bg-white/5 px-3 py-2 text-center text-xs font-bold text-white/50 transition-colors hover:bg-white/9 hover:text-white/80">
                  ${showAll ? t('player.showLess') : `${t('player.showMore')} (${AVATARS.length - DEFAULT_VIS})`}
                </button>
              </div>
            </div>

            ${hasTeams && html`
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-white/70">${t('player.team')}</label>
                <select value=${teamId} onChange=${e => setTeamId(e.target.value)} className="min-h-[50px] rounded-lg border border-white/10 bg-bg-input/90 px-4 py-3 text-base text-white outline-none transition-colors focus:border-sky-400/70">
                  <option value="">- ${t('player.chooseTeam')} -</option>
                  ${teamsList.map(t => html`<option key=${t.id} value=${t.id}>${t.name}</option>`)}
                </select>
              </div>
            `}

            <${Btn} variant="primary" wide size="lg" onClick=${join} disabled=${loading}>
              ${loading ? `⏳ ${t('player.connecting')}` : `🎮 ${t('player.joinGame')}`}
            <//>
          </div>
        </div>
      </div>
    </div>
  `;
}
