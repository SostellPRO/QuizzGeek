/* ============================================================
   Quiz Live – Application principale (vanilla JS + Socket.IO)
   ============================================================ */

'use strict';

// ── Configuration ────────────────────────────────────────────
const API = '';  // URLs relatives – le serveur sert à la fois l'API et le front

// ── État global ──────────────────────────────────────────────
const state = {
  socket: null,
  currentPage: 'home',

  // Données temps réel (mises à jour par game:state)
  gameState: null,
  players: [],
  teams: [],
  leaderboardPlayers: [],
  leaderboardTeams: [],

  // Page Player
  playerSession: null,   // { playerId, pseudo, sessionCode, reconnectToken, teamId, teamName }

  // Page Host
  host: { sessionCode: '', hostKey: '', connected: false },

  // Page Display
  display: { sessionCode: '', connected: false },

  // Admin: quiz en cours d'édition
  admin: { quizzes: [], editingQuiz: null },
};

// ── Utilitaires DOM ──────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function el(tag, cls, html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

function html(id, content) {
  const node = document.getElementById(id);
  if (node) node.innerHTML = content;
}

function show(id) { const n = document.getElementById(id); if (n) n.style.display = ''; }
function hide(id) { const n = document.getElementById(id); if (n) n.style.display = 'none'; }

function alert$(containerId, msg, type = 'info') {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = msg ? `<div class="alert alert-${type}">${msg}</div>` : '';
}

function resolveMedia(url) {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : (url.startsWith('/') ? url : '/' + url);
}

function uid(pre = 'id') { return `${pre}_${Math.random().toString(36).slice(2,9)}_${Date.now()}`; }

function randCode() { return Math.floor(1000 + Math.random() * 9000).toString(); }

function closeModal(id) { const m = document.getElementById(id); if (m) m.remove(); }

// ── Socket.IO ────────────────────────────────────────────────
function initSocket() {
  state.socket = io();

  state.socket.on('connect', () => {
    console.log('[socket] connecté', state.socket.id);
  });

  state.socket.on('disconnect', () => {
    console.log('[socket] déconnecté');
  });

  state.socket.on('game:state', (payload) => {
    state.gameState      = payload?.gameState      || null;
    state.players        = payload?.players        || [];
    state.teams          = payload?.teams          || [];
    state.leaderboardPlayers = payload?.leaderboardPlayers || [];
    state.leaderboardTeams   = payload?.leaderboardTeams   || [];

    // Mettre à jour la page courante si elle est active
    if (state.currentPage === 'player')  renderPlayerGame();
    if (state.currentPage === 'host')    renderHostGame();
    if (state.currentPage === 'display') renderDisplay();
  });
}

// ── Routeur ──────────────────────────────────────────────────
const pageInits = {};

function navigate(page) {
  $$('.page').forEach(p => p.classList.remove('active'));
  $$('nav button[data-page]').forEach(b => b.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  if (!pageEl) { navigate('home'); return; }
  pageEl.classList.add('active');

  const navBtn = $(`nav button[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');

  state.currentPage = page;
  window.location.hash = page;

  pageInits[page]?.();
}

// ── API helpers ──────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  return res.json();
}

// ── Page : HOME ──────────────────────────────────────────────
pageInits.home = function() {
  html('page-home', `
    <div class="card" style="text-align:center;padding:40px 20px;">
      <h1 style="font-size:3rem;margin-bottom:8px;">🎮 Quiz Live</h1>
      <p class="muted">Application de quiz en temps réel</p>
    </div>
    <div class="home-grid">
      <div class="home-card" onclick="navigate('player')">
        <span class="icon">📱</span>
        <h3>Jouer</h3>
        <p>Rejoindre une partie et répondre aux questions</p>
      </div>
      <div class="home-card" onclick="navigate('host')">
        <span class="icon">🎮</span>
        <h3>Maître de jeu</h3>
        <p>Contrôler le déroulement de la partie</p>
      </div>
      <div class="home-card" onclick="navigate('display')">
        <span class="icon">📺</span>
        <h3>Écran TV</h3>
        <p>Afficher la partie sur grand écran</p>
      </div>
      <div class="home-card" onclick="navigate('admin')">
        <span class="icon">⚙️</span>
        <h3>Admin</h3>
        <p>Créer et gérer les quiz</p>
      </div>
    </div>
  `);
};

// ── Page : PLAYER ────────────────────────────────────────────
pageInits.player = function() {
  // Restaurer session depuis localStorage
  if (!state.playerSession) {
    try {
      const raw = localStorage.getItem('quiz_player_session');
      if (raw) state.playerSession = JSON.parse(raw);
    } catch {}
  }

  // Lire code depuis URL ?join=CODE
  const urlCode = new URLSearchParams(window.location.search).get('join')?.toUpperCase() || '';

  if (state.playerSession) {
    // Tenter reconnexion auto
    reconnectPlayer();
  } else {
    renderPlayerJoin(urlCode);
  }
};

function renderPlayerJoin(suggestedCode = '') {
  const teamsOptions = state.teams.map(t =>
    `<option value="${t.id}">${t.name}</option>`
  ).join('');

  html('page-player', `
    <div class="card" style="text-align:center;background:linear-gradient(135deg,rgba(240,147,251,.1),rgba(245,87,108,.1));">
      <h1>📱 Quiz Live</h1>
      <p class="muted">Rejoins une partie et joue avec tes amis !</p>
    </div>
    <div id="player-alert"></div>
    <div class="card">
      <h2>Rejoindre la partie</h2>
      <div style="display:grid;gap:12px;margin-top:12px;">
        <div>
          <label>Code de session</label>
          <input id="in-session-code" placeholder="ex: 1234" value="${suggestedCode}" style="font-size:1.4rem;letter-spacing:4px;text-align:center;text-transform:uppercase;">
        </div>
        <div>
          <label>Pseudo</label>
          <input id="in-pseudo" placeholder="Votre nom de joueur" maxlength="32">
        </div>
        ${teamsOptions ? `<div>
          <label>Équipe</label>
          <select id="in-team"><option value="">— choisir une équipe —</option>${teamsOptions}</select>
        </div>` : ''}
        <button class="btn-primary" onclick="submitJoinPlayer()" style="margin-top:4px;">
          🚀 Rejoindre la partie
        </button>
      </div>
    </div>
  `);

  // Charger les équipes disponibles en se connectant à la session
  const code = suggestedCode;
  if (code) {
    fetch(`${API}/api/sessions/${code}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok && state.teams.length === 0) {
          // Les équipes arrivent via game:state une fois connecté
        }
      })
      .catch(() => {});
  }
}

function submitJoinPlayer() {
  const sessionCode = ($('#in-session-code')?.value || '').trim().toUpperCase();
  const pseudo = ($('#in-pseudo')?.value || '').trim();
  const teamId = $('#in-team')?.value || null;

  if (!sessionCode) { alert$('player-alert', 'Code de session requis', 'error'); return; }
  if (!pseudo) { alert$('player-alert', 'Pseudo requis', 'error'); return; }

  state.socket.emit('join:player', { sessionCode, pseudo, teamId: teamId || null }, (res) => {
    if (!res?.ok) {
      alert$('player-alert', res?.error || 'Impossible de rejoindre', 'error');
      return;
    }
    const session = {
      playerId: res.player.id,
      pseudo: res.player.pseudo,
      sessionCode,
      reconnectToken: res.player.reconnectToken,
      teamId: res.player.teamId || null,
      teamName: res.player.teamName || null,
    };
    state.playerSession = session;
    localStorage.setItem('quiz_player_session', JSON.stringify(session));
    renderPlayerGame();
  });
}

