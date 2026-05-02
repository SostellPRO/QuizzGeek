import React from 'react';
import { createRoot } from 'react-dom/client';
import { GameProvider } from './contexts/GameContext.js';
import App from './App.js';

const root = createRoot(document.getElementById('root'));
root.render(
  React.createElement(GameProvider, null,
    React.createElement(App)
  )
);
