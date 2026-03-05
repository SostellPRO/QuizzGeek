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
  admin: { quizzes: [], editingQuiz: null, activeRoundIndex: 0 },
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

// ── P6 : Sons d'interaction (Web Audio API) ───────────────────
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  }
  return _audioCtx;
}
function playSound(type) {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    if (type === 'answer') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now); osc.stop(now + 0.22);
    } else if (type === 'buzzer') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now); osc.stop(now + 0.28);
    } else if (type === 'nav') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.start(now); osc.stop(now + 0.09);
    }
  } catch { /* noop si Web Audio non supporté */ }
}

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

// ── P8 : Galerie d'avatars ────────────────────────────────────
const AVATARS = [
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
  '🦁','🐸','🐵','🐔','🐧','🐦','🦆','🦅','🦉','🦇',
  '🐺','🐗','🦝','🦄','🦋','🐙','🦑','🐬','🦈','🐊',
  '🎮','🚀','⚡','🔥','🎸','🎯','🏆','💎','🌟','🍕',
];
let _selectedAvatar = AVATARS[0];

function selectAvatar(emoji) {
  _selectedAvatar = emoji;
  $$('.avatar-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.emoji === emoji);
  });
}

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
  const teamsOptions = state.teams.length
    ? state.teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
    : '';

  // Galerie d'avatars
  const avatarGrid = `
    <div>
      <label>Avatar</label>
      <div class="avatar-grid">
        ${AVATARS.map(e => `<button type="button" class="avatar-opt ${e===_selectedAvatar?'active':''}" data-emoji="${e}" onclick="selectAvatar('${e}')">${e}</button>`).join('')}
      </div>
    </div>`;

  // Cartes d'équipes si disponibles
  const teamCards = state.teams.length
    ? `<div>
        <label>Choisir votre équipe</label>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-top:8px;">
          ${state.teams.map(t => `
            <label style="display:flex;align-items:center;gap:6px;padding:10px;border-radius:10px;
              border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);cursor:pointer;">
              <input type="radio" name="team-pick" value="${t.id}" style="accent-color:#79b8ff;">
              <span style="font-size:.9rem;">${t.name}</span>
            </label>`).join('')}
          <label style="display:flex;align-items:center;gap:6px;padding:10px;border-radius:10px;
            border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.02);cursor:pointer;">
            <input type="radio" name="team-pick" value="" checked style="accent-color:#79b8ff;">
            <span style="font-size:.9rem;color:rgba(255,255,255,.5);">Sans équipe</span>
          </label>
        </div>
      </div>`
    : '';

  html('page-player', `
    <div class="card" style="text-align:center;background:linear-gradient(135deg,rgba(240,147,251,.1),rgba(245,87,108,.1));">
      <h1>📱 Quiz Live</h1>
      <p class="muted">Rejoins une partie et joue avec tes amis !</p>
    </div>
    <div id="player-alert"></div>
    <div class="card">
      <h2>Rejoindre la partie</h2>
      <div style="display:grid;gap:14px;margin-top:12px;">
        <div>
          <label>Code de session</label>
          <input id="in-session-code" placeholder="ex: 1234" value="${suggestedCode}"
            style="font-size:1.4rem;letter-spacing:4px;text-align:center;text-transform:uppercase;"
            oninput="this.value=this.value.toUpperCase();loadTeamsForCode(this.value)">
        </div>
        <div>
          <label>Pseudo</label>
          <input id="in-pseudo" placeholder="Votre nom de joueur" maxlength="32">
        </div>
        ${avatarGrid}
        ${teamCards}
        <button class="btn-primary" onclick="submitJoinPlayer()" style="margin-top:4px;">
          🚀 Rejoindre la partie
        </button>
      </div>
    </div>
  `);

  if (suggestedCode) loadTeamsForCode(suggestedCode);
}

function loadTeamsForCode(code) {
  if (!code || code.length < 4) return;
  fetch(`${API}/api/sessions/${code}`)
    .then(r => r.json())
    .then(d => {
      // Les équipes arriveront via game:state quand le socket rejoindra la session
    })
    .catch(() => {});
}

function submitJoinPlayer() {
  const sessionCode = ($('#in-session-code')?.value || '').trim().toUpperCase();
  const pseudo = ($('#in-pseudo')?.value || '').trim();
  const teamRadio = document.querySelector('input[name="team-pick"]:checked');
  const teamId = teamRadio?.value || null;

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
      avatar: _selectedAvatar || '🎮',
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
      <span>${s.avatar || '🎮'} <strong>${s.pseudo}</strong>${s.teamName ? ` · ${s.teamName}` : ''}</span>
      <span style="margin-left:auto;color:#38ef7d;font-weight:700;">Score : ${myPlayer?.scoreTotal ?? 0}</span>
    </div>
    <div style="padding:16px;">
    <div id="player-alert"></div>
  `;

  // Contenu selon la phase
  const isPaused = gs?.phaseMeta?.paused === true;

  if (isPaused) {
    content += `
      <div class="pause-screen">
        <div class="pause-icon">⏸️</div>
        <h2>Pause</h2>
        <p class="muted" style="margin-top:8px;">Le maître de jeu a mis la partie en pause…</p>
        <div class="waiting-dots" style="margin-top:20px;"><span></span><span></span><span></span></div>
      </div>`;
  } else if (phase === 'lobby') {
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
    // Burger : seul le joueur sélectionné joue, les autres attendent
    const burgerSelectedId = gs?.burgerSelectedPlayerId;
    const isBurgerRound = gs?.currentRound?.type === 'burger' || gs?.currentQuestion?.type === 'burger';
    if (isBurgerRound && burgerSelectedId && burgerSelectedId !== s.playerId) {
      const burgerPseudo = gs?.burgerSelectedPseudo || 'Un joueur';
      content += `
        <div class="card" style="text-align:center;padding:40px;">
          <div style="font-size:3rem;margin-bottom:14px;">🍔</div>
          <h2>Épreuve Burger</h2>
          <p class="muted" style="margin-top:8px;font-size:1rem;"><strong style="color:#fff;">${burgerPseudo}</strong> passe l'épreuve</p>
          <p class="muted" style="margin-top:10px;">Regardez l'écran principal !</p>
          <div class="waiting-dots"><span></span><span></span><span></span></div>
        </div>`;
    } else {
      content += renderPlayerQuestionContent(gs, s.playerId, gs.phaseMeta?.playerScreenLocked);
    }
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
      <div class="card" style="text-align:center;padding:34px;">
        <div class="answer-confirmed-icon">${answered ? '✅' : '🔒'}</div>
        <p style="margin-top:14px;font-size:1.15rem;font-weight:600;">${answered ? 'Réponse envoyée !' : 'Écran verrouillé'}</p>
        ${q.content ? `<p class="muted" style="margin-top:6px;">${q.content}</p>` : ''}
        ${answered ? '<div class="waiting-dots"><span></span><span></span><span></span></div>' : ''}
      </div>`;
  }

  // Buzzer queue info
  const myInQueue = Array.isArray(gs.buzzerQueue) && gs.buzzerQueue.includes(playerId);
  const connectedCount = state.players.filter(p => p.connected).length;
  const queueCount = Array.isArray(gs.buzzerQueue) ? gs.buzzerQueue.length : 0;
  const allBuzzed = queueCount >= connectedCount && connectedCount > 0;

  let answerUI = '';
  if (answerMode === 'buzzer') {
    if (myInQueue && !allBuzzed) {
      answerUI = `
        <div class="card" style="text-align:center;padding:30px;">
          <div style="font-size:2rem;">⏳</div>
          <p style="margin-top:10px;">Vous avez déjà participé. Attendez les autres joueurs…</p>
          <p class="muted" style="margin-top:6px;">${queueCount}/${connectedCount} ont participé</p>
        </div>`;
    } else {
      answerUI = `
        <div style="text-align:center;padding:20px 0;">
          <button class="buzzer-btn" id="buzzer-btn" onclick="sendBuzzer('${gs.sessionCode || ''}')">
            🔔<br>BUZZER
          </button>
          ${allBuzzed ? '<p class="muted" style="margin-top:10px;">Tour suivant !</p>' : ''}
        </div>`;
    }
  } else if (answerMode === 'true_false') {
    answerUI = `
      <div class="answer-grid" style="grid-template-columns:1fr 1fr;">
        <button class="answer-btn" style="background:rgba(0,200,81,.15);border-color:#38ef7d;text-align:center;font-size:1.3rem;" onclick="sendAnswer('${gs.sessionCode || ''}','${playerId}','vrai')">✅ VRAI</button>
        <button class="answer-btn" style="background:rgba(235,51,73,.15);border-color:#eb3349;text-align:center;font-size:1.3rem;" onclick="sendAnswer('${gs.sessionCode || ''}','${playerId}','faux')">❌ FAUX</button>
      </div>`;
  } else if (answerMode === 'mcq' && Array.isArray(q.options) && q.options.length) {
    const labelColors = ['#4ade80','#60a5fa','#f59e0b','#f87171'];
    const labels = ['A','B','C','D'];
    const opts = q.options.map((opt, i) => {
      const label = typeof opt === 'object' ? (opt.text || '') : String(opt || '');
      const optMedia = typeof opt === 'object' && opt.mediaUrl ? resolveMedia(opt.mediaUrl) : '';
      const isImg = optMedia && /\.(jpg|jpeg|png|gif|webp)$/i.test(optMedia);
      const isAudio = optMedia && /\.(mp3|wav|ogg)$/i.test(optMedia);
      const mediaEl = isImg ? `<img src="${optMedia}" style="max-height:80px;border-radius:6px;margin-bottom:6px;">` :
                      isAudio ? `<audio controls src="${optMedia}" style="height:28px;margin-bottom:6px;"></audio>` : '';
      return `<button class="answer-btn" style="border-color:${labelColors[i]};flex-direction:column;padding:12px;"
        onclick="sendAnswerByIndex(${i})">
        ${mediaEl}<span style="color:${labelColors[i]};font-weight:700;margin-bottom:4px;">${labels[i]}</span>${label}
      </button>`;
    }).join('');
    answerUI = `<div class="answer-grid" style="grid-template-columns:1fr 1fr;">${opts}</div>`;
  } else if (answerMode === 'burger') {
    answerUI = `
      <div class="card" style="text-align:center;padding:30px;">
        <div style="font-size:2.5rem;">🍔</div>
        <h3 style="margin-top:12px;">Observez bien les éléments…</h3>
        <p class="muted">Le maître de jeu vous interrogera à la fin</p>
      </div>`;
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
  playSound('answer');
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
  playSound('buzzer');
  state.socket.emit('player:buzzer', { sessionCode: s?.sessionCode || sessionCode, playerId: s?.playerId }, (res) => {
    if (!res?.ok) alert$('player-alert', res?.error || 'Buzzer non disponible', 'error');
    const btn = $('#buzzer-btn');
    if (btn) btn.disabled = true;
  });
}