function reconnectPlayer() {
  const s = state.playerSession;
  if (!s?.sessionCode || !s?.reconnectToken) { renderPlayerJoin(); return; }

  state.socket.emit('player:reconnect', { sessionCode: s.sessionCode, reconnectToken: s.reconnectToken }, (res) => {
    if (!res?.ok) {
      state.playerSession = null;
      localStorage.removeItem('quiz_player_session');
      renderPlayerJoin();
      return;
    }
    const updated = {
      ...s,
      playerId: res.player.id,
      pseudo: res.player.pseudo,
      reconnectToken: res.player.reconnectToken,
      teamId: res.player.teamId || null,
      teamName: res.player.teamName || null,
    };
    state.playerSession = updated;
    localStorage.setItem('quiz_player_session', JSON.stringify(updated));
    renderPlayerGame();
  });
}

function renderPlayerGame() {
  const gs = state.gameState;
  const s  = state.playerSession;
  if (!s) { renderPlayerJoin(); return; }

  const myPlayer = state.players.find(p => p.id === s.playerId || p.playerId === s.playerId);
  const phase = gs?.status || 'lobby';

  let content = `
    <div class="session-banner">
      <span>Session : <strong class="session-code">${s.sessionCode}</strong></span>
      <span>👤 <strong>${s.pseudo}</strong>${s.teamName ? ` · ${s.teamName}` : ''}</span>
      <span style="margin-left:auto;color:#38ef7d;font-weight:700;">Score : ${myPlayer?.scoreTotal ?? 0}</span>
    </div>
    <div style="padding:16px;">
    <div id="player-alert"></div>
  `;

  // Contenu selon la phase
  if (phase === 'lobby') {
    content += `
      <div class="card" style="text-align:center;padding:40px;">
        <div style="font-size:3rem;">⏳</div>
        <h2>Salle d'attente</h2>
        <p class="muted">En attente du maître de jeu…</p>
        <p class="muted" style="margin-top:10px;">${state.players.length} joueur(s) connecté(s)</p>
      </div>`;
  } else if (phase === 'round_intro') {
    const round = gs.currentRound;
    content += `
      <div class="card" style="text-align:center;padding:40px;">
        <div style="font-size:3rem;">📢</div>
        <h2>${round?.title || 'Nouvelle manche'}</h2>
        <p class="muted">${round?.shortRules || 'Préparez-vous !'}</p>
      </div>`;
  } else if (phase === 'question' || phase === 'waiting') {
    content += renderPlayerQuestionContent(gs, s.playerId, gs.phaseMeta?.playerScreenLocked);
  } else if (phase === 'answer_reveal') {
    content += renderPlayerRevealContent(gs, s.playerId);
  } else if (phase === 'manual_scoring') {
    content += `
      <div class="card" style="text-align:center;padding:40px;">
        <div style="font-size:3rem;">⚖️</div>
        <h2>Notation en cours…</h2>
        <p class="muted">Le maître de jeu évalue les réponses</p>
      </div>`;
  } else if (phase === 'results') {
    content += renderScoreboard(state.leaderboardPlayers, '📊 Classement');
  } else if (phase === 'end') {
    content += renderFinalCeremony(gs, state.leaderboardPlayers);
  } else {
    content += `<div class="card" style="text-align:center;padding:40px;"><div style="font-size:3rem;">🎯</div><h2>Phase : ${phase}</h2></div>`;
  }

  content += `
    <div style="text-align:center;margin-top:20px;">
      <button class="btn-secondary" onclick="logoutPlayer()">Quitter la partie</button>
    </div>
    </div>`;

  html('page-player', content);
}

function renderPlayerQuestionContent(gs, playerId, locked) {
  const q = gs?.currentQuestion;
  const pm = gs?.phaseMeta || {};
  const answerMode = pm.answerMode || 'none';
  const answered = !!(gs?.answers?.[q?.id]?.[playerId]);

  if (!q) return `<div class="card" style="text-align:center;padding:30px;"><p class="muted">En attente de la question…</p></div>`;

  let media = '';
  if (q.mediaUrl) {
    const url = resolveMedia(q.mediaUrl);
    if (/\.(mp3|wav|ogg)$/i.test(url)) media = `<div class="media-block"><audio controls autoplay src="${url}"></audio></div>`;
    else if (/\.(mp4|webm|mov)$/i.test(url)) media = `<div class="media-block"><video controls autoplay src="${url}" style="max-height:45vh;"></video></div>`;
    else media = `<div class="media-block"><img src="${url}" alt="media"></div>`;
  }

  // Timer
  let timer = '';
  if (pm.timer?.remainingSec != null) {
    const pct = pm.timer.totalSec > 0 ? Math.max(0, (pm.timer.remainingSec / pm.timer.totalSec) * 100) : 0;
    timer = `
      <div class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:8px;">
          <span>⏱️ Temps restant</span>
          <strong style="color:#ff9a56;font-size:1.3rem;">${pm.timer.remainingSec}s</strong>
        </div>
        <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
      </div>`;
  }

  if (locked || answered) {
    return `
      ${timer}
      <div class="card" style="text-align:center;padding:30px;">
        <div style="font-size:2.5rem;">${answered ? '✅' : '🔒'}</div>
        <p style="margin-top:12px;font-size:1.1rem;">${answered ? 'Réponse enregistrée !' : 'Écran verrouillé'}</p>
        ${q.content ? `<p class="muted" style="margin-top:8px;">${q.content}</p>` : ''}
      </div>`;
  }

  let answerUI = '';
  if (answerMode === 'buzzer') {
    answerUI = `
      <div style="text-align:center;">
        <button class="buzzer-btn" id="buzzer-btn" onclick="sendBuzzer('${gs.sessionCode || ''}')">
          🔔<br>BUZZER
        </button>
      </div>`;
  } else if (answerMode === 'true_false') {
    answerUI = `
      <div class="answer-grid" style="grid-template-columns:1fr 1fr;">
        <button class="answer-btn" style="background:rgba(0,200,81,.15);border-color:#38ef7d;text-align:center;font-size:1.3rem;" onclick="sendAnswer('${gs.sessionCode || ''}','${playerId}','vrai')">✅ VRAI</button>
        <button class="answer-btn" style="background:rgba(235,51,73,.15);border-color:#eb3349;text-align:center;font-size:1.3rem;" onclick="sendAnswer('${gs.sessionCode || ''}','${playerId}','faux')">❌ FAUX</button>
      </div>`;
  } else if (answerMode === 'mcq' && Array.isArray(q.options) && q.options.length) {
    const opts = q.options.map(opt =>
      `<button class="answer-btn" onclick="sendAnswer('${gs.sessionCode || ''}','${playerId}',${JSON.stringify(opt)})">${opt}</button>`
    ).join('');
    answerUI = `<div class="answer-grid">${opts}</div>`;
  } else {
    answerUI = `
      <div class="card">
        <label>Votre réponse</label>
        <div class="row" style="margin-top:6px;">
          <input id="text-answer" placeholder="Tapez votre réponse…" style="flex:1;" onkeydown="if(event.key==='Enter')sendTextAnswer('${gs.sessionCode || ''}','${playerId}')">
          <button class="btn-primary" onclick="sendTextAnswer('${gs.sessionCode || ''}','${playerId}')">Envoyer</button>
        </div>
      </div>`;
  }

  return `
    ${media}
    ${timer}
    <div class="card">
      <p style="font-size:1.1rem;font-weight:600;">${q.content || ''}</p>
    </div>
    ${answerUI}`;
}

