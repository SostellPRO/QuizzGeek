import { useEffect } from 'react';
import { html } from '../../utils.js';
import { useGame } from '../../contexts/GameContext.js';
import HostConnect from './HostConnect.js';
import HostGame from './HostGame.js';

export default function HostView() {
  const { socket, hostSession, setHostSession } = useGame();

  // Auto-reconnect if we have saved session
  useEffect(() => {
    if (!socket || hostSession?.connected) return;
    const sc = localStorage.getItem('quiz_host_session_code');
    const hk = localStorage.getItem('quiz_host_key');
    if (!sc || !hk) return;
    socket.emit('join:host', { sessionCode: sc, hostKey: hk }, (res) => {
      if (res?.ok) {
        setHostSession({ sessionCode: sc, hostKey: hk, connected: true });
      }
    });
  }, [socket]); // eslint-disable-line

  if (!hostSession?.connected) return html`<${HostConnect} />`;
  return html`<${HostGame} />`;
}
