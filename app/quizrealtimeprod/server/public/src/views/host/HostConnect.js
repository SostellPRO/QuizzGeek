import { useState } from 'react';
import { html } from '../../utils.js';
import { useGame } from '../../contexts/GameContext.js';
import { Btn, Alert, Card } from '../../components/ui.js';

export default function HostConnect() {
  const { socket, hostSession, setHostSession, navigate } = useGame();

  const [code, setCode]   = useState(hostSession?.sessionCode || localStorage.getItem('quiz_host_session_code') || '');
  const [key,  setKey]    = useState(hostSession?.hostKey     || localStorage.getItem('quiz_host_key')         || '');
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  const connect = () => {
    const sessionCode = code.trim().toUpperCase();
    const hostKey     = key.trim();
    if (!sessionCode || !hostKey) {
      setAlert({ type: 'error', message: 'Code de session et clé host requis.' });
      return;
    }
    if (!socket) return;
    setLoading(true);
    setAlert(null);
    socket.emit('join:host', { sessionCode, hostKey }, (res) => {
      setLoading(false);
      if (!res?.ok) {
        setAlert({ type: 'error', message: res?.error || 'Connexion impossible.' });
        return;
      }
      localStorage.setItem('quiz_host_session_code', sessionCode);
      localStorage.setItem('quiz_host_key', hostKey);
      setHostSession({ sessionCode, hostKey, connected: true });
    });
  };

  return html`
    <div className="flex flex-col min-h-[100dvh] bg-bg px-4 py-8 max-w-lg mx-auto">

      <button onClick=${() => navigate('home')} className="text-white/40 hover:text-white text-sm mb-6 self-start">
        ← Accueil
      </button>

      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🎬</div>
        <h1 className="font-display text-3xl font-black gradient-text">Maître de jeu</h1>
        <p className="text-white/40 text-sm mt-1">Connectez-vous à une session</p>
      </div>

      ${alert && html`<div className="mb-4"><${Alert} type=${alert.type} message=${alert.message} /></div>`}

      <${Card}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/70">Code de session</label>
            <input
              type="text"
              value=${code}
              onInput=${e => setCode(e.target.value.toUpperCase())}
              placeholder="ex: 1234"
              maxLength="6"
              className="bg-bg-input border border-white/10 rounded-xl px-5 py-3 text-white text-xl font-mono font-bold tracking-[0.25em] text-center placeholder-white/20 focus:border-accent/60 outline-none transition-colors min-h-[52px]"
              onKeyDown=${e => e.key === 'Enter' && connect()}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/70">Clé host</label>
            <input
              type="text"
              value=${key}
              onInput=${e => setKey(e.target.value)}
              placeholder="demo-host"
              className="bg-bg-input border border-white/10 rounded-xl px-4 py-3 text-white text-base placeholder-white/30 focus:border-accent/60 outline-none transition-colors min-h-[48px]"
              onKeyDown=${e => e.key === 'Enter' && connect()}
            />
          </div>
          <${Btn} variant="primary" wide pulse onClick=${connect} disabled=${loading}>
            ${loading ? '⏳ Connexion…' : '🔌 Se connecter en tant que host'}
          <//>
        </div>
      <//>

      <div className="mt-6 text-center">
        <p className="text-white/30 text-sm">Pas encore de session ?</p>
        <button
          onClick=${() => navigate('admin')}
          className="text-accent text-sm font-semibold hover:text-accent-dark mt-1 transition-colors"
        >
          Créer un quiz dans l'admin →
        </button>
      </div>

    </div>
  `;
}