function renderPlayerRevealContent(gs, playerId) {
  const revealed = gs?.revealedAnswer;
  const correct  = revealed?.correctAnswer ?? '—';
  const myAnswer = revealed?.answers?.find(a => a.playerId === playerId);

  return `
    <div class="card" style="text-align:center;padding:30px;">
      <h2>📋 Révélation</h2>
      <p class="muted">Bonne réponse :</p>
      <div style="font-size:1.8rem;font-weight:700;color:#38ef7d;margin:12px 0;">${correct}</div>
      ${myAnswer ? `<p class="muted">Votre réponse : <strong style="color:#fff;">${myAnswer.answer}</strong></p>` : ''}
    </div>
    ${renderScoreboard(state.leaderboardPlayers, 'Classement')}`;
}

function sendAnswer(sessionCode, playerId, answer) {
  const s = state.playerSession;
  state.socket.emit('player:answer', { sessionCode: s?.sessionCode || sessionCode, playerId, answer }, (res) => {
    if (!res?.ok) alert$('player-alert', res?.error || 'Erreur', 'error');
  });
}

function sendTextAnswer(sessionCode, playerId) {
  const val = ($('#text-answer')?.value || '').trim();
  if (!val) { alert$('player-alert', 'Réponse vide', 'error'); return; }
  sendAnswer(sessionCode, playerId, val);
}

function sendBuzzer(sessionCode) {
  const s = state.playerSession;
  state.socket.emit('player:buzzer', { sessionCode: s?.sessionCode || sessionCode, playerId: s?.playerId }, (res) => {
    if (!res?.ok) alert$('player-alert', res?.error || 'Buzzer non disponible', 'error');
    const btn = $('#buzzer-btn');
    if (btn) btn.disabled = true;
  });
}

function logoutPlayer() {
  state.playerSession = null;
  localStorage.removeItem('quiz_player_session');
  navigate('home');
}

// ── Page : HOST ──────────────────────────────────────────────
pageInits.host = function() {
  const savedCode = localStorage.getItem('quiz_host_session_code') || '';
  const savedKey  = localStorage.getItem('quiz_host_key') || 'demo-host';
  state.host.sessionCode = savedCode;
  state.host.hostKey     = savedKey;
  state.host.connected   = false;
  renderHostConnect();
};

function renderHostConnect() {
  html('page-host', `
    <div class="row" style="justify-content:space-between;margin-bottom:20px;">
      <h1>🎮 Maître de jeu</h1>
      <button class="btn-secondary" onclick="navigate('home')">Accueil</button>
    </div>
    <div id="host-alert"></div>
    <div class="card">
      <h2>Connexion</h2>
      <div class="grid2" style="margin-top:12px;">
        <div>
          <label>Code de session</label>
          <input id="host-code" value="${state.host.sessionCode}" placeholder="ex: 1234" style="text-transform:uppercase;letter-spacing:3px;">
        </div>
        <div>
          <label>Clé host</label>
          <input id="host-key" value="${state.host.hostKey}" placeholder="ex: demo-host">
        </div>
      </div>
      <button class="btn-success" style="width:100%;margin-top:16px;" onclick="connectHost()">
        🎮 Se connecter en tant que Maître de jeu
      </button>
    </div>
  `);
}

function connectHost() {
  const code = ($('#host-code')?.value || '').trim().toUpperCase();
  const key  = ($('#host-key')?.value  || '').trim();
  if (!code) { alert$('host-alert', 'Code requis', 'error'); return; }

  state.host.sessionCode = code;
  state.host.hostKey     = key;

  state.socket.emit('join:host', { sessionCode: code, hostKey: key }, (res) => {
    if (!res?.ok) { alert$('host-alert', res?.error || 'Connexion impossible', 'error'); return; }
    state.host.connected = true;
    localStorage.setItem('quiz_host_session_code', code);
    localStorage.setItem('quiz_host_key', key);
    renderHostGame();
  });
}

let hostActiveTab = 'controle';

