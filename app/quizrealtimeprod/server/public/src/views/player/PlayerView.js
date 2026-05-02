import { useEffect } from 'react';
import { html } from '../../utils.js';
import { useGame } from '../../contexts/GameContext.js';
import PlayerJoin from './PlayerJoin.js';
import PlayerGame from './PlayerGame.js';

export default function PlayerView() {
  const { socket, playerSession, setPlayerSession, gameState } = useGame();

  // Auto-reconnect from localStorage
  useEffect(() => {
    if (!socket || playerSession) return;
    const saved = (() => {
      try { return JSON.parse(localStorage.getItem('quiz_player_session') || 'null'); } catch { return null; }
    })();
    if (!saved) return;
    socket.emit('player:reconnect', {
      sessionCode:    saved.sessionCode,
      reconnectToken: saved.reconnectToken,
      avatar:         saved.avatar || null,
    }, (res) => {
      if (res?.ok) {
        setPlayerSession({ ...saved, playerId: res.playerId || saved.playerId });
      } else {
        localStorage.removeItem('quiz_player_session');
      }
    });
  }, [socket]); // eslint-disable-line

  if (!playerSession) {
    const hash = window.location.hash.slice(1);
    const suggestedCode = hash.startsWith('player-') ? hash.slice(7) : '';
    return html`<${PlayerJoin} suggestedCode=${suggestedCode} />`;
  }

  return html`<${PlayerGame} />`;
}
