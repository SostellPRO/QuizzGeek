import React from 'react';
import { createRoot } from 'react-dom/client';
import { GameProvider } from './contexts/GameContext.js';
import App from './App.js';

let globalUiAudioCtx = null;
let lastGlobalUiSoundAt = 0;

document.addEventListener('pointerup', (event) => {
  const button = event.target?.closest?.('.ui-btn');
  if (!button || button.disabled || button.dataset.variant) return;
  try { navigator.vibrate?.(12); } catch {}
  try {
    const now = performance.now();
    if (now - lastGlobalUiSoundAt < 70) return;
    lastGlobalUiSoundAt = now;
    globalUiAudioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const ctx = globalUiAudioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(620, ctx.currentTime + 0.045);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.025, ctx.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } catch {}
}, { passive: true });

const root = createRoot(document.getElementById('root'));
root.render(
  React.createElement(GameProvider, null,
    React.createElement(App)
  )
);