function renderHostGame() {
  if (!state.host.connected) return;
  const gs   = state.gameState;
  const phase = gs?.status || 'lobby';
  const sc    = state.host.sessionCode;

  const phaseBadge = {
    lobby:          '<span class="badge blue">🎪 Salle d\'attente</span>',
    round_intro:    '<span class="badge orange">📢 Présentation manche</span>',
    question:       '<span class="badge orange">❓ Question</span>',
    waiting:        '<span class="badge orange">⏳ Traitement</span>',
    answer_reveal:  '<span class="badge green">📋 Révélation</span>',
    manual_scoring: '<span class="badge orange">⚖️ Notation manuelle</span>',
    results:        '<span class="badge blue">📊 Résultats</span>',
    end:            '<span class="badge green">🎉 Fin</span>',
  }[phase] || `<span class="badge">${phase}</span>`;

  const actionBtns = buildHostActionButtons(phase);

  const joinLink = `${window.location.origin}/?join=${sc}`;

  let html_ = `
    <div class="session-banner">
      <span>Session : <strong class="session-code">${sc}</strong></span>
      <span>👥 ${state.players.length} joueur(s)</span>
      <button class="btn-secondary" style="padding:4px 10px;font-size:0.8rem;margin-left:auto;" onclick="copyToClipboard('${joinLink}','host-alert')">📋 Lien joueur</button>
    </div>
    <div style="padding:16px;">
    <div class="row" style="justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <h1 style="margin:0;">🎮 Maître de jeu</h1>
      <div class="row">
        <button class="btn-secondary" onclick="navigate('display')">📺 Écran</button>
        <button class="btn-secondary" onclick="navigate('home')">Accueil</button>
      </div>
    </div>
    <div id="host-alert"></div>
    <div class="grid2" style="margin-bottom:16px;">
      <div class="card" style="margin:0;">
        <div class="muted" style="font-size:.75rem;margin-bottom:6px;">PHASE</div>
        ${phaseBadge}
      </div>
      <div class="card" style="margin:0;">
        <div class="muted" style="font-size:.75rem;margin-bottom:6px;">QUIZ</div>
        <span style="font-size:.9rem;">${gs?.quizTitle || '—'} · ${gs?.currentRound?.title || '—'}</span>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn ${hostActiveTab==='controle'?'active':''}" onclick="switchHostTab('controle')">🎮 Contrôle</button>
      <button class="tab-btn ${hostActiveTab==='joueurs'?'active':''}" onclick="switchHostTab('joueurs')">👥 Joueurs</button>
      <button class="tab-btn ${hostActiveTab==='equipes'?'active':''}" onclick="switchHostTab('equipes')">⚽ Équipes</button>
      <button class="tab-btn ${hostActiveTab==='scores'?'active':''}" onclick="switchHostTab('scores')">📊 Scores</button>
    </div>
  `;

  // ONGLET CONTRÔLE
  if (hostActiveTab === 'controle') {
    html_ += `<div id="host-tab-content">`;

    // Infos question
    const cq = gs?.currentQuestion;
    if (cq) {
      html_ += `
        <div class="card">
          <div class="muted" style="font-size:.75rem;">QUESTION ACTIVE</div>
          <p style="margin-top:6px;">${cq.content || '—'}</p>
          ${gs.phaseMeta?.timer ? `
            <div style="margin-top:10px;">
              <div class="row" style="justify-content:space-between;margin-bottom:6px;">
                <span class="muted">Temps restant</span>
                <strong style="color:#ff9a56;">${gs.phaseMeta.timer.remainingSec}s</strong>
              </div>
              <div class="progress-bar"><div class="fill" style="width:${gs.phaseMeta.timer.totalSec>0?Math.round(gs.phaseMeta.timer.remainingSec/gs.phaseMeta.timer.totalSec*100):0}%"></div></div>
            </div>` : ''}
          ${gs.buzzerState?.firstPseudo ? `<p style="margin-top:10px;">🔔 Premier : <strong>${gs.buzzerState.firstPseudo}</strong></p>` : ''}
          <p style="margin-top:8px;font-size:.85rem;">Écrans : ${gs.phaseMeta?.playerScreenLocked ? '<span class="badge red">🔒 Verrouillés</span>' : '<span class="badge green">🔓 Ouverts</span>'}</p>
        </div>`;
    }

    // Boutons d'action
    if (actionBtns.length) {
      html_ += `
        <div class="card">
          <h3>Actions disponibles</h3>
          <div class="grid2" style="margin-top:12px;">${actionBtns.map(b =>
            `<button class="btn-${b.style}" onclick="hostAction('${b.action}')">${b.label}</button>`
          ).join('')}</div>
        </div>`;
    }

    // Timer
    if (phase === 'question' || phase === 'waiting') {
      html_ += `
        <div class="card">
          <h3>⏱️ Chronomètre</h3>
          <div class="row" style="margin-top:10px;">
            <input type="number" id="timer-sec" value="30" min="1" max="300" style="width:100px;">
            <button class="btn-success" onclick="startTimer()">Démarrer</button>
          </div>
        </div>`;
    }

    // Attribution manuelle de points
    if (['manual_scoring','answer_reveal','waiting','question'].includes(phase) && state.leaderboardPlayers.length) {
      html_ += `
        <div class="card">
          <h3>➕ Points manuels</h3>
          <div class="grid3" style="margin-top:12px;">
            ${state.leaderboardPlayers.slice(0, 12).map(p => `
              <div style="background:rgba(255,255,255,.05);border-radius:10px;padding:10px;text-align:center;">
                <p style="font-weight:600;margin-bottom:4px;">${p.pseudo}</p>
                <p class="muted" style="margin-bottom:8px;">${p.scoreTotal ?? 0} pts</p>
                <button class="btn-success" style="width:100%;padding:6px;" onclick="awardPoints('${p.playerId}',1)">+1</button>
              </div>`).join('')}
          </div>
        </div>`;
    }

    html_ += `</div>`; // fin tab-content
  }

  // ONGLET JOUEURS
  else if (hostActiveTab === 'joueurs') {
    const rows = state.players.map(p => `
      <tr>
        <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.connected?'#38ef7d':'#555'};"></span></td>
        <td><strong>${p.pseudo}</strong></td>
        <td class="muted">${p.teamName || '—'}</td>
        <td>${p.scoreTotal ?? 0}</td>
        <td><button class="btn-danger" style="padding:4px 8px;font-size:.8rem;" onclick="hostAction('remove_player',{playerId:'${p.id||p.playerId}'})">✕</button></td>
      </tr>`).join('') || `<tr><td colspan="5" class="muted">Aucun joueur</td></tr>`;

    html_ += `
      <div class="card">
        <h3>👥 Joueurs (${state.players.length})</h3>
        <table style="margin-top:12px;"><thead><tr><th></th><th>Pseudo</th><th>Équipe</th><th>Score</th><th></th></tr></thead><tbody>${rows}</tbody></table>
        <div class="row" style="margin-top:16px;flex-wrap:wrap;gap:8px;">
          <button class="btn-secondary" onclick="hostAction('reset_scores')" style="font-size:.85rem;">🔄 Reset scores</button>
          <button class="btn-secondary" onclick="hostAction('reset_game')"   style="font-size:.85rem;">🔁 Reset partie</button>
          <button class="btn-danger"    onclick="clearPlayers()"             style="font-size:.85rem;">🗑️ Vider joueurs</button>
        </div>
      </div>
      <div class="card">
        <h3>🤖 Ajouter un bot</h3>
        <div class="row" style="margin-top:10px;flex-wrap:wrap;gap:10px;">
          <input id="bot-name" placeholder="Nom du bot" style="flex:1;min-width:120px;">
          <select id="bot-team" style="width:130px;">${Array.from({length:20},(_,i)=>`<option value="team_${i+1}">Équipe ${i+1}</option>`).join('')}</select>
          <button class="btn-success" style="white-space:nowrap;" onclick="addBot()">Ajouter</button>
        </div>
      </div>`;
  }

  // ONGLET ÉQUIPES
  else if (hostActiveTab === 'equipes') {
    const teamsHtml = state.teams.map(t => `
      <div class="row" style="gap:8px;">
        <input id="rename-${t.id}" value="${t.name}" style="flex:1;">
        <button class="btn-secondary" style="white-space:nowrap;padding:8px 12px;" onclick="renameTeam('${t.id}')">✅</button>
      </div>`).join('') || '<p class="muted">Aucune équipe</p>';

    html_ += `
      <div class="card">
        <h3>✏️ Renommer les équipes</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:14px;">
          ${teamsHtml}
        </div>
      </div>`;
  }

  // ONGLET SCORES
  else if (hostActiveTab === 'scores') {
    html_ += renderScoreboard(state.leaderboardPlayers, '📈 Classement joueurs');
    if (state.leaderboardTeams.length) {
      html_ += `
        <div class="card">
          <h2>👥 Classement équipes</h2>
          <table><thead><tr><th>Rang</th><th>Équipe</th><th>Score</th></tr></thead>
          <tbody>${state.leaderboardTeams.map((t,i) => `<tr class="rank-${i+1}"><td>${t.rank??i+1}</td><td>${t.name}</td><td><strong>${t.scoreTotal??0}</strong></td></tr>`).join('')}</tbody></table>
        </div>`;
    }
  }

  html_ += `</div>`; // fin padding
  html('page-host', html_);
}

function buildHostActionButtons(phase) {
  const btns = [];
  if (phase === 'lobby')          btns.push({ label: '▶️ Démarrer le quiz', action: 'start_quiz', style: 'success' });
  if (phase === 'round_intro')    btns.push({ label: '▶️ Démarrer la manche', action: 'start_round', style: 'success' });
  if (phase === 'question' || phase === 'waiting') {
    btns.push({ label: '📋 Révéler la réponse', action: 'reveal_answer', style: 'secondary' });
    btns.push({ label: '⏭️ Question suivante', action: 'next_question', style: 'secondary' });
    btns.push({ label: '🔒 Verrouiller', action: 'lock_players', style: 'secondary' });
    btns.push({ label: '🔓 Déverrouiller', action: 'unlock_players', style: 'secondary' });
  }
  if (phase === 'answer_reveal')  btns.push({ label: '📊 Afficher résultats', action: 'show_results', style: 'secondary' });
  if (phase === 'results') {
    btns.push({ label: '⏭️ Manche suivante', action: 'next_round', style: 'secondary' });
    btns.push({ label: '⏭️ Question suivante', action: 'next_question', style: 'secondary' });
    btns.push({ label: '🏁 Terminer le quiz', action: 'finish_quiz', style: 'danger' });
  }
  if (phase === 'manual_scoring') btns.push({ label: '📊 Afficher résultats', action: 'show_results', style: 'secondary' });
  if (phase === 'end') {
    btns.push({ label: '🎊 Cérémonie', action: 'final_ceremony_init', style: 'success' });
    btns.push({ label: '🔁 Nouvelle partie', action: 'reset_game', style: 'secondary' });
  }
  return btns;
}

function switchHostTab(tab) {
  hostActiveTab = tab;
  renderHostGame();
}

