import { useState } from 'react';
import { html } from '../../utils.js';
import { useGame } from '../../contexts/GameContext.js';
import { Btn, Alert, Card } from '../../components/ui.js';

export default function HostConnect() {
  const { socket, hostSession, setHostSession, navigate, t } = useGame();

  const [code, setCode] = useState(hostSession?.sessionCode || localStorage.getItem('quiz_host_session_code') || '');
  const [key, setKey] = useState(hostSession?.hostKey || localStorage.getItem('quiz_host_key') || '');
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  const connect = () => {
    const sessionCode = code.trim().toUpperCase();
    const hostKey = key.trim();
    if (!sessionCode || !hostKey) {
      setAlert({ type: 'error', message: `${t('common.sessionCode')} + ${t('common.hostKey')}` });
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
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-6">
      <div className="w-full max-w-xl animate-fade-in">
        <button onClick=${() => navigate('home')} className="mb-5 inline-flex items-center rounded-lg app-chip px-3 py-2 text-sm font-bold text-white/58 transition-colors hover:text-white">
          ← ${t('common.home')}
        </button>

        <${Card} className="p-6 sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex rounded-full app-chip px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-teal-200">${t('host.badge')}</div>
              <h1 className="font-display text-4xl font-black gradient-text">${t('host.title')}</h1>
              <p className="mt-2 text-sm leading-6 text-white/52">${t('host.desc')}</p>
            </div>
            <div className="hidden h-14 w-14 items-center justify-center rounded-lg app-panel text-3xl sm:flex">🎬</div>
          </div>

          ${alert && html`<div className="mb-4"><${Alert} type=${alert.type} message=${alert.message} /></div>`}

          <div className="grid gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">${t('common.sessionCode')}</label>
              <input
                type="text"
                value=${code}
                onInput=${e => setCode(e.target.value.toUpperCase())}
                placeholder="1234"
                maxLength="6"
                className="min-h-[56px] rounded-lg border border-white/10 bg-bg-input/90 px-5 py-3 text-center font-mono text-2xl font-black tracking-[0.28em] text-white outline-none transition-colors placeholder-white/20 focus:border-sky-400/70"
                onKeyDown=${e => e.key === 'Enter' && connect()}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">${t('common.hostKey')}</label>
              <input
                type="text"
                value=${key}
                onInput=${e => setKey(e.target.value)}
                placeholder="demo-host"
                className="min-h-[50px] rounded-lg border border-white/10 bg-bg-input/90 px-4 py-3 text-base text-white outline-none transition-colors placeholder-white/30 focus:border-sky-400/70"
                onKeyDown=${e => e.key === 'Enter' && connect()}
              />
            </div>

            <${Btn} variant="primary" wide pulse onClick=${connect} disabled=${loading}>
              ${loading ? t('host.connecting') : t('host.connectHost')}
            <//>
          </div>
        <//>

        <div className="mt-5 rounded-lg app-panel p-3 text-center">
          <span className="text-sm text-white/38">${t('host.noSession')} </span>
          <button onClick=${() => navigate('admin')} className="text-sm font-extrabold text-sky-300 transition-colors hover:text-sky-100">
            ${t('host.createInStudio')}
          </button>
        </div>
      </div>
    </div>
  `;
}