// Fonction index-safe pour réponse MCQ (évite le problème d'échappement des guillemets dans onclick)
function sendAnswerByIndex(optIndex) {
  const q = state.gameState?.currentQuestion;
  const opts = Array.isArray(q?.options) ? q.options : [];
  const opt = opts[optIndex];
  const label = typeof opt === 'object' ? (opt.text || '') : String(opt || '');
  const s = state.playerSession;
  sendAnswer(s?.sessionCode, s?.playerId, label);
}

function logoutPlayer() {
  state.playerSession = null;
  localStorage.removeItem('quiz_player_session');
  navigate('home');
}

// ── Page : HOST ──────────────────────────────────────────────
pageInits.host = function() {
  // Si déjà connecté (ex: passage depuis doLaunchGame), on reste sur l'écran de jeu
  if (state.host.connected) {
    renderHostGame();
    return;
  }
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

// ── Host : Onglets principaux ──────────────────────────────────
let hostMainTab = 'gestion'; // 'gestion' | 'pilotage'
const hostExpandedRounds = new Set();

function switchHostMainTab(tab) {
  hostMainTab = tab;
  renderHostGame();
}

function toggleRoundAccordion(idx) {
  if (hostExpandedRounds.has(idx)) {
    hostExpandedRounds.delete(idx);
  } else {
    hostExpandedRounds.add(idx);
  }
  renderHostGame();
}

function openDisplayPopup() {
  const sc = state.host.sessionCode;
  if (!sc) { alert$('host-alert', 'Pas de session active', 'error'); return; }
  const url = `${window.location.origin}/?display-session=${encodeURIComponent(sc)}#display`;
  const popup = window.open(url, 'quiz_display', 'width=1280,height=760,toolbar=no,menubar=no,location=no,status=no,scrollbars=yes,resizable=yes');
  if (!popup) alert$('host-alert', '🚫 Popup bloqué — autorisez les popups pour ce site dans votre navigateur.', 'error');
}

function renderHostGame() {
  if (!state.host.connected) return;
  const gs    = state.gameState;
  const phase = gs?.status || 'lobby';
  const sc    = state.host.sessionCode;

  const joinLink = `${window.location.origin}/?join=${sc}`;

  const phaseBadge = {
    lobby:          '<span class="badge blue">🎪 Lobby</span>',
    round_intro:    '<span class="badge orange">📢 Présentation manche</span>',
    question:       '<span class="badge orange">❓ Question</span>',
    waiting:        '<span class="badge orange">⏳ Traitement</span>',
    answer_reveal:  '<span class="badge green">📋 Révélation</span>',
    manual_scoring: '<span class="badge orange">⚖️ Arbitrage</span>',
    results:        '<span class="badge blue">📊 Résultats</span>',
    end:            '<span class="badge green">🎉 Fin</span>',
  }[phase] || `<span class="badge">${phase}</span>`;

  let html_ = `
    <style>
      .host-main-tabs { display:flex; background:rgba(0,0,0,.25); border-bottom:2px solid rgba(255,255,255,.08); }
      .host-main-tab {
        flex:1; padding:15px 8px; border:none; border-bottom:3px solid transparent;
        background:transparent; color:rgba(255,255,255,.5); font-family:inherit;
        font-size:1rem; font-weight:600; cursor:pointer; transition:all .2s; text-align:center;
        margin-bottom:-2px;
      }
      .host-main-tab:hover { color:rgba(255,255,255,.85); background:rgba(255,255,255,.04); }
      .host-main-tab.active { color:#fff; border-bottom-color:#f093fb; background:rgba(240,147,251,.08); }
      .host-tab-body { padding:16px; }
      .ctrl-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
      @media(min-width:560px){ .ctrl-grid { grid-template-columns:repeat(3,1fr); } }
      .round-accordion { border:1px solid rgba(255,255,255,.1); border-radius:12px; overflow:hidden; margin-bottom:10px; }
      .round-acc-hdr {
        display:flex; align-items:center; gap:10px; padding:13px 16px;
        background:rgba(255,255,255,.05); cursor:pointer; border:none;
        width:100%; color:#fff; font-family:inherit; text-align:left; transition:background .15s;
      }
      .round-acc-hdr:hover { background:rgba(255,255,255,.09); }
      .round-acc-hdr.cur-round { background:rgba(240,147,251,.1); border-left:3px solid #f093fb; }
      .round-acc-body { padding:12px 16px; background:rgba(0,0,0,.15); }
      .q-line {
        display:flex; justify-content:space-between; align-items:flex-start; gap:10px;
        padding:9px 12px; border-radius:8px; margin-bottom:6px;
        background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07);
        transition:background .15s;
      }
      .q-line.q-active { background:rgba(99,179,237,.12); border-color:rgba(99,179,237,.3); }
    </style>
    <div class="session-banner">
      <span>Session : <strong class="session-code">${sc}</strong></span>
      ${phaseBadge}
      <span>👥 ${state.players.length}</span>
      <button class="btn-secondary" style="padding:4px 10px;font-size:.8rem;margin-left:auto;" onclick="copyToClipboard('${joinLink}','host-alert')">📋 Lien joueurs</button>
    </div>
    <div id="host-alert" style="padding:0 16px;"></div>
    <div class="host-main-tabs">
      <button class="host-main-tab ${hostMainTab==='gestion'?'active':''}" onclick="switchHostMainTab('gestion')">🎯 Gestion de partie</button>
      <button class="host-main-tab ${hostMainTab==='pilotage'?'active':''}" onclick="switchHostMainTab('pilotage')">🎮 Partie en cours</button>
    </div>
    <div class="host-tab-body">
  `;

  if (hostMainTab === 'gestion') {
    html_ += renderHostGestionTab(gs, phase, sc);
  } else {
    html_ += renderHostPilotageTab(gs, phase);
  }

  html_ += '</div>';
  html('page-host', html_);
}

// ── TAB 1 : Gestion de partie ─────────────────────────────────
function renderHostGestionTab(gs, phase, sc) {
  let out = '';

  // Quiz info + sélection
  const quizTitle = gs?.quizTitle || '—';
  out += `
    <div class="card" style="margin-bottom:14px;">
      <div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
        <div>
          <div class="muted" style="font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">QUIZ CHARGÉ</div>
          <h3 style="margin:0;">📚 ${quizTitle}</h3>
        </div>
        <button class="btn-secondary" style="font-size:.8rem;padding:6px 14px;" onclick="toggleQuizPicker()">🔄 Changer de quiz</button>
      </div>
    </div>
    <div id="quiz-picker-wrap" style="display:none;margin-bottom:14px;"></div>
  `;

  // Joueurs connectés
  const playerRows = state.players.map(p => `
    <tr>
      <td style="width:14px;"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${p.connected?'#38ef7d':'#555'};"></span></td>
      <td><strong>${p.pseudo}</strong></td>
      <td>
        <select onchange="hostAction('assign_team',{playerId:'${p.id||p.playerId}',teamId:this.value||null})"
          style="font-size:.78rem;padding:3px 6px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:6px;color:#fff;max-width:130px;">
          <option value="">— aucune —</option>
          ${state.teams.slice(0,20).map(t => `<option value="${t.id}" ${p.teamId===t.id?'selected':''}>${t.name}</option>`).join('')}
        </select>
      </td>
      <td style="color:#f59e0b;font-weight:600;">${p.scoreTotal ?? 0} pts</td>
      <td><button class="btn-danger" style="padding:3px 7px;font-size:.78rem;" onclick="hostAction('remove_player',{playerId:'${p.id||p.playerId}'})">✕</button></td>
    </tr>`).join('') || '<tr><td colspan="5" class="muted" style="text-align:center;padding:16px;">Aucun joueur connecté</td></tr>';

  out += `
    <div class="card" style="margin-bottom:14px;">
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <h3 style="margin:0;">👥 Joueurs (${state.players.length})</h3>
        <div class="row" style="gap:6px;">
          <button class="btn-secondary" style="font-size:.78rem;padding:5px 10px;" onclick="hostAction('reset_scores')">🔄 Scores</button>
          <button class="btn-danger" style="font-size:.78rem;padding:5px 10px;" onclick="clearPlayers()">🗑️ Vider</button>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;min-width:280px;">
          <thead><tr><th></th><th>Joueur</th><th>Équipe</th><th>Score</th><th></th></tr></thead>
          <tbody>${playerRows}</tbody>
        </table>
      </div>
      <div class="row" style="margin-top:14px;flex-wrap:wrap;gap:8px;">
        <input id="bot-name" placeholder="Nom du bot" style="flex:1;min-width:110px;max-width:180px;">
        <select id="bot-team" style="width:140px;flex-shrink:0;">
          <option value="">— sans équipe —</option>
          ${state.teams.slice(0,20).map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
        </select>
        <button class="btn-success" style="white-space:nowrap;flex-shrink:0;" onclick="addBot()">🤖 Ajouter bot</button>
      </div>
    </div>`;

  // Équipes (avec membres et score)
  const teamsWithPlayers = state.teams.filter(t => state.players.some(p => p.teamId === t.id));
  const teamsToShow = (teamsWithPlayers.length > 0 ? teamsWithPlayers : state.teams).slice(0, 12);
  if (teamsToShow.length) {
    const teamsHtml = teamsToShow.map(t => {
      const members = state.players.filter(p => p.teamId === t.id).map(p => p.pseudo).join(', ');
      return `
        <div style="background:rgba(255,255,255,.05);border-radius:10px;padding:12px;">
          <div class="row" style="gap:6px;margin-bottom:6px;">
            <input id="rename-${t.id}" value="${t.name}" style="flex:1;font-size:.85rem;padding:6px 10px;">
            <button class="btn-secondary" style="padding:5px 10px;font-size:.8rem;flex-shrink:0;" onclick="renameTeam('${t.id}')">✅</button>
          </div>
          ${members ? `<p class="muted" style="font-size:.75rem;">👤 ${members}</p>` : '<p class="muted" style="font-size:.75rem;">Aucun joueur</p>'}
          <p style="font-size:.78rem;margin-top:3px;color:#f59e0b;font-weight:600;">${t.scoreTotal ?? 0} pts</p>
        </div>`;
    }).join('');
    out += `
      <div class="card" style="margin-bottom:14px;">
        <h3>⚽ Équipes</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:10px;margin-top:12px;">
          ${teamsHtml}
        </div>
      </div>`;
  }

  // Zone de lancement / progression
  if (phase === 'lobby') {
    out += `
      <div class="card" style="text-align:center;padding:28px;border:2px solid rgba(56,239,125,.2);background:rgba(56,239,125,.04);margin-bottom:14px;">
        <h2 style="margin-bottom:8px;">🚀 Prêt à lancer ?</h2>
        <p class="muted" style="margin-bottom:18px;">${state.players.length} joueur(s) connecté(s) · Quiz : <strong>${quizTitle}</strong></p>
        <button class="btn-success" style="font-size:1.1rem;padding:14px 36px;" onclick="hostAction('start_quiz')">
          ▶️ Lancer la partie
        </button>
        <div style="margin-top:12px;">
          <button class="btn-secondary" style="font-size:.82rem;" onclick="hostAction('reset_game')">🔁 Reset partie</button>
        </div>
      </div>`;
  } else {
    out += `
      <div class="card" style="text-align:center;padding:16px;border:1px solid rgba(255,165,0,.2);background:rgba(255,165,0,.04);margin-bottom:14px;">
        <p style="margin-bottom:10px;">Partie en cours — phase : <strong style="color:#ffa500;">${phase}</strong></p>
        <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap;">
          <button class="btn-primary" onclick="switchHostMainTab('pilotage')">🎮 Aller au panneau de contrôle →</button>
          <button class="btn-secondary" style="font-size:.82rem;" onclick="hostAction('reset_game')">🔁 Reset partie</button>
        </div>
      </div>`;
  }

  return out;
}

// ── TAB 2 : Partie en cours (Pilotage) ────────────────────────
function renderHostPilotageTab(gs, phase) {
  let out = '';

  const currentRoundIdx = gs?.currentRoundIndex ?? -1;
  const currentQIdx     = gs?.currentQuestionIndex ?? -1;
  const currentRound    = gs?.currentRound;
  const currentQ        = gs?.currentQuestion;
  const isPaused        = gs?.phaseMeta?.paused === true;
  const isBurger        = (currentRound?.type === 'burger' || currentQ?.type === 'burger');
  const isBuzzer        = gs?.phaseMeta?.answerMode === 'buzzer';

  // ── Bandeau supérieur : phase + bouton TV ─────────────────────
  const phaseLabelMap = {
    lobby:          '<span class="badge blue">🎪 Lobby</span>',
    round_intro:    '<span class="badge orange">📢 Présentation manche</span>',
    question:       isPaused ? '<span class="badge red">⏸️ Pause</span>' : '<span class="badge orange">❓ Question</span>',
    waiting:        '<span class="badge orange">⏳ Traitement</span>',
    answer_reveal:  '<span class="badge green">📋 Révélation</span>',
    manual_scoring: '<span class="badge orange">⚖️ Arbitrage</span>',
    results:        '<span class="badge blue">📊 Résultats manche</span>',
    end:            '<span class="badge green">🎉 Fin du quiz</span>',
  };
  out += `
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
      <div>${phaseLabelMap[phase] || `<span class="badge">${phase}</span>`}</div>
      <div class="row" style="gap:6px;">
        <button class="btn-secondary btn-sm" onclick="showBroadcastModal()">📡 Diffuser</button>
        <button class="btn-primary" style="padding:8px 16px;" onclick="openDisplayPopup()">📺 Écran TV ↗</button>
      </div>
    </div>`;

  // ── Aperçu question en cours ──────────────────────────────────
  if (currentRound) {
    const answeredCount = currentQ ? Object.keys(gs?.answers?.[currentQ.id] || {}).length : 0;
    const connectedCount = state.players.filter(p => p.connected).length;
    out += `
      <div class="card" style="padding:13px;border-color:rgba(99,179,237,.2);margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
          <div style="flex:1;min-width:0;">
            <div class="muted" style="font-size:.65rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">
              Manche ${currentRoundIdx+1} — ${(currentRound.type||'').toUpperCase()} · ${(currentRound.questions||[]).length} Q
            </div>
            <div style="font-size:.92rem;font-weight:600;margin-bottom:${currentQ?'8px':'0'};">${currentRound.title||'Manche en cours'}</div>
            ${currentQ ? `
              <div style="padding:9px 12px;background:rgba(255,255,255,.06);border-radius:8px;">
                <div class="muted" style="font-size:.65rem;margin-bottom:3px;">Q${currentQIdx+1}</div>
                <p style="font-size:.9rem;font-weight:600;margin-bottom:4px;">${currentQ.content||'—'}</p>
                ${currentQ.correctAnswer ? `<p style="color:#38ef7d;font-size:.78rem;">✓ ${currentQ.correctAnswer}</p>` : ''}
              </div>` : '<p class="muted" style="font-size:.82rem;">Pas de question active</p>'}
          </div>
          <div style="text-align:right;flex-shrink:0;">
            ${currentQ ? `<p style="font-size:1.4rem;font-weight:700;color:#f59e0b;">${answeredCount}<span class="muted" style="font-size:.8rem;">/${connectedCount}</span></p><p class="muted" style="font-size:.65rem;">réponses</p>` : ''}
            <p style="margin-top:6px;font-size:.72rem;">${gs?.phaseMeta?.playerScreenLocked ? '<span class="badge red" style="font-size:.65rem;">🔒 Verrouillé</span>' : '<span class="badge green" style="font-size:.65rem;">🔓 Ouvert</span>'}</p>
          </div>
        </div>
      </div>`;
  }

  // ── Section NAVIGATION ────────────────────────────────────────
  const showNav = ['round_intro','question','waiting','answer_reveal','manual_scoring','results'].includes(phase);
  if (showNav) {
    out += `
      <div class="card" style="padding:12px;margin-bottom:10px;">
        <div class="ctrl-section-title">🧭 Navigation</div>
        <div class="ctrl-nav-grid">
          <button class="btn-secondary" onclick="hostAction('prev_round')" title="Manche précédente">← Manche</button>
          <button class="btn-secondary" onclick="hostAction('prev_question')" title="Question précédente">← Question</button>
          <button class="btn-success" onclick="hostAction('next_question')" title="Question suivante">Question →</button>
          <button class="btn-secondary" onclick="hostAction('next_round')" title="Manche suivante">Manche →</button>
        </div>
      </div>`;
  }

  // ── Section ACTIONS DE JEU ────────────────────────────────────
  const gameActions = buildHostGameActions(gs, phase, isPaused, isBuzzer, isBurger);
  if (gameActions.length) {
    out += `
      <div class="card" style="padding:12px;margin-bottom:10px;">
        <div class="ctrl-section-title">⚡ Actions de jeu</div>
        <div class="ctrl-action-grid">
          ${gameActions.map(b => `<button class="btn-${b.style}" onclick="${b.onclick}" style="font-size:.82rem;padding:9px 8px;">${b.label}</button>`).join('')}
        </div>
      </div>`;
  }

  // ── Buzzer state ──────────────────────────────────────────────
  if (gs?.buzzerState?.firstPseudo) {
    const buzzerQueuePseudos = (gs.buzzerQueue || [])
      .map(pid => state.players.find(p => (p.id||p.playerId) === pid)?.pseudo || pid)
      .filter(Boolean);
    out += `
      <div class="card" style="margin-bottom:10px;border-color:rgba(255,165,0,.35);background:rgba(255,165,0,.07);">
        <div class="row" style="gap:12px;margin-bottom:10px;">
          <span style="font-size:2rem;">🔔</span>
          <div style="flex:1;">
            <strong style="font-size:1.1rem;">${gs.buzzerState.firstPseudo}</strong>
            <p class="muted" style="font-size:.82rem;margin-top:2px;">a buzzé — interrogez oralement</p>
            ${buzzerQueuePseudos.length > 1 ? `<p class="muted" style="font-size:.75rem;margin-top:2px;">File : ${buzzerQueuePseudos.join(' → ')} (${buzzerQueuePseudos.length}/${state.players.filter(p=>p.connected).length})</p>` : ''}
          </div>
        </div>
        <div class="row" style="gap:6px;">
          <button class="btn-success" style="flex:1;" onclick="hostAction('award_buzzer_correct')">✅ Bonne réponse (+1)</button>
          <button class="btn-danger" style="flex:1;" onclick="hostAction('award_buzzer_wrong')">❌ Mauvaise (suivant)</button>
        </div>
      </div>`;
  }

  // ── Burger : sélection joueur ─────────────────────────────────
  if (isBurger && phase === 'question') {
    const selectedId = gs?.burgerSelectedPlayerId || null;
    const playerBtns = state.players.filter(p => p.connected).map(p => `
      <button class="burger-player-btn ${p.id === selectedId ? 'selected' : ''}"
        onclick="hostAction('burger_select_player',{playerId:'${p.id}'})">
        <span style="font-size:1.4rem;display:block;margin-bottom:4px;">${p.avatar || '🎮'}</span>
        ${p.pseudo}
      </button>`).join('');
    out += `
      <div class="card" style="padding:12px;margin-bottom:10px;">
        <div class="ctrl-section-title">🍔 Joueur Burger actif</div>
        <div class="burger-player-grid">${playerBtns || '<p class="muted">Aucun joueur connecté</p>'}</div>
        ${selectedId ? `<button class="btn-secondary btn-sm" style="margin-top:8px;" onclick="hostAction('burger_select_player',{playerId:null})">✕ Désélectionner</button>` : ''}
      </div>`;
  }

  // ── Timer ─────────────────────────────────────────────────────
  if (['question','waiting','manual_scoring'].includes(phase)) {
    const timerInfo = gs?.phaseMeta?.timer;
    const pct = timerInfo?.totalSec > 0 ? Math.round(timerInfo.remainingSec / timerInfo.totalSec * 100) : 0;
    out += `
      <div class="card" style="padding:12px;margin-bottom:10px;">
        <div class="ctrl-section-title">⏱️ Chronomètre</div>
        ${timerInfo ? `
          <div style="margin-bottom:10px;">
            <div class="row" style="justify-content:space-between;margin-bottom:6px;">
              <span class="muted" style="font-size:.85rem;">Restant</span>
              <strong style="color:#ff9a56;font-size:1.4rem;">${timerInfo.remainingSec}s</strong>
            </div>
            <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
          </div>` : ''}
        <div class="timer-presets">
          ${[5,10,20,30,45,60].map(s => `<button class="timer-preset-btn" onclick="setTimerPreset(${s})">${s}s</button>`).join('')}
        </div>
        <div class="row" style="gap:6px;">
          <input type="number" id="timer-sec" value="${timerInfo?.remainingSec || 30}" min="1" max="300" style="width:80px;flex-shrink:0;font-size:.9rem;">
          <button class="btn-success" style="flex:1;" onclick="startTimer()">▶ Démarrer</button>
          ${timerInfo ? '<button class="btn-secondary" style="flex-shrink:0;" onclick="hostAction(\'pause_game\')">⏸</button>' : ''}
        </div>
      </div>`;
  }

  // ── Révélation des réponses ───────────────────────────────────
  if (phase === 'answer_reveal' && gs?.revealedAnswer) {
    const revealed = gs.revealedAnswer;
    const correctNorm = (revealed.correctAnswer || '').trim().toLowerCase();
    const answerRows = (revealed.answers || []).map(a => {
      const isCorrect = (a.answer || '').trim().toLowerCase() === correctNorm;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:8px;background:${isCorrect?'rgba(56,239,125,.1)':'rgba(235,51,73,.08)'};margin-bottom:4px;">
        <span style="font-weight:600;font-size:.88rem;">${a.pseudo || '—'}</span>
        <span style="color:${isCorrect?'#38ef7d':'#eb3349'};font-size:.85rem;">${a.answer || '—'} ${isCorrect?'✅':'❌'}</span>
      </div>`;
    }).join('') || '<p class="muted">Aucune réponse</p>';
    out += `
      <div class="card" style="padding:13px;margin-bottom:10px;">
        <div class="ctrl-section-title">📋 Réponses révélées</div>
        <div style="padding:8px 12px;background:rgba(56,239,125,.08);border:1px solid rgba(56,239,125,.25);border-radius:8px;margin-bottom:8px;">
          <p class="muted" style="font-size:.65rem;margin-bottom:2px;">BONNE RÉPONSE</p>
          <p style="font-size:1.2rem;font-weight:700;color:#38ef7d;">${revealed.correctAnswer || '—'}</p>
        </div>
        <div>${answerRows}</div>
      </div>`;
  }

  // ── Gestion des points ────────────────────────────────────────
  if (['manual_scoring','answer_reveal','waiting','question','results'].includes(phase)) {
    const allPlayers = state.leaderboardPlayers.slice(0, 20);
    const allTeams = state.leaderboardTeams.slice(0, 10);

    if (allPlayers.length) {
      out += `
        <div class="card" style="padding:12px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
            <div class="ctrl-section-title" style="margin:0;">🏅 Attribution de points</div>
            <div class="row" style="gap:5px;">
              <button class="btn-success btn-sm" onclick="hostAction('award_all',{points:1})">+1 Tous</button>
              <button class="btn-danger btn-sm" onclick="hostAction('award_all',{points:-1})">-1 Tous</button>
            </div>
          </div>
          <div class="player-point-grid">
            ${allPlayers.map(p => `
              <div class="player-point-card">
                <span class="p-avatar">${p.avatar || '🎮'}</span>
                <div class="p-pseudo">${p.pseudo}</div>
                <div class="p-score">${p.scoreTotal ?? 0} pts</div>
                <div class="pt-btns">
                  <button class="pt-btn pt-btn-minus" onclick="awardPoints('${p.playerId}',-1)">-1</button>
                  <button class="pt-btn pt-btn-plus" onclick="awardPoints('${p.playerId}',1)">+1</button>
                </div>
              </div>`).join('')}
          </div>
          ${allTeams.length ? `
            <div style="margin-top:12px;border-top:1px solid rgba(255,255,255,.08);padding-top:10px;">
              <div class="ctrl-section-title" style="margin-bottom:7px;">⚽ Par équipe</div>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px;">
                ${allTeams.map(t => `
                  <div style="background:rgba(255,255,255,.05);border-radius:10px;padding:8px;text-align:center;">
                    <div style="font-size:.82rem;font-weight:600;margin-bottom:2px;">${t.name}</div>
                    <div style="font-size:.72rem;color:#f59e0b;margin-bottom:6px;">${t.scoreTotal??0} pts</div>
                    <div class="pt-btns">
                      <button class="pt-btn pt-btn-minus" onclick="hostAction('award_team',{teamId:'${t.id}',points:-1})">-1</button>
                      <button class="pt-btn pt-btn-plus" onclick="hostAction('award_team',{teamId:'${t.id}',points:1})">+1</button>
                    </div>
                  </div>`).join('')}
              </div>
            </div>` : ''}
        </div>`;
    }
  }

  // ── Bilan de manche ───────────────────────────────────────────
  if (phase === 'results') {
    const rnd = gs?.currentRound;
    const questions = Array.isArray(rnd?.questions) ? rnd.questions : [];
    if (questions.length) {
      const qRows = questions.map((q, i) => {
        const answersArr = Object.values(gs?.answers?.[q.id] || {});
        const correctNorm = (q.correctAnswer || '').trim().toLowerCase();
        const correctCount = answersArr.filter(a => (a.answer||'').trim().toLowerCase() === correctNorm).length;
        return `<div style="padding:9px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
            <div style="flex:1;">
              <span class="muted" style="font-size:.68rem;">${i+1}. ${(q.type||'?').toUpperCase()}</span>
              <p style="margin:3px 0;font-weight:600;font-size:.88rem;">${q.content||'—'}</p>
              ${q.correctAnswer ? `<p style="color:#38ef7d;font-size:.78rem;">✓ ${q.correctAnswer}</p>` : ''}
            </div>
            ${answersArr.length ? `<div style="text-align:right;flex-shrink:0;"><strong>${correctCount}/${answersArr.length}</strong><p class="muted" style="font-size:.68rem;">correct</p></div>` : ''}
          </div>
        </div>`;
      }).join('');
      out += `<div class="card" style="padding:12px;margin-bottom:10px;">
        <div class="ctrl-section-title">📊 Bilan — ${rnd?.title||'Manche'}</div>
        ${qRows}
      </div>`;
    }
    out += renderScoreboard(state.leaderboardPlayers, '🏆 Classement');
    if (state.leaderboardTeams.length) {
      out += `<div class="card"><h3>👥 Équipes</h3>
        <table><thead><tr><th>Rang</th><th>Équipe</th><th>Score</th></tr></thead>
        <tbody>${state.leaderboardTeams.map((t,i) => `<tr class="rank-${i+1}"><td>${t.rank??i+1}</td><td>${t.name}</td><td><strong>${t.scoreTotal??0}</strong></td></tr>`).join('')}</tbody></table>
      </div>`;
    }
  }

  // ── Fin + cérémonie ───────────────────────────────────────────
  if (phase === 'end') {
    const fc = gs?.phaseMeta?.finalCeremony;
    if (!fc) {
      out += `<div class="card" style="text-align:center;padding:20px;">
        <p class="muted" style="margin-bottom:12px;">Lance la cérémonie pour révéler le classement progressivement</p>
        <button class="btn-primary" onclick="hostAction('final_ceremony_init')">🎊 Lancer la cérémonie finale</button>
      </div>`;
    } else {
      const remaining = fc.revealOrder.length - fc.revealCursor;
      out += `<div class="card" style="padding:12px;margin-bottom:10px;">
        <div class="ctrl-section-title">🎊 Cérémonie finale</div>
        <div class="row" style="gap:6px;flex-wrap:wrap;">
          ${remaining > 0 ? `<button class="btn-success" onclick="hostAction('final_ceremony_reveal_next')">▶ Révéler suivant (${remaining} restant${remaining>1?'s':''})</button>` : ''}
          ${fc.winnerTeam && fc.stage !== 'team_winner' ? `<button class="btn-primary" onclick="hostAction('final_ceremony_show_team_winner')">🏆 Équipe gagnante</button>` : ''}
          <button class="btn-secondary btn-sm" onclick="hostAction('final_ceremony_reset')">↩ Recommencer</button>
        </div>
        <p class="muted" style="font-size:.75rem;margin-top:8px;">${fc.revealCursor}/${fc.revealOrder.length} révélé(s) · Étape : ${fc.stage}</p>
      </div>`;
      out += renderFinalCeremony(gs, state.leaderboardPlayers);
    }
  }

  // Accordion des manches
  out += renderRoundsAccordion(gs);

  return out;
}

// ── Boutons actions de jeu (sans navigation) ──────────────────
function buildHostGameActions(gs, phase, isPaused, isBuzzer, isBurger) {
  const btns = [];
  if (phase === 'lobby') {
    btns.push({ label: '▶️ Démarrer le quiz', style: 'success', onclick: "hostAction('start_quiz')" });
  }
  if (phase === 'round_intro') {
    btns.push({ label: '▶️ Première question', style: 'success', onclick: "hostAction('next_question')" });
    btns.push({ label: '🔁 Réafficher intro', style: 'secondary', onclick: "hostAction('start_round')" });
  }
  if (['question','waiting'].includes(phase)) {
    if (isPaused) {
      btns.push({ label: '▶️ Reprendre', style: 'success', onclick: "hostAction('resume_game')" });
    } else {
      btns.push({ label: '⏸️ Pause', style: 'warning', onclick: "hostAction('pause_game')" });
    }
    if (isBurger) {
      btns.push({ label: '🍔 Élément suivant', style: 'success', onclick: "hostAction('burger_next_item')" });
    } else {
      btns.push({ label: '📋 Révéler réponse', style: 'secondary', onclick: "hostAction('reveal_answer')" });
    }
    btns.push({ label: '🔁 Refresh question', style: 'secondary', onclick: "hostAction('refresh_question')" });
    btns.push({ label: '📊 Afficher scores', style: 'secondary', onclick: "hostAction('show_results')" });
  }
  if (phase === 'answer_reveal') {
    btns.push({ label: '📊 Résultats manche', style: 'secondary', onclick: "hostAction('show_results')" });
  }
  if (phase === 'results') {
    btns.push({ label: '⏭️ Manche suivante', style: 'success', onclick: "hostAction('next_round')" });
    btns.push({ label: '🏁 Terminer le quiz', style: 'danger', onclick: "hostAction('finish_quiz')" });
  }
  if (phase === 'manual_scoring') {
    if (isBuzzer) {
      btns.push({ label: '✅ Bonne réponse (+1)', style: 'success', onclick: "hostAction('award_buzzer_correct')" });
      btns.push({ label: '❌ Mauvaise (suivant)', style: 'danger', onclick: "hostAction('award_buzzer_wrong')" });
    }
    if (isBurger) {
      btns.push({ label: '🍔 Élément suivant', style: 'success', onclick: "hostAction('burger_next_item')" });
    }
    btns.push({ label: '📋 Révéler réponse', style: 'secondary', onclick: "hostAction('reveal_answer')" });
    btns.push({ label: '📊 Résultats manche', style: 'secondary', onclick: "hostAction('show_results')" });
  }
  if (phase === 'end') {
    btns.push({ label: '🔁 Nouvelle partie', style: 'secondary', onclick: "hostAction('reset_game')" });
  }
  return btns;
}

// Accordion des manches pour le pilotage
function renderRoundsAccordion(gs) {
  if (!gs || !gs.currentRound) return '';
  const currentRoundIdx = gs.currentRoundIndex ?? -1;
  const currentQIdx     = gs.currentQuestionIndex ?? -1;
  const questions = Array.isArray(gs.currentRound?.questions) ? gs.currentRound.questions : [];
  if (!questions.length) return '';

  const isExpanded = hostExpandedRounds.has(currentRoundIdx);
  const questionsSummary = isExpanded ? questions.map((q, qi) => {
    const isCurrent = qi === currentQIdx;
    const answeredCount = gs.answers?.[q.id] ? Object.keys(gs.answers[q.id]).length : 0;
    const connectedCount = state.players.filter(p => p.connected).length;
    return `
      <div class="q-line ${isCurrent ? 'q-active' : ''}">
        <div style="flex:1;min-width:0;">
          <span class="muted" style="font-size:.7rem;">${qi+1}. ${(q.type||'').toUpperCase()}</span>
          <p style="font-size:.87rem;font-weight:${isCurrent?'700':'400'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:2px 0;">${q.content || '—'}</p>
          ${q.correctAnswer ? `<p style="font-size:.74rem;color:#38ef7d;">✓ ${q.correctAnswer}</p>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:8px;">
          ${isCurrent ? '<span class="badge blue" style="font-size:.68rem;padding:2px 7px;">▶ En cours</span>' : ''}
          ${answeredCount > 0 ? `<p class="muted" style="font-size:.72rem;margin-top:3px;">${answeredCount}/${connectedCount} rép.</p>` : ''}
        </div>
      </div>`;
  }).join('') : '';

  return `
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px;">
      <button class="round-acc-hdr ${currentRoundIdx >= 0 ? 'cur-round' : ''}" onclick="toggleRoundAccordion(${currentRoundIdx})">
        <span style="font-size:1rem;">${isExpanded ? '▼' : '▶'}</span>
        <div style="flex:1;">
          <div class="muted" style="font-size:.68rem;text-transform:uppercase;margin-bottom:1px;">Manche ${currentRoundIdx+1}</div>
          <strong style="font-size:.95rem;">${gs.currentRound.title || 'Manche en cours'}</strong>
        </div>
        <span class="muted" style="font-size:.78rem;">${questions.length} question(s)</span>
      </button>
      ${isExpanded ? `<div class="round-acc-body">${questionsSummary}</div>` : ''}
    </div>`;
}

// Sélecteur de quiz (toggle)
function toggleQuizPicker() {
  const wrap = document.getElementById('quiz-picker-wrap');
  if (!wrap) return;
  if (wrap.style.display !== 'none') { wrap.style.display = 'none'; return; }
  wrap.innerHTML = '<div class="card"><p class="muted">Chargement des quiz…</p></div>';
  wrap.style.display = '';

  apiFetch('/api/quizzes').then(d => {
    const quizzes = d.quizzes || [];
    if (!quizzes.length) {
      wrap.innerHTML = '<div class="card"><p class="muted">Aucun quiz disponible. Créez-en un dans l\'admin.</p></div>';
      return;
    }
    wrap.innerHTML = `
      <div class="card" style="border-color:rgba(99,179,237,.25);">
        <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0;">📚 Choisir un quiz</h3>
          <button class="btn-secondary" style="font-size:.8rem;padding:5px 10px;" onclick="document.getElementById('quiz-picker-wrap').style.display='none'">✕ Fermer</button>
        </div>
        <div style="display:grid;gap:8px;">
          ${quizzes.map(q => `
            <div class="row" style="background:rgba(255,255,255,.04);padding:10px 14px;border-radius:10px;gap:10px;">
              <div style="flex:1;">
                <strong>${q.title}</strong>
                <span class="muted" style="margin-left:8px;font-size:.82rem;">${q.rounds?.length||0} manche(s)</span>
              </div>
              <button class="btn-primary" style="font-size:.82rem;padding:5px 12px;white-space:nowrap;" onclick="switchSessionQuiz('${q.id}','${(q.title||'').replace(/'/g,"\\'")}')">Charger</button>
            </div>`).join('')}
        </div>
      </div>`;
  }).catch(() => {
    wrap.innerHTML = '<div class="card"><p class="muted">Erreur lors du chargement des quiz</p></div>';
  });
}

async function switchSessionQuiz(quizId, quizTitle) {
  const sc = state.host.sessionCode;
  const hk = state.host.hostKey;
  if (!confirm(`Charger "${quizTitle}" ? La partie sera réinitialisée.`)) return;
  try {
    const d = await apiFetch(`/api/sessions/${sc}/quiz`, {
      method: 'PATCH',
      body: JSON.stringify({ quizId, hostKey: hk }),
    });
    if (!d.ok) { alert$('host-alert', d.error || 'Erreur', 'error'); return; }
    alert$('host-alert', `✅ Quiz "${quizTitle}" chargé !`, 'success');
    const wrap = document.getElementById('quiz-picker-wrap');
    if (wrap) wrap.style.display = 'none';
  } catch { alert$('host-alert', 'Erreur réseau', 'error'); }
}

// buildHostActionButtons conservé pour compatibilité (plus utilisé en principal)
function buildHostActionButtons(phase) { return []; }

function setTimerPreset(sec) {
  const inp = document.getElementById('timer-sec');
  if (inp) inp.value = sec;
  $$('.timer-preset-btn').forEach(b => b.classList.remove('active'));
  event?.target?.classList.add('active');
}

function hostAction(action, extra = {}) {
  const sc = state.host.sessionCode;
  const hk = state.host.hostKey;
  const gs = state.gameState;

  // Actions spéciales rapidité
  if (action === 'award_buzzer_correct') {
    const buzzerId = gs?.buzzerState?.firstPlayerId;
    if (!buzzerId) { alert$('host-alert', 'Aucun joueur n\'a buzzé', 'error'); return; }
    // +1 pt puis débloquer pour le suivant
    state.socket.emit('host:action', { sessionCode: sc, hostKey: hk, action: 'award_manual_points', playerId: buzzerId, points: 1, reason: 'rapidite' }, (res) => {
      if (!res?.ok) { alert$('host-alert', res?.error || 'Erreur', 'error'); return; }
      // Débloquer pour passer au prochain buzzer
      state.socket.emit('host:action', { sessionCode: sc, hostKey: hk, action: 'unlock_players' }, () => {});
    });
    return;
  }
  if (action === 'award_buzzer_wrong') {
    // Passer au joueur suivant dans la file (ou reset si vide)
    state.socket.emit('host:action', { sessionCode: sc, hostKey: hk, action: 'buzzer_next' }, (res) => {
      if (!res?.ok) alert$('host-alert', res?.error || 'Erreur', 'error');
    });
    return;
  }

  state.socket.emit('host:action', { sessionCode: sc, hostKey: hk, action, ...extra }, (res) => {
    if (!res?.ok) alert$('host-alert', res?.error || 'Action impossible', 'error');
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
  // Priorité : param URL (popup) > localStorage > session host courante
  const urlParams = new URLSearchParams(window.location.search);
  const urlCode = (urlParams.get('display-session') || '').trim().toUpperCase();
  const savedCode = urlCode || localStorage.getItem('quiz_display_code') || state.host.sessionCode || '';
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

  // Auto-connexion si code fourni (via popup URL ou localStorage)
  if (savedCode) {
    setTimeout(() => {
      const inp = $('#display-code');
      if (inp) inp.value = savedCode;
      connectDisplay();
    }, 300);
  }
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

  // Fond d'écran et musique de la manche courante
  const roundBg = gs?.currentRound?.backgroundUrl ? resolveMedia(gs.currentRound.backgroundUrl) : '';
  const roundMusic = gs?.currentRound?.musicUrl ? resolveMedia(gs.currentRound.musicUrl) : '';
  const bgStyle = roundBg ? `background-image:url('${roundBg}');background-size:cover;background-position:center;` : '';

  // Gestion de la musique (lecture auto)
  const musicEl = roundMusic
    ? `<audio id="round-music" autoplay loop src="${roundMusic}" style="display:none;"></audio>`
    : '';

  let content = `
    ${musicEl}
    <div class="session-banner">
      <span>Session : <strong class="session-code">${sc}</strong></span>
      <span>${state.players.length} joueur(s)</span>
    </div>
    <div style="padding:16px;${bgStyle}">`;

  const isPaused = gs?.phaseMeta?.paused === true;

  if (isPaused) {
    content += `
      <div class="pause-screen" style="padding:80px 20px;">
        <div class="pause-icon">⏸️</div>
        <h1>Pause</h1>
        <p class="muted" style="font-size:1.1rem;margin-top:10px;">Le maître de jeu a mis la partie en pause</p>
        <div class="waiting-dots"><span></span><span></span><span></span></div>
      </div>`;
  } else if (phase === 'lobby') {
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
        ${round?.type ? `<p class="muted" style="margin-top:8px;font-size:.9rem;text-transform:uppercase;letter-spacing:.06em;">${round.type}</p>` : ''}
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
  } else if (phase === 'results') {
    content += renderScoreboard(state.leaderboardPlayers, '📊 Classement de la manche');
    if (state.leaderboardTeams.length) {
      content += renderScoreboard(state.leaderboardTeams, '⚽ Équipes', true);
    }
  } else if (phase === 'end') {
    content += renderFinalCeremony(gs, state.leaderboardPlayers);
  } else if (phase === 'manual_scoring') {
    content += `
      <div class="card" style="text-align:center;padding:40px;">
        <div style="font-size:3rem;">⚖️</div>
        <h2>Notation en cours…</h2>
        ${gs?.buzzerState?.firstPseudo ? `<p style="margin-top:16px;font-size:1.5rem;">🔔 <strong>${gs.buzzerState.firstPseudo}</strong> a buzzé en premier</p>` : ''}
      </div>`;
  }

  // Message de diffusion hôte
  if (gs?.phaseMeta?.broadcastMessage) {
    const bm = gs.phaseMeta.broadcastMessage;
    content += `
      <div class="card" style="margin-top:14px;border-color:rgba(240,147,251,.4);background:rgba(240,147,251,.07);text-align:center;padding:20px;">
        ${bm.imageUrl ? `<img src="${bm.imageUrl}" style="max-width:100%;max-height:280px;border-radius:12px;margin-bottom:12px;object-fit:contain;">` : ''}
        ${bm.text ? `<p style="font-size:1.1rem;font-weight:600;">${bm.text}</p>` : ''}
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

  // Options QCM (avec support médias par option)
  let opts = '';
  if (pm.answerMode === 'mcq' && Array.isArray(q.options) && q.options.length) {
    const labelColors = ['#4ade80','#60a5fa','#f59e0b','#f87171'];
    const labels = ['A','B','C','D'];
    opts = `<div class="answer-grid" style="grid-template-columns:1fr 1fr;">${q.options.slice(0,4).map((o, i) => {
      const label = typeof o === 'object' ? (o.text || '') : String(o || '');
      const optMedia = typeof o === 'object' && o.mediaUrl ? resolveMedia(o.mediaUrl) : '';
      const isImg = optMedia && /\.(jpg|jpeg|png|gif|webp)$/i.test(optMedia);
      const isAudio = optMedia && /\.(mp3|wav|ogg)$/i.test(optMedia);
      const mediaEl = isImg ? `<img src="${optMedia}" style="max-height:70px;border-radius:6px;margin-bottom:6px;">` :
                      isAudio ? `<audio controls src="${optMedia}" style="height:28px;margin-bottom:6px;"></audio>` : '';
      return `<div class="answer-btn" style="border-color:${labelColors[i]};flex-direction:column;padding:14px;">
        ${mediaEl}<span style="color:${labelColors[i]};font-weight:700;margin-bottom:4px;">${labels[i]}</span>${label}
      </div>`;
    }).join('')}</div>`;
  }

  // Buzzer rapidité
  let buzzerDisplay = '';
  if (pm.answerMode === 'buzzer' && gs.buzzerState?.firstPseudo) {
    buzzerDisplay = `
      <div class="card" style="text-align:center;padding:30px;border:2px solid #ffa500;">
        <div style="font-size:2.5rem;">🔔</div>
        <h2 style="color:#ffa500;margin-top:12px;">${gs.buzzerState.firstPseudo}</h2>
        <p class="muted">a buzzé en premier</p>
      </div>`;
  }

  // Burger : afficher l'item courant
  let burgerDisplay = '';
  if ((q.type === 'burger' || gs?.currentRound?.type === 'burger') && gs.burgerState) {
    const bs = gs.burgerState;
    const items = q.items || [];
    const curItem = bs.currentItemIndex >= 0 ? items[bs.currentItemIndex] : null;
    const itemUrl = curItem?.mediaUrl ? resolveMedia(curItem.mediaUrl) : '';
    const isImg = itemUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(itemUrl);
    const isAudio = itemUrl && /\.(mp3|wav|ogg)$/i.test(itemUrl);
    burgerDisplay = `
      <div class="card" style="text-align:center;padding:30px;">
        <div style="font-size:.85rem;color:rgba(255,255,255,.4);margin-bottom:12px;">🍔 Élément ${bs.currentItemIndex+1} / ${items.length}</div>
        ${curItem ? `
          ${isImg ? `<img src="${itemUrl}" style="max-height:200px;border-radius:10px;margin-bottom:14px;">` : ''}
          ${isAudio ? `<audio controls autoplay src="${itemUrl}" style="margin-bottom:14px;"></audio>` : ''}
          <p style="font-size:1.6rem;font-weight:700;">${curItem.text || ''}</p>
        ` : '<p class="muted">En attente du maître de jeu…</p>'}
      </div>`;
  }

  // Compteur de réponses (pas pour burger/buzzer)
  const answered = gs.answers?.[q.id] ? Object.keys(gs.answers[q.id]).length : 0;
  const connected = state.players.filter(p => p.connected).length;
  const showCounter = pm.answerMode !== 'buzzer' && q.type !== 'burger' && q.type !== 'rapidite';

  return `
    ${media}
    ${timerHtml}
    <div class="card">
      <p style="font-size:1.4rem;font-weight:600;">${q.content || ''}</p>
      ${showCounter ? `<p class="muted" style="margin-top:8px;">${answered}/${connected} réponse(s)</p>` : ''}
    </div>
    ${opts}
    ${votes}
    ${buzzerDisplay}
    ${burgerDisplay}`;
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
    type: 'qcm',
    scoringMode: 'auto',
    scoringTarget: 'individual', // 'individual' | 'team'
    shortRules: '',
    backgroundUrl: '',
    musicUrl: '',
    questions: [],
  };
}

function emptyQuestion(type = 'qcm') {
  const base = { id: uid('q'), content: '', mediaUrl: '' };
  // QCM : 4 options avec texte (+ optionnellement un mediaUrl par option)
  if (type === 'qcm' || type === 'questionnaire' || type === 'mcq') {
    return {
      ...base,
      type: 'qcm',
      options: [
        { id: uid('opt'), text: 'Réponse A', mediaUrl: '' },
        { id: uid('opt'), text: 'Réponse B', mediaUrl: '' },
        { id: uid('opt'), text: 'Réponse C', mediaUrl: '' },
        { id: uid('opt'), text: 'Réponse D', mediaUrl: '' },
      ],
      correctOptionIndex: 0,
      correctAnswer: 'Réponse A',
    };
  }
  // Vrai/Faux
  if (type === 'true_false') {
    return { ...base, type: 'true_false', correctAnswer: 'vrai' };
  }
  // Rapidité (buzzer) — le host interroge oralement et donne les points
  if (type === 'rapidite' || type === 'speed') {
    return { ...base, type: 'rapidite' };
  }
  // Burger — liste de 10 items que le host défile
  if (type === 'burger') {
    return {
      ...base,
      type: 'burger',
      items: Array.from({ length: 10 }, (_, i) => ({
        id: uid('item'),
        text: `Élément ${i + 1}`,
        mediaUrl: '',
      })),
    };
  }
  return { ...base, type: type };
}

function renderQuizEditor() {
  const q = state.admin.editingQuiz;
  const rounds = q.rounds || [];
  if (state.admin.activeRoundIndex >= rounds.length) {
    state.admin.activeRoundIndex = Math.max(0, rounds.length - 1);
  }
  const ari = state.admin.activeRoundIndex;
  const activeRound = rounds[ari] || null;

  // Sidebar : liste des manches
  const sidebarItems = rounds.length
    ? rounds.map((r, ri) => `
        <div class="editor-sidebar-item ${ari===ri?'active':''}" onclick="switchRound(${ri})">
          <div style="font-size:.7rem;color:rgba(255,255,255,.4);margin-bottom:2px;">Manche ${ri+1}</div>
          <div style="font-weight:${ari===ri?'700':'400'};font-size:.86rem;color:${ari===ri?'#79b8ff':'rgba(255,255,255,.8)'};
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${r.title || `Manche ${ri+1}`}
          </div>
          <div style="font-size:.7rem;color:rgba(255,255,255,.35);margin-top:3px;">
            ${(r.questions||[]).length} question(s) · ${r.type||'qcm'}
          </div>
        </div>`).join('')
    : '<p class="muted" style="font-size:.8rem;text-align:center;">Aucune manche</p>';

  html('page-admin', `
    <div class="row" style="justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
      <h1>✏️ Éditeur de quiz</h1>
      <div class="row">
        <button class="btn-success"   onclick="saveQuiz()">💾 Enregistrer</button>
        <button class="btn-secondary" onclick="loadQuizList()">← Retour</button>
      </div>
    </div>
    <div id="admin-alert"></div>

    <div class="editor-layout">
      <!-- Colonne principale -->
      <div>
        <div class="card" style="border-color:rgba(99,179,237,.2);">
          <h3>📝 Informations générales</h3>
          <div style="margin-top:12px;">
            <label>Titre du quiz</label>
            <input id="quiz-title" value="${q.title || ''}" placeholder="Nom du quiz">
          </div>
        </div>

        <div id="rounds-container">
          ${activeRound
            ? renderRoundBlock(activeRound, ari)
            : `<div class="card" style="text-align:center;padding:40px;border:2px dashed rgba(255,255,255,.12);">
                <div style="font-size:2.5rem;margin-bottom:10px;">📋</div>
                <p class="muted">Aucune manche. Ajoutez-en une dans le panneau de droite.</p>
               </div>`}
        </div>
      </div>

      <!-- Sidebar manches -->
      <div class="editor-sidebar">
        <div class="card" style="padding:14px;border-color:rgba(99,179,237,.2);">
          <div style="font-size:.72rem;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">
            📋 Manches (${rounds.length})
          </div>
          ${sidebarItems}
          <button class="btn-primary" style="width:100%;padding:9px;font-size:.82rem;margin-top:10px;" onclick="addRound()">
            + Nouvelle manche
          </button>
        </div>
      </div>
    </div>
  `);
}

function switchRound(idx) {
  // Sauvegarder le titre du quiz en cours avant de changer de manche
  const titleInput = document.getElementById('quiz-title');
  if (titleInput && state.admin.editingQuiz) {
    state.admin.editingQuiz.title = titleInput.value.trim() || state.admin.editingQuiz.title;
  }
  state.admin.activeRoundIndex = idx;
  renderQuizEditor();
}

function renderRoundBlock(round, ri) {
  const roundTypes = [
    { v:'qcm',       l:'🔘 QCM (choix multiple)' },
    { v:'rapidite',  l:'⚡ Rapidité (buzzer)' },
    { v:'true_false',l:'✅ Vrai / Faux' },
    { v:'burger',    l:'🍔 Burger (liste révélée)' },
  ];

  const bgPreview = round.backgroundUrl
    ? `<div style="margin-top:6px;"><img src="${resolveMedia(round.backgroundUrl)}" style="max-height:80px;border-radius:8px;opacity:.7;"></div>` : '';
  const musicPreview = round.musicUrl
    ? `<div style="margin-top:6px;"><audio controls src="${resolveMedia(round.musicUrl)}" style="height:32px;width:100%;"></audio></div>` : '';

  const nbQ = round.questions?.length || 0;
  const qLabel = round.type === 'burger' ? 'Question(s) burger' : 'Questions';

  return `
    <div class="round-panel" id="round-${round.id}">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
        <strong style="font-size:1rem;">📋 Manche ${ri+1}</strong>
        <button class="btn-danger" style="padding:4px 10px;font-size:.8rem;" onclick="removeRound('${round.id}')">🗑️ Supprimer cette manche</button>
      </div>

      <!-- Infos de base -->
      <div class="grid2" style="gap:10px;margin-bottom:12px;">
        <div>
          <label>Titre</label>
          <input value="${round.title||''}" onchange="updateRound('${round.id}','title',this.value)" placeholder="Titre de la manche">
        </div>
        <div>
          <label>Type de questions</label>
          <select onchange="updateRound('${round.id}','type',this.value)">
            ${roundTypes.map(t => `<option value="${t.v}" ${round.type===t.v?'selected':''}>${t.l}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Points attribués à</label>
          <select onchange="updateRound('${round.id}','scoringTarget',this.value)">
            <option value="individual" ${(round.scoringTarget||'individual')==='individual'?'selected':''}>👤 Individuel</option>
            <option value="team"       ${round.scoringTarget==='team'?'selected':''}>👥 Équipe</option>
          </select>
        </div>
        <div>
          <label>Mode de scoring</label>
          <select onchange="updateRound('${round.id}','scoringMode',this.value)">
            <option value="auto"    ${round.scoringMode==='auto'?'selected':''}>Auto (vérification auto)</option>
            <option value="arbitre" ${round.scoringMode==='arbitre'?'selected':''}>Arbitre (attribution manuelle)</option>
          </select>
        </div>
        <div>
          <label>Règles courtes (affichées aux joueurs)</label>
          <input value="${round.shortRules||''}" onchange="updateRound('${round.id}','shortRules',this.value)" placeholder="Règles courtes">
        </div>
      </div>

      <!-- Personnalisation fond & musique -->
      <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px;margin-bottom:14px;">
        <div style="font-size:.78rem;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">🎨 Personnalisation</div>
        <div class="grid2" style="gap:10px;">
          <div>
            <label style="font-size:.8rem;">Fond d'écran</label>
            <div class="row" style="gap:6px;margin-top:4px;">
              <button class="btn-secondary" style="font-size:.78rem;padding:5px 10px;" onclick="uploadRoundMedia('${round.id}','backgroundUrl','image/*')">🖼️ Choisir image</button>
              ${round.backgroundUrl ? `<button class="btn-danger" style="font-size:.75rem;padding:4px 8px;" onclick="clearRoundMedia('${round.id}','backgroundUrl')">✕</button>` : ''}
            </div>
            ${bgPreview}
          </div>
          <div>
            <label style="font-size:.8rem;">Musique de fond</label>
            <div class="row" style="gap:6px;margin-top:4px;">
              <button class="btn-secondary" style="font-size:.78rem;padding:5px 10px;" onclick="uploadRoundMedia('${round.id}','musicUrl','audio/*')">🎵 Choisir musique</button>
              ${round.musicUrl ? `<button class="btn-danger" style="font-size:.75rem;padding:4px 8px;" onclick="clearRoundMedia('${round.id}','musicUrl')">✕</button>` : ''}
            </div>
            ${musicPreview}
          </div>
        </div>
      </div>

      <!-- Questions -->
      <div>
        <div class="row" style="justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:.85rem;color:rgba(255,255,255,.6);">${qLabel} (${nbQ})</span>
          <button class="btn-secondary" style="padding:4px 10px;font-size:.8rem;" onclick="addQuestion('${round.id}','${round.type||'qcm'}')">+ Question</button>
        </div>
        <div id="questions-${round.id}">
          ${(round.questions || []).map((q, qi) => renderQuestionRow(q, qi, round.id, round.type || 'qcm')).join('')}
        </div>
      </div>
    </div>`;
}

function renderQuestionRow(q, qi, roundId, roundType) {
  const effectiveType = q.type || roundType || 'qcm';
  const labels = ['A','B','C','D'];
  const labelColors = ['#4ade80','#60a5fa','#f59e0b','#f87171'];

  // Aperçu média de la question
  function mediaPreview(url, cls='') {
    if (!url) return '';
    const resolved = resolveMedia(url);
    if (/\.(mp3|wav|ogg)$/i.test(resolved))
      return `<audio controls src="${resolved}" style="height:28px;max-width:200px;${cls}"></audio>`;
    return `<img src="${resolved}" style="max-height:48px;border-radius:6px;opacity:.8;${cls}">`;
  }

  const qMediaBtn = `<button class="btn-secondary" style="padding:4px 8px;font-size:.78rem;white-space:nowrap;" onclick="openMediaUpload('${q.id}')">🖼️</button>`;
  const qMediaPreview = q.mediaUrl ? mediaPreview(q.mediaUrl,'margin-left:6px;') : '';
  const removeBtn = `<button class="btn-danger" style="padding:4px 8px;font-size:.8rem;flex-shrink:0;" onclick="removeQuestion('${roundId}','${q.id}')">✕</button>`;

  // Ligne commune : numéro + contenu + média + supprimer
  const headerRow = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <span class="muted" style="min-width:24px;font-size:.85rem;flex-shrink:0;">${qi+1}.</span>
      <input value="${(q.content||'').replace(/"/g,'&quot;')}" placeholder="Énoncé de la question"
        onchange="updateQuestion('${roundId}','${q.id}','content',this.value)"
        style="flex:1;min-width:160px;">
      ${qMediaBtn}
      ${qMediaPreview}
      ${removeBtn}
    </div>`;

  let body = '';

  // ── QCM ──────────────────────────────────────────────────
  if (effectiveType === 'qcm' || effectiveType === 'questionnaire' || effectiveType === 'mcq') {
    const opts = Array.isArray(q.options) && q.options.length
      ? q.options.map(o => typeof o === 'object' ? o : { id: uid('opt'), text: String(o||''), mediaUrl: '' })
      : [{ id:uid('opt'),text:'Réponse A',mediaUrl:'' },{ id:uid('opt'),text:'Réponse B',mediaUrl:'' },
         { id:uid('opt'),text:'Réponse C',mediaUrl:'' },{ id:uid('opt'),text:'Réponse D',mediaUrl:'' }];
    const correctIdx = typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0;

    body = `
      <div style="margin:8px 0 4px 28px;padding:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09);border-radius:10px;">
        <div style="font-size:.72rem;color:rgba(255,255,255,.4);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">Options de réponse</div>
        <div style="display:grid;gap:6px;">
          ${opts.slice(0, 4).map((opt, i) => `
            <div style="display:flex;align-items:center;gap:6px;">
              <input type="radio" name="correct-${q.id}" ${correctIdx===i?'checked':''} title="Bonne réponse"
                onchange="updateQcmCorrect('${roundId}','${q.id}',${i})"
                style="accent-color:#4ade80;width:16px;height:16px;flex-shrink:0;">
              <span style="font-size:.78rem;font-weight:700;color:${labelColors[i]};min-width:18px;">${labels[i]}</span>
              <input value="${(opt.text||'').replace(/"/g,'&quot;')}" placeholder="Option ${labels[i]}"
                oninput="updateQcmOptionText('${roundId}','${q.id}',${i},this.value)"
                style="flex:1;font-size:.82rem;padding:5px 8px;">
              <button class="btn-secondary" style="padding:3px 7px;font-size:.75rem;" onclick="uploadOptionMedia('${roundId}','${q.id}',${i})" title="Image/Son pour cette option">🖼️</button>
              ${opt.mediaUrl ? mediaPreview(opt.mediaUrl) : ''}
            </div>`).join('')}
        </div>
        <div style="margin-top:8px;font-size:.75rem;color:rgba(255,255,255,.4);">🔘 Cocher le bouton radio = bonne réponse</div>
      </div>`;
  }

  // ── VRAI/FAUX ────────────────────────────────────────────
  else if (effectiveType === 'true_false') {
    const isVrai = (q.correctAnswer||'vrai').toLowerCase() === 'vrai';
    body = `
      <div style="margin:8px 0 4px 28px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <span style="font-size:.78rem;color:rgba(255,255,255,.5);">✅ Bonne réponse :</span>
        <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
          <input type="radio" name="tf-${q.id}" value="vrai" ${isVrai?'checked':''}
            onchange="updateQuestion('${roundId}','${q.id}','correctAnswer','vrai')"
            style="accent-color:#38ef7d;">
          <span style="color:#38ef7d;font-weight:600;">✅ VRAI</span>
        </label>
        <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
          <input type="radio" name="tf-${q.id}" value="faux" ${!isVrai?'checked':''}
            onchange="updateQuestion('${roundId}','${q.id}','correctAnswer','faux')"
            style="accent-color:#eb3349;">
          <span style="color:#eb3349;font-weight:600;">❌ FAUX</span>
        </label>
      </div>`;
  }

  // ── RAPIDITÉ ─────────────────────────────────────────────
  else if (effectiveType === 'rapidite' || effectiveType === 'speed') {
    body = `
      <div style="margin:6px 0 4px 28px;background:rgba(255,165,0,.08);border:1px solid rgba(255,165,0,.2);border-radius:8px;padding:10px;font-size:.82rem;color:rgba(255,165,0,.9);">
        ⚡ Mode <strong>Rapidité</strong> : un buzzer apparaît sur l'écran du joueur. Le premier qui clique est interrogé oralement. Le maître de jeu attribue le point manuellement.
      </div>`;
  }

  // ── BURGER ───────────────────────────────────────────────
  else if (effectiveType === 'burger') {
    const items = Array.isArray(q.items) ? q.items : [];
    body = `
      <div style="margin:8px 0 4px 28px;padding:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09);border-radius:10px;">
        <div style="font-size:.72rem;color:rgba(255,255,255,.4);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;">🍔 Liste des éléments (le host les révèle un par un)</div>
        <div style="display:grid;gap:6px;">
          ${items.map((item, i) => `
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:.78rem;color:rgba(255,255,255,.4);min-width:22px;flex-shrink:0;">${i+1}.</span>
              <input value="${(item.text||'').replace(/"/g,'&quot;')}" placeholder="Élément ${i+1}"
                oninput="updateBurgerItem('${roundId}','${q.id}',${i},this.value)"
                style="flex:1;font-size:.82rem;padding:5px 8px;">
              <button class="btn-secondary" style="padding:3px 7px;font-size:.75rem;" onclick="uploadItemMedia('${roundId}','${q.id}',${i})" title="Image/Son">🖼️</button>
              ${item.mediaUrl ? mediaPreview(item.mediaUrl) : ''}
            </div>`).join('')}
        </div>
        <div style="margin-top:10px;font-size:.75rem;color:rgba(255,255,255,.4);">🎯 Après les 10 éléments, le maître de jeu attribue de 0 à 10 points</div>
      </div>`;
  }

  return `
    <div class="question-row" id="question-${q.id}" style="flex-direction:column;align-items:stretch;gap:4px;margin-bottom:10px;">
      ${headerRow}
      ${body}
    </div>`;
}

function updateQcmOptionText(roundId, qId, optIndex, value) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  const q = round?.questions?.find(q => q.id === qId);
  if (!q) return;
  if (!Array.isArray(q.options)) q.options = [{text:'',mediaUrl:''},{text:'',mediaUrl:''},{text:'',mediaUrl:''},{text:'',mediaUrl:''}];
  const opt = q.options[optIndex];
  if (typeof opt === 'string') q.options[optIndex] = { id: uid('opt'), text: value, mediaUrl: '' };
  else if (opt) opt.text = value;
  // recalculer correctAnswer depuis correctOptionIndex
  const idx = typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0;
  q.correctAnswer = (q.options[idx]?.text || q.options[idx] || '').toString();
}

function updateQcmCorrect(roundId, qId, optIndex) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  const q = round?.questions?.find(q => q.id === qId);
  if (!q) return;
  q.correctOptionIndex = optIndex;
  const opt = q.options?.[optIndex];
  q.correctAnswer = typeof opt === 'object' ? (opt.text || '') : String(opt || '');
}

function updateBurgerItem(roundId, qId, itemIndex, value) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  const q = round?.questions?.find(q => q.id === qId);
  if (!q || !Array.isArray(q.items)) return;
  if (q.items[itemIndex]) q.items[itemIndex].text = value;
}

function addRound() {
  const q = state.admin.editingQuiz;
  q.rounds = q.rounds || [];
  q.rounds.push(emptyRound(q.rounds.length));
  state.admin.activeRoundIndex = q.rounds.length - 1;
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

async function uploadRoundMedia(roundId, field, accept) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API}/api/uploads/media`, { method: 'POST', body: fd });
      const d   = await res.json();
      if (!d.ok) { alert$('admin-alert', d.error || 'Erreur upload', 'error'); return; }
      const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
      if (round) { round[field] = d.file.mediaUrl; }
      alert$('admin-alert', '✅ Fichier uploadé !', 'success');
      renderQuizEditor();
    } catch { alert$('admin-alert', 'Erreur réseau upload', 'error'); }
  };
  input.click();
}

function clearRoundMedia(roundId, field) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  if (round) { round[field] = ''; renderQuizEditor(); }
}

async function uploadOptionMedia(roundId, qId, optIndex) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,audio/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API}/api/uploads/media`, { method: 'POST', body: fd });
      const d   = await res.json();
      if (!d.ok) { alert$('admin-alert', d.error || 'Erreur upload', 'error'); return; }
      const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
      const q = round?.questions?.find(q => q.id === qId);
      if (q && Array.isArray(q.options) && q.options[optIndex]) {
        q.options[optIndex].mediaUrl = d.file.mediaUrl;
      }
      renderQuizEditor();
    } catch { alert$('admin-alert', 'Erreur réseau upload', 'error'); }
  };
  input.click();
}

async function uploadItemMedia(roundId, qId, itemIndex) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,audio/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API}/api/uploads/media`, { method: 'POST', body: fd });
      const d   = await res.json();
      if (!d.ok) { alert$('admin-alert', d.error || 'Erreur upload', 'error'); return; }
      const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
      const q = round?.questions?.find(q => q.id === qId);
      if (q && Array.isArray(q.items) && q.items[itemIndex]) {
        q.items[itemIndex].mediaUrl = d.file.mediaUrl;
      }
      renderQuizEditor();
    } catch { alert$('admin-alert', 'Erreur réseau upload', 'error'); }
  };
  input.click();
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
  if (!fc) return renderScoreboard(leaderboard, '🏆 Résultats finaux');

  const revealed = fc.revealOrder.filter(p => p.revealed);
  // Tri podium : 1ère place en dernier (affichage du bas vers le haut)
  const sorted = [...revealed].sort((a, b) => b.rank - a.rank);

  const rankEmoji = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`;
  const rankClass = r => r === 1 ? 'rank-1-card' : r === 2 ? 'rank-2-card' : r === 3 ? 'rank-3-card' : 'rank-other-card';

  // Déclencher confettis si le 1er vient d'être révélé
  const first = revealed.find(p => p.rank === 1);
  const confettiJs = first ? '<script>if(window.launchConfetti)launchConfetti();<\/script>' : '';

  const podiumCards = sorted.map((p, i) => {
    const delay = i * 0.12;
    return `<div class="podium-card ${rankClass(p.rank)}" style="animation-delay:${delay}s;">
      <span class="podium-rank">${rankEmoji(p.rank)}</span>
      <div class="podium-pseudo">${p.pseudo}</div>
      ${p.teamName ? `<div class="muted" style="font-size:.78rem;margin-top:2px;">⚽ ${p.teamName}</div>` : ''}
      <div class="podium-score">${p.scoreTotal ?? 0} pts</div>
      <div class="podium-nickname">${p.nickname || ''}</div>
    </div>`;
  }).join('');

  const teamWinner = fc.stage === 'team_winner' && fc.winnerTeam ? `
    <div class="winner-team-card" style="margin-top:14px;">
      <div style="font-size:3rem;margin-bottom:10px;">🏆</div>
      <h2>${fc.winnerTeam.name}</h2>
      <p class="muted" style="margin-top:6px;">Équipe gagnante · ${fc.winnerTeam.scoreTotal ?? 0} pts</p>
    </div>` : '';

  return `
    <div class="ceremony-container">
      ${confettiJs}
      <div class="card" style="text-align:center;padding:20px;margin-bottom:12px;">
        <div style="font-size:3rem;margin-bottom:8px;">🎊</div>
        <h2>Cérémonie finale</h2>
        <p class="muted">${fc.revealCursor}/${fc.revealOrder.length} révélé(s)</p>
      </div>
      ${revealed.length ? `<div class="podium-revealed-list">${podiumCards}</div>` : ''}
      ${teamWinner}
    </div>`;
}

// ── Confettis (lancés côté display/player au moment de la révélation du 1er) ──
function launchConfetti() {
  const colors = ['#f093fb','#f5576c','#38ef7d','#ffcc00','#4facfe','#ff9a56'];
  const container = document.body;
  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `
      left:${Math.random() * 100}vw;
      top:-20px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      width:${6 + Math.random() * 8}px;
      height:${10 + Math.random() * 12}px;
      animation-duration:${2.5 + Math.random() * 3}s;
      animation-delay:${Math.random() * 1.5}s;
    `;
    container.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}
window.launchConfetti = launchConfetti;

// ── Modal de diffusion ─────────────────────────────────────────
function showBroadcastModal() {
  const sc = state.host.sessionCode;
  const playerOptions = state.players.map(p => `<option value="${p.id}">${p.pseudo}</option>`).join('');
  const teamOptions = state.teams.filter(t => state.players.some(p => p.teamId === t.id))
    .map(t => `<option value="team:${t.id}">${t.name}</option>`).join('');

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'broadcast-modal';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="row" style="justify-content:space-between;margin-bottom:16px;">
        <h2>📡 Diffuser un message</h2>
        <button class="btn-secondary btn-sm" onclick="document.getElementById('broadcast-modal')?.remove()">✕</button>
      </div>
      <div style="margin-bottom:12px;">
        <label>Destinataire</label>
        <select id="bc-target">
          <option value="all">📢 Tous les joueurs</option>
          ${teamOptions ? `<optgroup label="Équipes">${teamOptions}</optgroup>` : ''}
          ${playerOptions ? `<optgroup label="Joueurs">${playerOptions}</optgroup>` : ''}
        </select>
      </div>
      <div style="margin-bottom:12px;">
        <label>Message texte</label>
        <textarea id="bc-text" rows="3" placeholder="Votre message…" style="resize:vertical;"></textarea>
      </div>
      <div style="margin-bottom:12px;">
        <label>Image / GIF (URL)</label>
        <input id="bc-image" type="url" placeholder="https://…">
      </div>
      <div id="bc-preview" style="margin-bottom:12px;"></div>
      <div class="row" style="gap:8px;">
        <button class="btn-primary" style="flex:1;" onclick="sendBroadcast()">📡 Envoyer</button>
        <button class="btn-secondary" style="flex:0 0 auto;" onclick="clearBroadcast()" title="Effacer le message diffusé">🗑 Effacer</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // Preview image
  document.getElementById('bc-image')?.addEventListener('input', function() {
    const prev = document.getElementById('bc-preview');
    if (prev) prev.innerHTML = this.value ? `<img src="${this.value}" style="max-width:100%;max-height:180px;border-radius:8px;object-fit:contain;">` : '';
  });
}

function sendBroadcast() {
  const sc = state.host.sessionCode;
  const hk = state.host.hostKey;
  const target = document.getElementById('bc-target')?.value || 'all';
  const text = (document.getElementById('bc-text')?.value || '').trim();
  const imageUrl = (document.getElementById('bc-image')?.value || '').trim();
  if (!text && !imageUrl) { alert('Message vide'); return; }

  state.socket.emit('host:action', {
    sessionCode: sc, hostKey: hk,
    action: 'broadcast_message',
    target, text, imageUrl,
  }, (res) => {
    if (!res?.ok) alert$('host-alert', res?.error || 'Diffusion impossible', 'error');
    else {
      alert$('host-alert', '✅ Message diffusé !', 'success');
      document.getElementById('broadcast-modal')?.remove();
    }
  });
}

function clearBroadcast() {
  const sc = state.host.sessionCode;
  const hk = state.host.hostKey;
  state.socket.emit('host:action', {
    sessionCode: sc, hostKey: hk,
    action: 'broadcast_clear',
  }, (res) => {
    if (res?.ok) {
      alert$('host-alert', '🗑 Message effacé', 'success');
      document.getElementById('broadcast-modal')?.remove();
    }
  });
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
  const _urlParams = new URLSearchParams(window.location.search);
  const urlCode = _urlParams.get('join');
  const urlDisplayCode = _urlParams.get('display-session');
  // Priorité : ?join → player | ?display-session → display | #hash → page
  navigate(urlCode ? 'player' : urlDisplayCode ? 'display' : hash);

  // Écouter les changements de hash
  window.addEventListener('hashchange', () => {
    const h = window.location.hash.replace('#', '') || 'home';
    navigate(h);
  });
});