function hostAction(action, extra = {}) {
  state.socket.emit('host:action', { sessionCode: state.host.sessionCode, hostKey: state.host.hostKey, action, ...extra }, (res) => {
    if (!res?.ok) alert$('host-alert', res?.error || 'Action impossible', 'error');
    else alert$('host-alert', `✅ ${action}`, 'success');
  });
}

function startTimer() {
  const sec = parseInt($('#timer-sec')?.value) || 30;
  hostAction('start_timer', { seconds: sec });
}

function awardPoints(playerId, points) {
  hostAction('award_manual_points', { playerId, points });
}

function addBot() {
  const name = ($('#bot-name')?.value || '').trim();
  const teamId = $('#bot-team')?.value || null;
  if (!name) { alert$('host-alert', 'Nom du bot requis', 'error'); return; }
  hostAction('add_bot', { pseudo: name, teamId });
  if ($('#bot-name')) $('#bot-name').value = '';
}

function renameTeam(teamId) {
  const newName = ($(`#rename-${teamId}`)?.value || '').trim();
  if (!newName) return;
  hostAction('rename_team', { teamId, newName });
}

function clearPlayers() {
  if (!confirm('Supprimer tous les joueurs ?')) return;
  hostAction('clear_players');
}

// ── Page : DISPLAY ───────────────────────────────────────────
pageInits.display = function() {
  const savedCode = localStorage.getItem('quiz_display_code') || state.host.sessionCode || '';
  state.display.connected = false;
  html('page-display', `
    <div class="row" style="justify-content:space-between;margin-bottom:20px;">
      <h1>📺 Écran TV</h1>
      <button class="btn-secondary" onclick="navigate('home')">Accueil</button>
    </div>
    <div id="display-alert"></div>
    <div class="card" id="display-connect-card">
      <h2>Se connecter à une session</h2>
      <div class="row" style="margin-top:12px;gap:12px;">
        <input id="display-code" placeholder="Code de session" value="${savedCode}" style="flex:1;font-size:1.2rem;letter-spacing:4px;text-transform:uppercase;">
        <button class="btn-primary" onclick="connectDisplay()">📺 Afficher</button>
      </div>
    </div>
    <div id="display-content"></div>
  `);
};

function connectDisplay() {
  const code = ($('#display-code')?.value || '').trim().toUpperCase();
  if (!code) { alert$('display-alert', 'Code requis', 'error'); return; }

  state.socket.emit('join:display', { sessionCode: code }, (res) => {
    if (!res?.ok) { alert$('display-alert', res?.error || 'Session introuvable', 'error'); return; }
    state.display.sessionCode = code;
    state.display.connected   = true;
    localStorage.setItem('quiz_display_code', code);
    hide('display-connect-card');
    renderDisplay();
  });
}

function renderDisplay() {
  if (!state.display.connected) return;
  const gs   = state.gameState;
  const phase = gs?.status || 'lobby';
  const sc    = state.display.sessionCode;

  let content = `
    <div class="session-banner">
      <span>Session : <strong class="session-code">${sc}</strong></span>
      <span>${state.players.length} joueur(s)</span>
    </div>
    <div style="padding:16px;">`;

  if (phase === 'lobby') {
    content += `
      <div class="card" style="text-align:center;padding:60px 20px;">
        <div style="font-size:4rem;margin-bottom:16px;">🎮</div>
        <h1>${gs?.quizTitle || 'Quiz Live'}</h1>
        <p class="muted" style="font-size:1.2rem;margin-top:12px;">Code : <strong class="session-code">${sc}</strong></p>
        <p class="muted" style="margin-top:10px;">${state.players.length} joueur(s) connecté(s)</p>
      </div>`;
  } else if (phase === 'round_intro') {
    const round = gs?.currentRound;
    content += `
      <div class="card" style="text-align:center;padding:60px 20px;">
        <div style="font-size:3rem;margin-bottom:16px;">📢</div>
        <h1>${round?.title || 'Nouvelle manche'}</h1>
        ${round?.shortRules ? `<p class="muted" style="font-size:1.1rem;margin-top:12px;">${round.shortRules}</p>` : ''}
      </div>`;
  } else if (phase === 'question' || phase === 'waiting') {
    content += renderDisplayQuestion(gs);
  } else if (phase === 'answer_reveal') {
    const revealed = gs?.revealedAnswer;
    content += `
      <div class="card" style="text-align:center;padding:40px;">
        <h2>📋 Bonne réponse</h2>
        <div style="font-size:2.5rem;font-weight:700;color:#38ef7d;margin:20px 0;">${revealed?.correctAnswer ?? '—'}</div>
      </div>
      ${renderAnswerList(revealed?.answers || [])}
      ${renderScoreboard(state.leaderboardPlayers, 'Classement')}`;
  } else if (phase === 'results' || phase === 'end') {
    content += renderFinalCeremony(gs, state.leaderboardPlayers);
  } else if (phase === 'manual_scoring') {
    content += `
      <div class="card" style="text-align:center;padding:40px;">
        <div style="font-size:3rem;">⚖️</div>
        <h2>Notation en cours…</h2>
        ${gs?.buzzerState?.firstPseudo ? `<p style="margin-top:16px;font-size:1.5rem;">🔔 <strong>${gs.buzzerState.firstPseudo}</strong> a buzzé en premier</p>` : ''}
      </div>`;
  }

  content += '</div>';
  html('display-content', content);
}

function renderDisplayQuestion(gs) {
  const q  = gs?.currentQuestion;
  const pm = gs?.phaseMeta || {};

  if (!q) return `<div class="card" style="text-align:center;padding:40px;"><p class="muted">En attente…</p></div>`;

  let media = '';
  if (q.mediaUrl) {
    const url = resolveMedia(q.mediaUrl);
    if (/\.(mp3|wav|ogg)$/i.test(url)) media = `<div class="media-block"><audio controls autoplay src="${url}"></audio></div>`;
    else if (/\.(mp4|webm|mov)$/i.test(url)) media = `<div class="media-block"><video controls autoplay src="${url}" style="max-height:50vh;"></video></div>`;
    else media = `<div class="media-block"><img src="${url}" alt="media"></div>`;
  }

  let timerHtml = '';
  if (pm.timer?.remainingSec != null) {
    const pct = pm.timer.totalSec > 0 ? Math.max(0, pm.timer.remainingSec/pm.timer.totalSec*100) : 0;
    timerHtml = `
      <div class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:8px;">
          <strong>⏱️ Temps</strong>
          <strong style="font-size:1.8rem;color:#ff9a56;">${pm.timer.remainingSec}s</strong>
        </div>
        <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
      </div>`;
  }

  // Votes vrai/faux
  let votes = '';
  if (pm.answerMode === 'true_false') {
    const yes  = pm.trueFalseVotes?.yes?.length ?? gs.trueFalseVotes?.yes?.length ?? 0;
    const no   = pm.trueFalseVotes?.no?.length  ?? gs.trueFalseVotes?.no?.length  ?? 0;
    const tot  = yes + no;
    votes = `
      <div class="card">
        <div class="grid2" style="text-align:center;">
          <div>
            <div style="font-size:2rem;color:#38ef7d;">✅ VRAI</div>
            <div style="font-size:3rem;font-weight:700;">${yes}</div>
            <div class="progress-bar" style="margin-top:8px;"><div class="fill" style="background:linear-gradient(90deg,#00c851,#38ef7d);width:${tot>0?Math.round(yes/tot*100):0}%"></div></div>
          </div>
          <div>
            <div style="font-size:2rem;color:#eb3349;">❌ FAUX</div>
            <div style="font-size:3rem;font-weight:700;">${no}</div>
            <div class="progress-bar" style="margin-top:8px;"><div class="fill" style="background:linear-gradient(90deg,#eb3349,#ff6b7a);width:${tot>0?Math.round(no/tot*100):0}%"></div></div>
          </div>
        </div>
      </div>`;
  }

  // Options QCM
  let opts = '';
  if (pm.answerMode === 'mcq' && Array.isArray(q.options) && q.options.length) {
    opts = `<div class="answer-grid">${q.options.map(o => `<div class="answer-btn">${o}</div>`).join('')}</div>`;
  }

  // Compteur de réponses
  const answered = gs.answers?.[q.id] ? Object.keys(gs.answers[q.id]).length : 0;
  const connected = state.players.filter(p => p.connected).length;

  return `
    ${media}
    ${timerHtml}
    <div class="card">
      <p style="font-size:1.4rem;font-weight:600;">${q.content || ''}</p>
      <p class="muted" style="margin-top:8px;">${answered}/${connected} réponse(s)</p>
    </div>
    ${opts}
    ${votes}`;
}

function renderAnswerList(answers) {
  if (!answers.length) return '';
  const rows = answers.map(a => `
    <tr><td><strong>${a.pseudo}</strong></td><td>${a.answer}</td></tr>`).join('');
  return `
    <div class="card">
      <h3>Réponses des joueurs</h3>
      <table style="margin-top:10px;"><thead><tr><th>Joueur</th><th>Réponse</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>`;
}

// ── Page : ADMIN ─────────────────────────────────────────────
pageInits.admin = function() {
  loadQuizList();
};

async function loadQuizList() {
  html('page-admin', `
    <div class="row" style="justify-content:space-between;margin-bottom:20px;">
      <h1>⚙️ Admin Quiz</h1>
      <div class="row">
        <button class="btn-primary" onclick="startNewQuiz()">+ Nouveau quiz</button>
        <button class="btn-secondary" onclick="navigate('home')">Accueil</button>
      </div>
    </div>
    <div id="admin-alert"></div>
    <div class="card" id="quiz-list-card">
      <p class="muted">Chargement…</p>
    </div>
  `);

  try {
    const d = await apiFetch('/api/quizzes');
    state.admin.quizzes = d.quizzes || [];
    renderQuizList();
  } catch (e) {
    alert$('admin-alert', 'Impossible de charger les quiz', 'error');
  }
}

function renderQuizList() {
  const qs = state.admin.quizzes;
  if (!qs.length) {
    html('quiz-list-card', '<p class="muted" style="text-align:center;padding:20px;">Aucun quiz. Créez-en un !</p>');
    return;
  }
  html('quiz-list-card', `
    <h2>Mes quiz (${qs.length})</h2>
    <div style="margin-top:14px;display:grid;gap:10px;">
      ${qs.map(q => `
        <div class="row" style="background:rgba(255,255,255,.04);padding:12px 16px;border-radius:10px;gap:12px;">
          <div style="flex:1;">
            <strong>${q.title}</strong>
            <span class="muted" style="margin-left:8px;font-size:.85rem;">${q.rounds?.length||0} manche(s)</span>
          </div>
          <button class="btn-secondary" style="font-size:.85rem;" onclick="editQuiz('${q.id}')">✏️ Éditer</button>
          <button class="btn-success"   style="font-size:.85rem;" onclick="launchQuiz('${q.id}')">▶️ Lancer</button>
          <button class="btn-danger"    style="font-size:.85rem;" onclick="deleteQuiz('${q.id}')">🗑️</button>
        </div>`).join('')}
    </div>`);
}

function startNewQuiz() {
  state.admin.editingQuiz = emptyQuiz();
  renderQuizEditor();
}

async function editQuiz(id) {
  try {
    const d = await apiFetch(`/api/quizzes/${id}`);
    state.admin.editingQuiz = d.quiz;
    renderQuizEditor();
  } catch { alert$('admin-alert', 'Impossible de charger le quiz', 'error'); }
}

async function deleteQuiz(id) {
  if (!confirm('Supprimer ce quiz ?')) return;
  try {
    await apiFetch(`/api/quizzes/${id}`, { method: 'DELETE' });
    await loadQuizList();
  } catch { alert$('admin-alert', 'Erreur suppression', 'error'); }
}

async function launchQuiz(quizId) {
  const quiz = state.admin.quizzes.find(q => q.id === quizId);
  const code = randCode();

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'launch-modal';
  modal.innerHTML = `
    <div class="modal">
      <h2>▶️ Lancer le quiz</h2>
      <p class="muted" style="margin-bottom:16px;">📚 <strong>${quiz?.title || 'Quiz'}</strong></p>
      <div style="display:grid;gap:14px;">
        <div class="grid2">
          <div>
            <label>Code de session</label>
            <input id="launch-code" value="${code}" placeholder="ex: 1234"
              style="text-transform:uppercase;letter-spacing:4px;text-align:center;"
              oninput="this.value=this.value.toUpperCase()">
          </div>
          <div>
            <label>Clé host</label>
            <input id="launch-hostkey" value="demo-host" placeholder="demo-host">
          </div>
        </div>
      </div>
      <div id="launch-alert" style="margin-top:12px;"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px;">
        <div style="background:rgba(56,239,125,.06);border:1px solid rgba(56,239,125,.25);border-radius:16px;padding:16px;text-align:center;">
          <div style="font-size:2rem;margin-bottom:8px;">🎮</div>
          <h3 style="font-size:1rem;margin-bottom:6px;">Partie réelle</h3>
          <p class="muted" style="font-size:.8rem;margin-bottom:12px;">Les joueurs rejoignent avec le code</p>
          <button class="btn-success" style="width:100%;" onclick="doLaunchGame('${quizId}',false)">▶️ Lancer la partie</button>
        </div>
        <div style="background:rgba(245,87,108,.06);border:1px solid rgba(245,87,108,.25);border-radius:16px;padding:16px;text-align:center;">
          <div style="font-size:2rem;margin-bottom:8px;">🧪</div>
          <h3 style="font-size:1rem;margin-bottom:6px;">Mode test</h3>
          <p class="muted" style="font-size:.8rem;margin-bottom:12px;">Simulez avec des bots</p>
          <div style="margin-bottom:8px;">
            <label style="font-size:.78rem;color:rgba(255,255,255,.5);">Bots :</label>
            <input type="number" id="launch-bots" value="3" min="0" max="20" style="width:60px;margin-left:6px;">
          </div>
          <button class="btn-warning" style="width:100%;" onclick="doLaunchGame('${quizId}',true)">🧪 Tester</button>
        </div>
      </div>
      <div style="text-align:right;margin-top:16px;">
        <button class="btn-secondary" onclick="closeModal('launch-modal')">Annuler</button>
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) closeModal('launch-modal'); });
  document.body.appendChild(modal);
}

async function doLaunchGame(quizId, isTestMode) {
  const code     = ($('#launch-code')?.value    || '').trim().toUpperCase() || randCode();
  const hostKey  = ($('#launch-hostkey')?.value || '').trim() || 'demo-host';
  const botCount = isTestMode ? (parseInt($('#launch-bots')?.value) || 3) : 0;
  if (!code) { alert$('launch-alert', 'Code requis', 'error'); return; }
  try {
    const d = await apiFetch('/api/sessions/from-quiz', {
      method: 'POST',
      body: JSON.stringify({ quizId, sessionCode: code, hostKey }),
    });
    if (!d.ok) { alert$('launch-alert', d.error || 'Erreur', 'error'); return; }
    const sessionCode = d.session.sessionCode;
    // *** FIX CRITIQUE : sauvegarder dans localStorage AVANT navigate ***
    localStorage.setItem('quiz_host_session_code', sessionCode);
    localStorage.setItem('quiz_host_key', hostKey);
    state.host.sessionCode = sessionCode;
    state.host.hostKey     = hostKey;
    closeModal('launch-modal');
    navigate('host');
    state.socket.emit('join:host', { sessionCode, hostKey }, (res) => {
      if (!res?.ok) { alert$('host-alert', res?.error || 'Connexion impossible', 'error'); return; }
      state.host.connected = true;
      updateNavSession();
      if (isTestMode && botCount > 0) {
        const botNames = ['Alice','Bob','Charlie','David','Eva','Frank','Grace','Hugo'];
        for (let i = 0; i < botCount; i++) {
          const pseudo = botNames[i % botNames.length];
          state.socket.emit('host:action', { sessionCode, hostKey, action: 'add_bot', pseudo }, () => {});
        }
      }
      renderHostGame();
    });
  } catch { alert$('launch-alert', 'Erreur réseau', 'error'); }
}

function emptyQuiz() {
  return { id: '', title: 'Nouveau quiz', rounds: [] };
}

function emptyRound(idx = 0) {
  return {
    id: uid('round'),
    title: `Manche ${idx + 1}`,
    type: 'questionnaire',
    scoringMode: 'auto',
    shortRules: '',
    questions: [],
  };
}

function emptyQuestion(type = 'questionnaire') {
  const base = { id: uid('q'), content: 'Question', mediaUrl: '', correctAnswer: '' };
  if (type === 'questionnaire' || type === 'mcq') {
    return { ...base, type: 'mcq', options: ['Réponse A', 'Réponse B', 'Réponse C', 'Réponse D'], correctAnswer: 'Réponse A' };
  }
  if (type === 'true_false') return { ...base, type: 'true_false', correctAnswer: 'vrai' };
  if (type === 'speed')      return { ...base, type: 'text', questionType: 'buzzer' };
  return { ...base, type: 'text' };
}

function renderQuizEditor() {
  const q = state.admin.editingQuiz;
  html('page-admin', `
    <div class="row" style="justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
      <h1>✏️ Éditeur de quiz</h1>
      <div class="row">
        <button class="btn-success"   onclick="saveQuiz()">💾 Enregistrer</button>
        <button class="btn-secondary" onclick="loadQuizList()">← Retour</button>
      </div>
    </div>
    <div id="admin-alert"></div>

    <div class="card">
      <h3>Informations générales</h3>
      <div style="display:grid;gap:12px;margin-top:12px;">
        <div>
          <label>Titre du quiz</label>
          <input id="quiz-title" value="${q.title || ''}" placeholder="Nom du quiz">
        </div>
      </div>
    </div>

    <div class="card">
      <div class="row" style="justify-content:space-between;">
        <h3>Manches (${q.rounds?.length || 0})</h3>
        <button class="btn-primary" style="font-size:.85rem;" onclick="addRound()">+ Manche</button>
      </div>
      <div id="rounds-container" style="margin-top:14px;">
        ${(q.rounds || []).map((r, ri) => renderRoundBlock(r, ri)).join('')}
      </div>
    </div>
  `);
}

function renderRoundBlock(round, ri) {
  const roundTypes = ['questionnaire','music','image','speed','true_false','riddle','karaoke'];
  return `
    <div class="round-panel" id="round-${round.id}">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
        <strong>Manche ${ri+1}</strong>
        <button class="btn-danger" style="padding:4px 10px;font-size:.8rem;" onclick="removeRound('${round.id}')">Supprimer</button>
      </div>
      <div class="grid2" style="gap:10px;margin-bottom:12px;">
        <div>
          <label>Titre</label>
          <input value="${round.title||''}" onchange="updateRound('${round.id}','title',this.value)" placeholder="Titre de la manche">
        </div>
        <div>
          <label>Type</label>
          <select onchange="updateRound('${round.id}','type',this.value)">
            ${roundTypes.map(t => `<option value="${t}" ${round.type===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Scoring</label>
          <select onchange="updateRound('${round.id}','scoringMode',this.value)">
            <option value="auto" ${round.scoringMode==='auto'?'selected':''}>Auto</option>
            <option value="arbitre" ${round.scoringMode==='arbitre'?'selected':''}>Arbitre (manuel)</option>
          </select>
        </div>
        <div>
          <label>Règles courtes</label>
          <input value="${round.shortRules||''}" onchange="updateRound('${round.id}','shortRules',this.value)" placeholder="Affiché aux joueurs">
        </div>
      </div>
      <div>
        <div class="row" style="justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:.85rem;color:rgba(255,255,255,.6);">Questions (${round.questions?.length||0})</span>
          <button class="btn-secondary" style="padding:4px 10px;font-size:.8rem;" onclick="addQuestion('${round.id}','${round.type||'questionnaire'}')">+ Question</button>
        </div>
        <div id="questions-${round.id}">
          ${(round.questions || []).map((q, qi) => renderQuestionRow(q, qi, round.id, round.type || 'questionnaire')).join('')}
        </div>
      </div>
    </div>`;
}

function renderQuestionRow(q, qi, roundId, roundType) {
  const isMcq   = q.type === 'mcq';
  const isMusic = roundType === 'music';

  const mediaHtml = q.mediaUrl
    ? `<div style="font-size:.78rem;color:rgba(255,255,255,.4);margin:4px 0 4px 28px;">
         <a href="${resolveMedia(q.mediaUrl)}" target="_blank" style="color:#79b8ff;">📎 ${q.mediaUrl}</a>
       </div>`
    : '';

  const musicTypeHtml = isMusic ? `
    <div style="display:flex;align-items:center;gap:8px;margin-top:6px;margin-left:28px;">
      <span style="font-size:.75rem;color:rgba(255,255,255,.45);">Mode réponse :</span>
      <select onchange="changeQuestionType('${roundId}','${q.id}',this.value)"
        style="font-size:.8rem;padding:3px 8px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:6px;color:#fff;">
        <option value="text" ${q.type !== 'mcq' ? 'selected' : ''}>📝 Texte libre</option>
        <option value="mcq"  ${q.type === 'mcq' ? 'selected' : ''}>🔘 Choix multiple</option>
      </select>
    </div>` : '';

  const opts = Array.isArray(q.options) && q.options.length ? q.options : ['','','',''];
  const labels = ['A','B','C','D'];
  const labelColors = ['#4ade80','#60a5fa','#f59e0b','#f87171'];

  const optionsHtml = isMcq ? `
    <div style="margin:8px 0 4px 28px;padding:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09);border-radius:10px;">
      <div style="font-size:.72rem;color:rgba(255,255,255,.4);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">Choix multiples</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
        ${opts.slice(0, 4).map((opt, i) => `
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:.78rem;font-weight:700;color:${labelColors[i]};min-width:16px;">${labels[i]}</span>
            <input value="${(opt||'').replace(/"/g,'&quot;')}" placeholder="Option ${labels[i]}"
              oninput="updateQuestionOption('${roundId}','${q.id}',${i},this.value)"
              style="flex:1;font-size:.82rem;padding:5px 8px;">
          </div>`).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:.75rem;color:rgba(255,255,255,.45);white-space:nowrap;">✅ Bonne réponse :</span>
        <select onchange="updateQuestion('${roundId}','${q.id}','correctAnswer',this.value)"
          style="flex:1;font-size:.82rem;padding:5px 8px;">
          ${opts.slice(0,4).map((opt,i) => `
            <option value="${(opt||'').replace(/"/g,'&quot;')}" ${q.correctAnswer===opt?'selected':''}>${labels[i]}: ${opt||'?'}</option>`).join('')}
        </select>
      </div>
    </div>` : '';

  return `
    <div class="question-row" id="question-${q.id}" style="flex-direction:column;align-items:stretch;gap:0;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="muted" style="min-width:26px;font-size:.85rem;">${qi+1}.</span>
        <input value="${(q.content||'').replace(/"/g,'&quot;')}" placeholder="Contenu de la question"
          onchange="updateQuestion('${roundId}','${q.id}','content',this.value)" style="flex:2;">
        ${!isMcq
          ? `<input value="${(q.correctAnswer||q.solution||'').replace(/"/g,'&quot;')}" placeholder="Bonne réponse"
               onchange="updateQuestion('${roundId}','${q.id}','correctAnswer',this.value)" style="flex:1;">`
          : ''}
        <button class="btn-secondary" style="padding:4px 10px;font-size:.8rem;white-space:nowrap;" onclick="openMediaUpload('${q.id}')">🖼️ Média</button>
        <button class="btn-danger"    style="padding:4px 8px;font-size:.8rem;" onclick="removeQuestion('${roundId}','${q.id}')">✕</button>
      </div>
      ${musicTypeHtml}
      ${optionsHtml}
      ${mediaHtml}
    </div>`;
}

function addRound() {
  const q = state.admin.editingQuiz;
  q.rounds = q.rounds || [];
  q.rounds.push(emptyRound(q.rounds.length));
  renderQuizEditor();
}

function removeRound(roundId) {
  const q = state.admin.editingQuiz;
  q.rounds = (q.rounds || []).filter(r => r.id !== roundId);
  renderQuizEditor();
}

function updateRound(roundId, field, value) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  if (round) round[field] = value;
}

function addQuestion(roundId, roundType = 'questionnaire') {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  if (!round) return;
  round.questions = round.questions || [];
  round.questions.push(emptyQuestion(roundType));
  renderQuizEditor();
}

function removeQuestion(roundId, qId) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  if (!round) return;
  round.questions = (round.questions || []).filter(q => q.id !== qId);
  renderQuizEditor();
}

function updateQuestion(roundId, qId, field, value) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  const q = round?.questions?.find(q => q.id === qId);
  if (q) q[field] = value;
}

function updateQuestionOption(roundId, qId, optIndex, value) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  const q     = round?.questions?.find(q => q.id === qId);
  if (!q) return;
  if (!Array.isArray(q.options)) q.options = ['', '', '', ''];
  q.options[optIndex] = value;
  const labels = ['A','B','C','D'];
  const selects = document.querySelectorAll(`#question-${qId} select`);
  selects.forEach(sel => {
    if (sel.options[optIndex]) sel.options[optIndex].value = value;
    if (sel.options[optIndex]) sel.options[optIndex].textContent = `${labels[optIndex]}: ${value || '?'}`;
  });
}

function changeQuestionType(roundId, qId, newType) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  const q     = round?.questions?.find(q => q.id === qId);
  if (!q) return;
  q.type = newType;
  if (newType === 'mcq') {
    if (!Array.isArray(q.options) || !q.options.length) {
      q.options = ['Option A', 'Option B', 'Option C', 'Option D'];
    }
    if (!q.correctAnswer) q.correctAnswer = q.options[0] || 'Option A';
  }
  renderQuizEditor();
}

async function openMediaUpload(qId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,audio/*,video/*,image/gif';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API}/api/uploads/media`, { method: 'POST', body: fd });
      const d   = await res.json();
      if (!d.ok) { alert$('admin-alert', d.error || 'Erreur upload', 'error'); return; }
      // Trouver la question dans tous les rounds et mettre à jour
      for (const round of state.admin.editingQuiz?.rounds || []) {
        const q = (round.questions || []).find(q => q.id === qId);
        if (q) { q.mediaUrl = d.file.mediaUrl; break; }
      }
      alert$('admin-alert', '✅ Fichier uploadé : ' + d.file.filename, 'success');
      renderQuizEditor();
    } catch { alert$('admin-alert', 'Erreur réseau upload', 'error'); }
  };
  input.click();
}

async function saveQuiz() {
  const q = state.admin.editingQuiz;
  q.title = ($('#quiz-title')?.value || '').trim() || q.title;

  if (!q.title) { alert$('admin-alert', 'Titre requis', 'error'); return; }

  try {
    const method = q.id ? 'PUT' : 'POST';
    const path   = q.id ? `/api/quizzes/${q.id}` : '/api/quizzes';
    const d = await apiFetch(path, { method, body: JSON.stringify({ quiz: q }) });
    if (!d.ok) { alert$('admin-alert', d.error || 'Erreur save', 'error'); return; }
    alert$('admin-alert', '✅ Quiz enregistré !', 'success');
    state.admin.editingQuiz = d.quiz;
    state.admin.quizzes = await apiFetch('/api/quizzes').then(r => r.quizzes || []);
  } catch { alert$('admin-alert', 'Erreur réseau', 'error'); }
}

// ── Composants partagés ──────────────────────────────────────
function renderScoreboard(leaderboard, title = 'Classement') {
  if (!leaderboard?.length) return `<div class="card"><p class="muted">Aucun score</p></div>`;
  const rows = leaderboard.slice(0, 15).map((p, i) =>
    `<tr class="rank-${i+1}"><td><strong>${p.rank ?? i+1}</strong></td><td>${p.pseudo}</td><td class="muted">${p.teamName || '—'}</td><td><strong>${p.scoreTotal ?? 0}</strong></td></tr>`
  ).join('');
  return `
    <div class="card">
      <h2>${title}</h2>
      <table style="margin-top:12px;"><thead><tr><th>Rang</th><th>Joueur</th><th>Équipe</th><th>Score</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>`;
}

function renderFinalCeremony(gs, leaderboard) {
  const fc = gs?.phaseMeta?.finalCeremony;
  if (fc) {
    const revealed = fc.revealOrder.filter(p => p.revealed).reverse();
    return `
      <div class="card" style="text-align:center;padding:40px;">
        <h1>🎊 Cérémonie finale</h1>
        <p class="muted">${fc.revealCursor}/${fc.revealOrder.length} révélé(s)</p>
        ${fc.winnerTeam ? `<p style="margin-top:16px;font-size:1.3rem;">🏆 Équipe gagnante : <strong>${fc.winnerTeam.name}</strong></p>` : ''}
      </div>
      ${revealed.length ? `
        <div class="card">
          <h3>Podium</h3>
          <table style="margin-top:10px;"><tbody>
            ${revealed.map(p => `<tr><td><strong>${p.rank}</strong></td><td>${p.pseudo}</td><td>${p.scoreTotal} pts</td><td class="muted">${p.nickname}</td></tr>`).join('')}
          </tbody></table>
        </div>` : ''}`;
  }
  return renderScoreboard(leaderboard, '🏆 Résultats finaux');
}

// ── Utilitaires divers ───────────────────────────────────────
function copyToClipboard(text, alertId = '') {
  navigator.clipboard.writeText(text).then(() => {
    if (alertId) alert$(alertId, '📋 Lien copié !', 'success');
  }).catch(() => {
    if (alertId) alert$(alertId, 'Copie impossible', 'error');
  });
}

// ── Bootstrap ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSocket();

  // Navigation hash
  const hash = window.location.hash.replace('#', '') || 'home';
  const urlCode = new URLSearchParams(window.location.search).get('join');
  navigate(urlCode ? 'player' : hash);

  // Écouter les changements de hash
  window.addEventListener('hashchange', () => {
    const h = window.location.hash.replace('#', '') || 'home';
    navigate(h);
  });
});
