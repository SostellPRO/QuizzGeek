/* ============================================================
   Quiz Live – Application principale v2 (vanilla JS + Socket.IO)
   ============================================================ */

'use strict';

// ── Configuration ────────────────────────────────────────────
const API = '';  // URLs relatives – le serveur sert l'API et le front

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

  // Admin : quiz en cours d'édition
  admin: { quizzes: [], editingQuiz: null },
};

// ── Utilitaires DOM ──────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function el(tag, cls, innerHTML = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (innerHTML) e.innerHTML = innerHTML;
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
  if (msg) { setTimeout(() => { if (c.innerHTML) c.innerHTML = ''; }, 5000); }
}

function resolveMedia(url) {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : (url.startsWith('/') ? url : '/' + url);
}

function uid(pre = 'id') {
  return `${pre}_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;
}

function copyToClipboard(text, alertId = '') {
  navigator.clipboard.writeText(text).then(() => {
    if (alertId) alert$(alertId, '📋 Lien copié !', 'success');
  }).catch(() => {
    if (alertId) alert$(alertId, 'Copie impossible (HTTPS requis)', 'error');
  });
}

function randCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ── Mise à jour du bandeau nav ────────────────────────────────
function updateNavSession() {
  const el = document.getElementById('nav-session-info');
  const codeEl = document.getElementById('nav-session-code');
  const pseudoEl = document.getElementById('nav-session-pseudo');
  if (!el) return;

  const page = state.currentPage;
  if (page === 'player' && state.playerSession) {
    codeEl.textContent  = state.playerSession.sessionCode;
    pseudoEl.textContent = `👤 ${state.playerSession.pseudo}`;
    el.classList.add('visible');
  } else if (page === 'host' && state.host.connected) {
    codeEl.textContent  = state.host.sessionCode;
    pseudoEl.textContent = '🎮 Host';
    el.classList.add('visible');
  } else if (page === 'display' && state.display.connected) {
    codeEl.textContent  = state.display.sessionCode;
    pseudoEl.textContent = '📺 Display';
    el.classList.add('visible');
  } else {
    el.classList.remove('visible');
  }
}

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
    state.gameState          = payload?.gameState          || null;
    state.players            = payload?.players            || [];
    state.teams              = payload?.teams              || [];
    state.leaderboardPlayers = payload?.leaderboardPlayers || [];
    state.leaderboardTeams   = payload?.leaderboardTeams   || [];

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
  updateNavSession();

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

/* ====================================================================
   PAGE : HOME
   ==================================================================== */
pageInits.home = function() {
  html('page-home', `
    <div class="home-hero">
      <h1>🎮 Quiz Live</h1>
      <p class="tagline">Application de quiz en temps réel – créez, jouez, gagnez !</p>
    </div>
    <div class="home-grid">
      <div class="home-card" onclick="navigate('player')">
        <span class="icon">📱</span>
        <h3>Jouer</h3>
        <p>Rejoindre une partie depuis votre téléphone</p>
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
      <div class="home-card featured" onclick="openTestModal()">
        <span class="icon">🚀</span>
        <h3>Partie de test</h3>
        <p>Tester rapidement un quiz avec des bots</p>
      </div>
    </div>
    <div id="home-alert"></div>
  `);
};

// ── Modal partie de test ──────────────────────────────────────
async function openTestModal() {
  let quizzes = [];
  try {
    const d = await apiFetch('/api/quizzes');
    quizzes = d.quizzes || [];
  } catch {}

  const quizOptions = quizzes.length
    ? quizzes.map(q => `<option value="${q.id}">${q.title}</option>`).join('')
    : '<option value="">— Aucun quiz disponible —</option>';

  const code = randCode();

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'test-modal';
  modal.innerHTML = `
    <div class="modal">
      <h2>🚀 Partie de test</h2>
      <p class="muted" style="margin-bottom:20px;">Lancez rapidement une partie avec des faux joueurs pour tester vos quiz.</p>

      <div style="display:grid;gap:14px;">
        <div>
          <label>Quiz à tester</label>
          <select id="test-quiz-id">${quizOptions}</select>
        </div>
        <div class="grid2">
          <div>
            <label>Code de session</label>
            <input id="test-code" value="${code}" placeholder="ex: 1234" style="text-transform:uppercase;letter-spacing:4px;text-align:center;">
          </div>
          <div>
            <label>Clé host</label>
            <input id="test-hostkey" value="demo-host" placeholder="demo-host">
          </div>
        </div>
        <div>
          <label>Nombre de bots à ajouter</label>
          <input type="number" id="test-bots" value="3" min="0" max="20" style="width:100px;">
        </div>
      </div>

      <div id="test-alert" style="margin-top:12px;"></div>

      <div class="row" style="margin-top:20px;justify-content:flex-end;gap:10px;">
        <button class="btn-secondary" onclick="closeModal('test-modal')">Annuler</button>
        <button class="btn-warning" onclick="launchTestGame()">🚀 Lancer la partie de test</button>
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) closeModal('test-modal'); });
  document.body.appendChild(modal);
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.remove();
}

async function launchTestGame() {
  const quizId   = $('#test-quiz-id')?.value || '';
  const code     = ($('#test-code')?.value   || '').trim().toUpperCase();
  const hostKey  = ($('#test-hostkey')?.value || '').trim() || 'demo-host';
  const botCount = parseInt($('#test-bots')?.value) || 0;

  if (!quizId) { alert$('test-alert', 'Sélectionnez un quiz', 'error'); return; }
  if (!code)   { alert$('test-alert', 'Code de session requis', 'error'); return; }

  try {
    const d = await apiFetch('/api/sessions/from-quiz', {
      method: 'POST',
      body: JSON.stringify({ quizId, sessionCode: code, hostKey }),
    });
    if (!d.ok) { alert$('test-alert', d.error || 'Erreur création', 'error'); return; }

    // Se connecter en tant que host
    // *** FIX : sauvegarder AVANT navigate pour que pageInits.host lise les bonnes valeurs ***
    localStorage.setItem('quiz_host_session_code', d.session.sessionCode);
    localStorage.setItem('quiz_host_key', hostKey);
    state.host.sessionCode = d.session.sessionCode;
    state.host.hostKey     = hostKey;
    closeModal('test-modal');
    navigate('host');

    state.socket.emit('join:host', { sessionCode: d.session.sessionCode, hostKey }, (res) => {
      if (!res?.ok) { alert$('host-alert', res?.error || 'Connexion impossible', 'error'); return; }
      state.host.connected = true;
      updateNavSession();
      renderHostGame();

      // Ajouter les bots
      const botNames = ['Alice','Bob','Charlie','David','Eva','Frank','Grace','Hugo','Iris','Jules','Kira','Léo'];
      for (let i = 0; i < botCount; i++) {
        const pseudo = botNames[i % botNames.length] + (i >= botNames.length ? `_${Math.floor(i/botNames.length)+1}` : '');
        state.socket.emit('host:action', {
          sessionCode: d.session.sessionCode,
          hostKey,
          action: 'add_bot',
          pseudo,
        }, () => {});
      }
    });
  } catch (e) {
    alert$('test-alert', 'Erreur réseau', 'error');
  }
}

/* ====================================================================
   PAGE : PLAYER
   ==================================================================== */
pageInits.player = function() {
  // Restaurer session depuis localStorage
  if (!state.playerSession) {
    try {
      const raw = localStorage.getItem('quiz_player_session');
      if (raw) state.playerSession = JSON.parse(raw);
    } catch {}
  }

  const urlCode = new URLSearchParams(window.location.search).get('join')?.toUpperCase() || '';

  if (state.playerSession) {
    reconnectPlayer();
  } else {
    renderPlayerJoin(urlCode);
  }
};

function renderPlayerJoin(suggestedCode = '') {
  html('page-player', `
    <div class="card" style="text-align:center;background:linear-gradient(135deg,rgba(240,147,251,.08),rgba(245,87,108,.08));border-color:rgba(240,147,251,.25);">
      <h1 style="font-size:2.5rem;">📱 Rejoindre une partie</h1>
      <p class="muted">Entrez le code affiché par votre maître de jeu</p>
    </div>
    <div id="player-alert"></div>
    <div class="card">
      <h2>Connexion</h2>
      <div style="display:grid;gap:14px;margin-top:14px;">
        <div>
          <label>Code de session</label>
          <input id="in-session-code" placeholder="ex: 1234" value="${suggestedCode}"
            style="font-size:1.6rem;letter-spacing:6px;text-align:center;text-transform:uppercase;"
            oninput="this.value=this.value.toUpperCase()" autofocus>
        </div>
        <div>
          <label>Pseudo</label>
          <input id="in-pseudo" placeholder="Votre nom de joueur" maxlength="32">
        </div>
        <div id="team-select-wrap" style="display:none;">
          <label>Équipe</label>
          <select id="in-team"><option value="">— Choisir une équipe —</option></select>
        </div>
        <button class="btn-primary" onclick="submitJoinPlayer()" style="margin-top:4px;">
          🚀 Rejoindre la partie
        </button>
      </div>
    </div>
    <div class="card" style="text-align:center;padding:14px;">
      <p class="muted" style="font-size:0.82rem;">💡 Demandez le code de session à votre maître de jeu ou scannez le QR code.</p>
    </div>
  `);

  // Si code dans URL, essayer de précharger les équipes
  if (suggestedCode) {
    fetch(`${API}/api/sessions/${suggestedCode}`)
      .then(r => r.json())
      .then(d => { /* infos de session disponibles */ })
      .catch(() => {});
  }
}

function submitJoinPlayer() {
  const sessionCode = ($('#in-session-code')?.value || '').trim().toUpperCase();
  const pseudo      = ($('#in-pseudo')?.value       || '').trim();
  const teamId      = $('#in-team')?.value           || null;

  if (!sessionCode) { alert$('player-alert', 'Code de session requis', 'error'); return; }
  if (!pseudo)      { alert$('player-alert', 'Pseudo requis', 'error'); return; }

  state.socket.emit('join:player', { sessionCode, pseudo, teamId: teamId || null }, (res) => {
    if (!res?.ok) {
      alert$('player-alert', res?.error || 'Impossible de rejoindre', 'error');
      return;
    }
    const session = {
      playerId: res.player.id,
      pseudo:   res.player.pseudo,
      sessionCode,
      reconnectToken: res.player.reconnectToken,
      teamId:   res.player.teamId   || null,
      teamName: res.player.teamName || null,
    };
    state.playerSession = session;
    localStorage.setItem('quiz_player_session', JSON.stringify(session));
    updateNavSession();
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
      playerId:       res.player.id,
      pseudo:         res.player.pseudo,
      reconnectToken: res.player.reconnectToken,
      teamId:         res.player.teamId   || null,
      teamName:       res.player.teamName || null,
    };
    state.playerSession = updated;
    localStorage.setItem('quiz_player_session', JSON.stringify(updated));
    updateNavSession();
    renderPlayerGame();
  });
}

function renderPlayerGame() {
  const gs = state.gameState;
  const s  = state.playerSession;
  if (!s) { renderPlayerJoin(); return; }

  const myPlayer = state.players.find(p => p.id === s.playerId || p.playerId === s.playerId);
  const phase    = gs?.status || 'lobby';
  const score    = myPlayer?.scoreTotal ?? 0;

  let content = `
    <div class="session-banner">
      <span>Session&nbsp;: <strong class="session-code">${s.sessionCode}</strong></span>
      <span>👤 <strong>${s.pseudo}</strong>${s.teamName ? ` · ${s.teamName}` : ''}</span>
      <span style="margin-left:auto;display:flex;align-items:center;gap:6px;">
        <span style="color:rgba(255,255,255,.5);font-size:.8rem;">Score</span>
        <span style="font-size:1.3rem;font-weight:700;color:#38ef7d;">${score}</span>
      </span>
    </div>
    <div style="padding:16px 0;">
    <div id="player-alert"></div>
  `;

  if (phase === 'lobby') {
    content += `
      <div class="card" style="text-align:center;padding:48px 20px;">
        <div class="lobby-waiting">
          <span></span><span></span><span></span>
        </div>
        <h2>Salle d'attente</h2>
        <p class="muted" style="margin-top:8px;">En attente du maître de jeu…</p>
        <p class="muted" style="margin-top:6px;font-size:.85rem;">${state.players.length} joueur(s) connecté(s)</p>
        ${gs?.quizTitle ? `<div class="badge blue" style="margin-top:16px;">📚 ${gs.quizTitle}</div>` : ''}
      </div>`;
  } else if (phase === 'round_intro') {
    const round = gs.currentRound;
    content += `
      <div class="card" style="text-align:center;padding:40px 20px;background:linear-gradient(135deg,rgba(79,172,254,.06),rgba(0,242,254,.06));border-color:rgba(79,172,254,.3);">
        <div style="font-size:3rem;margin-bottom:12px;">📢</div>
        <h2>${round?.title || 'Nouvelle manche'}</h2>
        <p class="muted" style="margin-top:8px;">${round?.shortRules || 'Préparez-vous !'}</p>
      </div>`;
  } else if (phase === 'question' || phase === 'waiting') {
    content += renderPlayerQuestionContent(gs, s.playerId, gs.phaseMeta?.playerScreenLocked);
  } else if (phase === 'answer_reveal') {
    content += renderPlayerRevealContent(gs, s.playerId);
  } else if (phase === 'manual_scoring') {
    content += `
      <div class="card" style="text-align:center;padding:40px;">
        <div style="font-size:3rem;">⚖️</div>
        <h2 style="margin-top:12px;">Notation en cours…</h2>
        <p class="muted" style="margin-top:8px;">Le maître de jeu évalue les réponses</p>
      </div>`;
  } else if (phase === 'results') {
    content += renderScoreboard(state.leaderboardPlayers, '📊 Classement');
  } else if (phase === 'end') {
    content += renderFinalCeremony(gs, state.leaderboardPlayers);
  } else {
    content += `<div class="card" style="text-align:center;padding:40px;"><h2>Phase : ${phase}</h2></div>`;
  }

  content += `
    <div style="text-align:center;margin-top:24px;padding:0 16px;">
      <button class="btn-secondary" onclick="logoutPlayer()" style="font-size:.85rem;">🚪 Quitter la partie</button>
    </div>
    </div>`;

  html('page-player', content);
}

function renderPlayerQuestionContent(gs, playerId, locked) {
  const q          = gs?.currentQuestion;
  const pm         = gs?.phaseMeta || {};
  const answerMode = pm.answerMode || 'none';
  const answered   = !!(gs?.answers?.[q?.id]?.[playerId]);

  if (!q) return `<div class="card" style="text-align:center;padding:30px;">
    <div class="lobby-waiting"><span></span><span></span><span></span></div>
    <p class="muted" style="margin-top:12px;">En attente de la question…</p></div>`;

  // Média
  let media = '';
  if (q.mediaUrl) {
    const url = resolveMedia(q.mediaUrl);
    if (/\.(mp3|wav|ogg)$/i.test(url))
      media = `<div class="media-block"><audio controls autoplay src="${url}"></audio></div>`;
    else if (/\.(mp4|webm|mov)$/i.test(url))
      media = `<div class="media-block"><video controls autoplay src="${url}" style="max-height:40vh;"></video></div>`;
    else
      media = `<div class="media-block"><img src="${url}" alt="media"></div>`;
  }

  // Timer
  let timer = '';
  if (pm.timer?.remainingSec != null) {
    const rem = pm.timer.remainingSec;
    const tot = pm.timer.totalSec || 1;
    const pct = Math.max(0, (rem / tot) * 100);
    const cls = pct > 50 ? 'green' : pct > 25 ? 'orange' : 'red';
    const fillCls = pct > 50 ? '' : pct > 25 ? ' orange' : ' red';
    timer = `
      <div class="card" style="padding:14px 18px;">
        <div class="row" style="justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:.9rem;">⏱️ Temps restant</span>
          <span class="timer-value ${cls}">${rem}s</span>
        </div>
        <div class="progress-bar"><div class="fill${fillCls}" style="width:${pct}%"></div></div>
      </div>`;
  }

  if (locked || answered) {
    return `
      ${media}
      ${timer}
      <div class="card" style="text-align:center;padding:36px;">
        <div style="font-size:2.5rem;animation:pop 0.4s ease;">${answered ? '✅' : '🔒'}</div>
        <p style="margin-top:14px;font-size:1.1rem;font-weight:600;">${answered ? 'Réponse enregistrée !' : 'Écran verrouillé'}</p>
        ${q.content ? `<p class="muted" style="margin-top:8px;">${q.content}</p>` : ''}
      </div>`;
  }

  let answerUI = '';
  const sc = gs?.sessionCode || '';

  if (answerMode === 'buzzer') {
    answerUI = `
      <div style="text-align:center;padding:20px 0;">
        <button class="buzzer-btn" id="buzzer-btn" onclick="sendBuzzer('${sc}')">
          <span class="buzzer-icon">🔔</span>
          <span>BUZZER</span>
        </button>
      </div>`;
  } else if (answerMode === 'true_false') {
    answerUI = `
      <div class="answer-grid" style="grid-template-columns:1fr 1fr;margin-top:16px;">
        <button class="answer-btn" style="background:rgba(0,200,81,.1);border-color:rgba(56,239,125,.5);text-align:center;font-size:1.2rem;padding:24px;"
          onclick="sendAnswer('${sc}','${playerId}','vrai')">✅ VRAI</button>
        <button class="answer-btn" style="background:rgba(235,51,73,.1);border-color:rgba(235,51,73,.5);text-align:center;font-size:1.2rem;padding:24px;"
          onclick="sendAnswer('${sc}','${playerId}','faux')">❌ FAUX</button>
      </div>`;
  } else if (answerMode === 'mcq' && Array.isArray(q.options) && q.options.length) {
    const labels = ['A', 'B', 'C', 'D'];
    const opts = q.options.map((opt, i) =>
      `<button class="answer-btn" data-label="${labels[i] || ''}"
        onclick="sendAnswer('${sc}','${playerId}',${JSON.stringify(opt)})">${opt}</button>`
    ).join('');
    answerUI = `<div class="answer-grid">${opts}</div>`;
  } else {
    answerUI = `
      <div class="card">
        <label>Votre réponse</label>
        <div class="row" style="margin-top:8px;gap:8px;">
          <input id="text-answer" placeholder="Tapez votre réponse…" style="flex:1;"
            onkeydown="if(event.key==='Enter')sendTextAnswer('${sc}','${playerId}')">
          <button class="btn-primary" onclick="sendTextAnswer('${sc}','${playerId}')">Envoyer</button>
        </div>
      </div>`;
  }

  return `
    ${media}
    ${timer}
    <div class="card" style="padding:18px;">
      <p style="font-size:1.1rem;font-weight:600;line-height:1.5;">${q.content || ''}</p>
    </div>
    ${answerUI}`;
}

function renderPlayerRevealContent(gs, playerId) {
  const revealed = gs?.revealedAnswer;
  const correct  = revealed?.correctAnswer ?? '—';
  const myAnswer = revealed?.answers?.find(a => a.playerId === playerId);
  const isCorrect = myAnswer && normalizeAns(myAnswer.answer) === normalizeAns(String(correct));

  return `
    <div class="card" style="text-align:center;padding:32px;background:linear-gradient(135deg,rgba(56,239,125,.06),rgba(17,153,142,.06));">
      <h2>📋 Révélation</h2>
      <p class="muted" style="margin-top:8px;">Bonne réponse :</p>
      <div class="reveal-answer">${correct}</div>
      ${myAnswer ? `
        <p class="muted">Votre réponse : <strong style="color:${isCorrect?'#38ef7d':'#ff6b7a'}">${myAnswer.answer}</strong></p>
        <div style="font-size:2rem;margin-top:8px;">${isCorrect ? '✅' : '❌'}</div>
      ` : ''}
    </div>
    ${renderScoreboard(state.leaderboardPlayers, 'Classement')}`;
}

function normalizeAns(v) {
  return String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function sendAnswer(sessionCode, playerId, answer) {
  const s = state.playerSession;
  const btn = event?.target?.closest('.answer-btn');
  if (btn) {
    $$('.answer-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  }
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
    if (btn) { btn.disabled = true; btn.style.opacity = '0.4'; btn.style.animation = 'none'; }
  });
}

function logoutPlayer() {
  state.playerSession = null;
  localStorage.removeItem('quiz_player_session');
  updateNavSession();
  navigate('home');
}

/* ====================================================================
   PAGE : HOST
   ==================================================================== */
pageInits.host = function() {
  const savedCode = localStorage.getItem('quiz_host_session_code') || '';
  const savedKey  = localStorage.getItem('quiz_host_key')          || 'demo-host';
  state.host.sessionCode = savedCode;
  state.host.hostKey     = savedKey;
  state.host.connected   = false;
  renderHostConnect();
};

function renderHostConnect() {
  html('page-host', `
    <div class="card" style="background:linear-gradient(135deg,rgba(56,239,125,.07),rgba(17,153,142,.07));border-color:rgba(56,239,125,.25);">
      <h1>🎮 Maître de jeu</h1>
      <p class="muted">Connectez-vous à une session pour contrôler la partie</p>
    </div>
    <div id="host-alert"></div>
    <div class="card">
      <h2>Connexion à une session</h2>
      <div class="grid2" style="margin-top:14px;">
        <div>
          <label>Code de session</label>
          <input id="host-code" value="${state.host.sessionCode}" placeholder="ex: 1234"
            style="text-transform:uppercase;letter-spacing:4px;text-align:center;font-size:1.3rem;"
            oninput="this.value=this.value.toUpperCase()">
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
    <div class="card" style="padding:14px;text-align:center;">
      <p class="muted" style="font-size:.82rem;">💡 Créez d'abord une session depuis <strong>Admin → Lancer</strong>, ou utilisez <strong>Partie de test</strong> depuis l'accueil.</p>
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
    updateNavSession();
    renderHostGame();
  });
}

let hostActiveTab = 'controle';

function renderHostGame() {
  if (!state.host.connected) return;
  const gs    = state.gameState;
  const phase = gs?.status || 'lobby';
  const sc    = state.host.sessionCode;

  const phaseMap = {
    lobby:          '<span class="badge blue">🎪 Salle d\'attente</span>',
    round_intro:    '<span class="badge orange">📢 Présentation manche</span>',
    question:       '<span class="badge orange">❓ Question</span>',
    waiting:        '<span class="badge orange">⏳ Traitement</span>',
    answer_reveal:  '<span class="badge green">📋 Révélation</span>',
    manual_scoring: '<span class="badge orange">⚖️ Notation manuelle</span>',
    results:        '<span class="badge blue">📊 Résultats</span>',
    end:            '<span class="badge green">🎉 Fin</span>',
  };
  const phaseBadge = phaseMap[phase] || `<span class="badge">${phase}</span>`;
  const actionBtns = buildHostActionButtons(phase);
  const joinLink   = `${window.location.origin}/?join=${sc}`;

  let h = `
    <div class="session-banner">
      <span>Session&nbsp;: <strong class="session-code">${sc}</strong></span>
      <span>👥 <strong>${state.players.length}</strong> joueur(s)</span>
      <span>🔑 <code style="font-size:.82rem;color:rgba(255,255,255,.6)">${state.host.hostKey}</code></span>
      <button class="copy-btn" style="margin-left:auto;" onclick="copyToClipboard('${joinLink}','host-alert')">📋 Lien joueur</button>
    </div>
    <div style="padding:16px 0;">
    <div id="host-alert"></div>

    <div class="grid2" style="margin-bottom:16px;">
      <div class="card" style="margin:0;">
        <div class="muted" style="font-size:.73rem;margin-bottom:6px;">PHASE</div>
        ${phaseBadge}
      </div>
      <div class="card" style="margin:0;">
        <div class="muted" style="font-size:.73rem;margin-bottom:6px;">QUIZ / MANCHE</div>
        <span style="font-size:.88rem;">${gs?.quizTitle || '—'} · <em>${gs?.currentRound?.title || '—'}</em></span>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn ${hostActiveTab==='controle'?'active':''}" onclick="switchHostTab('controle')">🎮 Contrôle</button>
      <button class="tab-btn ${hostActiveTab==='joueurs'?'active':''}"  onclick="switchHostTab('joueurs')">👥 Joueurs</button>
      <button class="tab-btn ${hostActiveTab==='equipes'?'active':''}"  onclick="switchHostTab('equipes')">⚽ Équipes</button>
      <button class="tab-btn ${hostActiveTab==='scores'?'active':''}"   onclick="switchHostTab('scores')">📊 Scores</button>
    </div>
  `;

  /* ── ONGLET CONTRÔLE ── */
  if (hostActiveTab === 'controle') {
    const cq = gs?.currentQuestion;

    // Question active
    if (cq) {
      const rem = gs.phaseMeta?.timer?.remainingSec;
      const tot = gs.phaseMeta?.timer?.totalSec || 1;
      const pct = rem != null ? Math.max(0, rem / tot * 100) : 0;
      const cls = pct > 50 ? 'green' : pct > 25 ? 'orange' : 'red';
      const fillCls = pct > 50 ? '' : pct > 25 ? ' orange' : ' red';

      h += `
        <div class="card highlight">
          <div class="muted" style="font-size:.73rem;margin-bottom:6px;">QUESTION ACTIVE</div>
          <p style="margin-top:6px;font-weight:600;">${cq.content || '—'}</p>
          ${rem != null ? `
            <div style="margin-top:12px;">
              <div class="row" style="justify-content:space-between;margin-bottom:6px;">
                <span class="muted" style="font-size:.85rem;">Temps restant</span>
                <span class="timer-value ${cls}">${rem}s</span>
              </div>
              <div class="progress-bar"><div class="fill${fillCls}" style="width:${pct}%"></div></div>
            </div>` : ''}
          ${gs.buzzerState?.firstPseudo ? `<p style="margin-top:10px;">🔔 Premier : <strong>${gs.buzzerState.firstPseudo}</strong></p>` : ''}
          <p style="margin-top:8px;font-size:.84rem;">
            Écrans : ${gs.phaseMeta?.playerScreenLocked ? '<span class="badge red">🔒 Verrouillés</span>' : '<span class="badge green">🔓 Ouverts</span>'}
          </p>
        </div>`;
    }

    // Lobby : affichage salle d'attente (joueurs + équipes visibles directement)
    if (phase === 'lobby') {
      const joinLink = `${window.location.origin}/?join=${sc}`;
      h += `
        <div class="card" style="background:linear-gradient(135deg,rgba(56,239,125,.06),rgba(17,153,142,.06));border-color:rgba(56,239,125,.2);">
          <div style="text-align:center;padding:8px 0 12px;">
            <p class="muted" style="font-size:.82rem;margin-bottom:6px;">Les joueurs rejoignent avec le code :</p>
            <div class="session-code" style="font-size:2.4rem;letter-spacing:10px;color:#38ef7d;">${sc}</div>
            <div class="row" style="justify-content:center;gap:8px;margin-top:10px;">
              <button class="btn-secondary" style="font-size:.82rem;padding:6px 14px;" onclick="copyToClipboard('${joinLink}','host-alert')">📋 Copier le lien joueur</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3>👥 Salle d'attente — <span style="color:#38ef7d;">${state.players.length}</span> joueur(s)</h3>
            <button class="btn-secondary" style="font-size:.78rem;padding:5px 10px;" onclick="switchHostTab('joueurs')">Gérer →</button>
          </div>
          ${state.players.length ? `
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
              ${state.players.map(p => `
                <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:8px 12px;display:flex;align-items:center;gap:8px;">
                  <span class="player-dot ${p.connected?'connected':''}"></span>
                  <span style="font-weight:600;font-size:.88rem;">${p.pseudo}${p.isBot ? ' <span class="bot-badge">BOT</span>' : ''}</span>
                  ${p.teamName ? `<span class="muted" style="font-size:.78rem;">· ${p.teamName}</span>` : ''}
                </div>`).join('')}
            </div>` : `<p class="muted" style="text-align:center;padding:16px;">Aucun joueur connecté — en attente…</p>`}
        </div>

        ${state.teams.length ? `
          <div class="card">
            <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px;">
              <h3>⚽ Équipes (${state.teams.length})</h3>
              <button class="btn-secondary" style="font-size:.78rem;padding:5px 10px;" onclick="switchHostTab('equipes')">Gérer →</button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;">
              ${state.teams.map(t => {
                const members = state.players.filter(p => p.teamId === t.id);
                return `<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px;">
                  <p style="font-weight:700;font-size:.9rem;margin-bottom:6px;">⚽ ${t.name}</p>
                  ${members.length ? members.map(m => `<p style="font-size:.8rem;color:rgba(255,255,255,.7);">· ${m.pseudo}</p>`).join('') : '<p class="muted" style="font-size:.78rem;">Aucun membre</p>'}
                </div>`;
              }).join('')}
            </div>
          </div>` : ''}`;
    }

    // Boutons d'action
    if (actionBtns.length) {
      h += `
        <div class="card">
          <h3>Actions disponibles</h3>
          <div class="action-grid">${actionBtns.map(b =>
            `<button class="btn-${b.style}" onclick="hostAction('${b.action}')">${b.label}</button>`
          ).join('')}</div>
        </div>`;
    }

    // Timer
    if (phase === 'question' || phase === 'waiting') {
      h += `
        <div class="card">
          <h3>⏱️ Chronomètre</h3>
          <div class="row" style="margin-top:10px;gap:8px;">
            ${[15,30,45,60].map(s => `<button class="btn-secondary" style="padding:8px 12px;font-size:.85rem;" onclick="startTimerSec(${s})">${s}s</button>`).join('')}
            <input type="number" id="timer-sec" value="30" min="1" max="300" style="width:80px;">
            <button class="btn-success" onclick="startTimer()">▶️ Start</button>
          </div>
        </div>`;
    }

    // Points manuels
    if (['manual_scoring','answer_reveal','waiting','question'].includes(phase) && state.leaderboardPlayers.length) {
      h += `
        <div class="card">
          <h3>➕ Points manuels</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-top:12px;">
            ${state.leaderboardPlayers.slice(0, 12).map(p => `
              <div style="background:rgba(255,255,255,.04);border-radius:12px;padding:10px;text-align:center;">
                <p style="font-weight:600;font-size:.88rem;margin-bottom:2px;">${p.pseudo}</p>
                <p class="muted" style="margin-bottom:8px;font-size:.82rem;">${p.scoreTotal ?? 0} pts</p>
                <div class="row" style="gap:4px;justify-content:center;">
                  <button class="btn-success" style="width:44px;height:32px;padding:0;font-size:.85rem;" onclick="awardPoints('${p.playerId}',1)">+1</button>
                  <button class="btn-success" style="width:44px;height:32px;padding:0;font-size:.85rem;" onclick="awardPoints('${p.playerId}',2)">+2</button>
                </div>
              </div>`).join('')}
          </div>
        </div>`;
    }
  }

  /* ── ONGLET JOUEURS ── */
  else if (hostActiveTab === 'joueurs') {
    const rows = state.players.map(p => `
      <tr>
        <td><span class="player-dot ${p.connected?'connected':''}"></span></td>
        <td><strong>${p.pseudo}</strong>${p.isBot ? ' <span class="bot-badge">BOT</span>' : ''}</td>
        <td class="muted">${p.teamName || '—'}</td>
        <td>${p.scoreTotal ?? 0}</td>
        <td>
          <button class="btn-danger" style="padding:4px 8px;font-size:.78rem;"
            onclick="hostAction('remove_player',{playerId:'${p.id||p.playerId}'})">✕</button>
        </td>
      </tr>`).join('') || `<tr><td colspan="5" class="muted" style="text-align:center;padding:20px;">Aucun joueur</td></tr>`;

    const teamOptionsBot = state.teams.length
      ? state.teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
      : '';

    h += `
      <div class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:14px;">
          <h3>👥 Joueurs (${state.players.length})</h3>
          <div class="row" style="gap:6px;">
            <button class="btn-secondary" style="font-size:.82rem;padding:6px 12px;" onclick="hostAction('reset_scores')">🔄 Reset scores</button>
            <button class="btn-secondary" style="font-size:.82rem;padding:6px 12px;" onclick="hostAction('reset_game')">🔁 Reset partie</button>
            <button class="btn-danger"    style="font-size:.82rem;padding:6px 12px;" onclick="clearPlayers()">🗑️ Vider</button>
          </div>
        </div>
        <table><thead><tr><th></th><th>Pseudo</th><th>Équipe</th><th>Score</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table>
      </div>

      <div class="test-section">
        <h3 style="margin-bottom:12px;">🤖 Ajouter un bot joueur</h3>
        <div class="row" style="gap:8px;flex-wrap:wrap;">
          <input id="bot-name" placeholder="Nom du bot (laisser vide = aléatoire)" style="flex:1;min-width:140px;">
          ${teamOptionsBot ? `<select id="bot-team" style="min-width:110px;">${teamOptionsBot}</select>` : ''}
          <button class="btn-success" style="white-space:nowrap;" onclick="addBot()">➕ Ajouter</button>
        </div>
        <div class="row" style="margin-top:10px;gap:6px;">
          ${[3,5,10].map(n => `<button class="btn-secondary" style="font-size:.82rem;padding:6px 12px;" onclick="addMultipleBots(${n})">+${n} bots</button>`).join('')}
        </div>
      </div>`;
  }

  /* ── ONGLET ÉQUIPES ── */
  else if (hostActiveTab === 'equipes') {
    const teamsHtml = state.teams.map(t => `
      <div style="display:flex;gap:8px;align-items:center;">
        <input id="rename-${t.id}" value="${t.name}" style="flex:1;">
        <span class="muted" style="font-size:.82rem;white-space:nowrap;">${t.scoreTotal ?? 0} pts</span>
        <button class="btn-secondary" style="white-space:nowrap;padding:8px 12px;font-size:.85rem;"
          onclick="renameTeam('${t.id}')">✅ OK</button>
      </div>`).join('') || '<p class="muted">Aucune équipe configurée</p>';

    h += `
      <div class="card">
        <h3>✏️ Renommer les équipes</h3>
        <div style="display:grid;gap:10px;margin-top:14px;">${teamsHtml}</div>
      </div>`;
  }

  /* ── ONGLET SCORES ── */
  else if (hostActiveTab === 'scores') {
    h += renderScoreboard(state.leaderboardPlayers, '📈 Classement joueurs');
    if (state.leaderboardTeams.length) {
      h += `
        <div class="card">
          <h2>👥 Classement équipes</h2>
          <table style="margin-top:12px;"><thead><tr><th>Rang</th><th>Équipe</th><th>Score</th></tr></thead>
          <tbody>${state.leaderboardTeams.map((t, i) =>
            `<tr class="rank-${i+1}"><td>${t.rank ?? i+1}</td><td>${t.name}</td><td><strong>${t.scoreTotal ?? 0}</strong></td></tr>`
          ).join('')}</tbody></table>
        </div>`;
    }
  }

  h += `</div>`;  // fin padding
  html('page-host', h);
}

function buildHostActionButtons(phase) {
  const b = [];
  if (phase === 'lobby')          b.push({ label: '▶️ Démarrer le quiz',   action: 'start_quiz',    style: 'success' });
  if (phase === 'round_intro')    b.push({ label: '▶️ Démarrer la manche', action: 'start_round',   style: 'success' });
  if (phase === 'question' || phase === 'waiting') {
    b.push({ label: '📋 Révéler la réponse', action: 'reveal_answer',   style: 'secondary' });
    b.push({ label: '⏭️ Question suivante',  action: 'next_question',   style: 'secondary' });
    b.push({ label: '🔒 Verrouiller',        action: 'lock_players',    style: 'secondary' });
    b.push({ label: '🔓 Déverrouiller',      action: 'unlock_players',  style: 'secondary' });
  }
  if (phase === 'answer_reveal')  b.push({ label: '📊 Résultats',          action: 'show_results',  style: 'secondary' });
  if (phase === 'results') {
    b.push({ label: '⏭️ Manche suivante',    action: 'next_round',     style: 'secondary' });
    b.push({ label: '⏭️ Question suivante',  action: 'next_question',  style: 'secondary' });
    b.push({ label: '🏁 Terminer le quiz',   action: 'finish_quiz',    style: 'danger' });
  }
  if (phase === 'manual_scoring') b.push({ label: '📊 Afficher résultats', action: 'show_results',  style: 'secondary' });
  if (phase === 'end') {
    b.push({ label: '🎊 Cérémonie finale',   action: 'final_ceremony_init',    style: 'success' });
    b.push({ label: '➡️ Révéler suivant',    action: 'final_ceremony_reveal_next', style: 'secondary' });
    b.push({ label: '🔁 Nouvelle partie',    action: 'reset_game',             style: 'secondary' });
  }
  return b;
}

function switchHostTab(tab) {
  hostActiveTab = tab;
  renderHostGame();
}

function hostAction(action, extra = {}) {
  state.socket.emit('host:action', {
    sessionCode: state.host.sessionCode,
    hostKey:     state.host.hostKey,
    action,
    ...extra,
  }, (res) => {
    if (!res?.ok) alert$('host-alert', res?.error || 'Action impossible', 'error');
    else if (!['add_bot','remove_player','clear_players','reset_scores'].includes(action))
      alert$('host-alert', `✅ ${action}`, 'success');
  });
}

function startTimer() {
  const sec = parseInt($('#timer-sec')?.value) || 30;
  startTimerSec(sec);
}

function startTimerSec(sec) {
  state.socket.emit('host:action', {
    sessionCode: state.host.sessionCode,
    hostKey:     state.host.hostKey,
    action:      'start_timer',
    seconds:     sec,
  }, (res) => {
    if (!res?.ok) alert$('host-alert', res?.error || 'Erreur timer', 'error');
  });
}

function awardPoints(playerId, points) {
  hostAction('award_manual_points', { playerId, points });
}

function addBot() {
  const name   = ($('#bot-name')?.value || '').trim();
  const teamId = $('#bot-team')?.value  || null;
  hostAction('add_bot', { pseudo: name || undefined, teamId: teamId || undefined });
  if ($('#bot-name')) $('#bot-name').value = '';
}

function addMultipleBots(count) {
  const teamId = $('#bot-team')?.value || null;
  for (let i = 0; i < count; i++) {
    setTimeout(() => hostAction('add_bot', { teamId: teamId || undefined }), i * 150);
  }
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

/* ====================================================================
   PAGE : DISPLAY
   ==================================================================== */
pageInits.display = function() {
  const savedCode = localStorage.getItem('quiz_display_code') || state.host.sessionCode || '';
  state.display.connected = false;
  html('page-display', `
    <div class="card" style="background:linear-gradient(135deg,rgba(79,172,254,.07),rgba(0,242,254,.05));border-color:rgba(79,172,254,.3);">
      <h1>📺 Écran TV</h1>
      <p class="muted">Projeter la partie sur grand écran</p>
    </div>
    <div id="display-alert"></div>
    <div class="card" id="display-connect-card">
      <h2>Connexion à une session</h2>
      <div class="row" style="margin-top:12px;gap:10px;">
        <input id="display-code" placeholder="Code de session" value="${savedCode}"
          style="flex:1;font-size:1.3rem;letter-spacing:4px;text-transform:uppercase;text-align:center;"
          oninput="this.value=this.value.toUpperCase()">
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
    updateNavSession();
    hide('display-connect-card');
    renderDisplay();
  });
}

function renderDisplay() {
  if (!state.display.connected) return;
  const gs    = state.gameState;
  const phase = gs?.status || 'lobby';
  const sc    = state.display.sessionCode;

  let content = `
    <div class="session-banner">
      <span>Session&nbsp;: <strong class="session-code">${sc}</strong></span>
      <span>👥 ${state.players.length} joueur(s)</span>
      ${gs?.quizTitle ? `<span class="badge blue">${gs.quizTitle}</span>` : ''}
    </div>
    <div style="padding:16px 0;">`;

  if (phase === 'lobby') {
    content += `
      <div class="card" style="text-align:center;padding:70px 20px;background:linear-gradient(135deg,rgba(240,147,251,.07),rgba(245,87,108,.05));">
        <div style="font-size:5rem;margin-bottom:20px;animation:bounce 2s ease infinite;">🎮</div>
        <h1 style="font-size:2.8rem;">${gs?.quizTitle || 'Quiz Live'}</h1>
        <p class="muted" style="font-size:1.2rem;margin-top:16px;">
          Rejoignez avec le code&nbsp;: <strong class="session-code">${sc}</strong>
        </p>
        <div class="lobby-waiting" style="margin-top:24px;"><span></span><span></span><span></span></div>
        <p class="muted" style="margin-top:16px;">${state.players.length} joueur(s) connecté(s)</p>
      </div>`;
  } else if (phase === 'round_intro') {
    const round = gs?.currentRound;
    content += `
      <div class="card" style="text-align:center;padding:60px 20px;background:linear-gradient(135deg,rgba(79,172,254,.07),rgba(0,242,254,.05));border-color:rgba(79,172,254,.3);">
        <div style="font-size:3.5rem;margin-bottom:16px;">📢</div>
        <h1>${round?.title || 'Nouvelle manche'}</h1>
        ${round?.shortRules ? `<p class="muted" style="font-size:1.1rem;margin-top:14px;">${round.shortRules}</p>` : ''}
      </div>`;
  } else if (phase === 'question' || phase === 'waiting') {
    content += renderDisplayQuestion(gs);
  } else if (phase === 'answer_reveal') {
    const revealed = gs?.revealedAnswer;
    content += `
      <div class="card" style="text-align:center;padding:40px;background:linear-gradient(135deg,rgba(56,239,125,.07),rgba(17,153,142,.05));border-color:rgba(56,239,125,.3);">
        <h2>📋 Bonne réponse</h2>
        <div class="reveal-answer" style="font-size:3rem;">${revealed?.correctAnswer ?? '—'}</div>
      </div>
      ${renderAnswerList(revealed?.answers || [])}
      ${renderScoreboard(state.leaderboardPlayers, 'Classement')}`;
  } else if (phase === 'results' || phase === 'end') {
    content += renderFinalCeremony(gs, state.leaderboardPlayers);
  } else if (phase === 'manual_scoring') {
    content += `
      <div class="card" style="text-align:center;padding:50px;">
        <div style="font-size:3.5rem;">⚖️</div>
        <h2 style="margin-top:16px;">Notation en cours…</h2>
        ${gs?.buzzerState?.firstPseudo ? `<p style="margin-top:20px;font-size:1.5rem;">🔔 <strong>${gs.buzzerState.firstPseudo}</strong> a buzzé en premier</p>` : ''}
      </div>`;
  }

  content += '</div>';
  html('display-content', content);
}

function renderDisplayQuestion(gs) {
  const q  = gs?.currentQuestion;
  const pm = gs?.phaseMeta || {};

  if (!q) return `<div class="card" style="text-align:center;padding:50px;">
    <div class="lobby-waiting"><span></span><span></span><span></span></div>
    <p class="muted" style="margin-top:16px;">En attente…</p></div>`;

  // Média
  let media = '';
  if (q.mediaUrl) {
    const url = resolveMedia(q.mediaUrl);
    if (/\.(mp3|wav|ogg)$/i.test(url))
      media = `<div class="media-block"><audio controls autoplay src="${url}"></audio></div>`;
    else if (/\.(mp4|webm|mov)$/i.test(url))
      media = `<div class="media-block"><video controls autoplay src="${url}" style="max-height:50vh;"></video></div>`;
    else
      media = `<div class="media-block"><img src="${url}" alt="media"></div>`;
  }

  // Timer
  let timerHtml = '';
  if (pm.timer?.remainingSec != null) {
    const rem = pm.timer.remainingSec;
    const tot = pm.timer.totalSec || 1;
    const pct = Math.max(0, rem / tot * 100);
    const cls = pct > 50 ? 'green' : pct > 25 ? 'orange' : 'red';
    const fillCls = pct > 50 ? '' : pct > 25 ? ' orange' : ' red';
    timerHtml = `
      <div class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:10px;">
          <strong>⏱️ Temps</strong>
          <span class="timer-value ${cls}" style="font-size:2rem;">${rem}s</span>
        </div>
        <div class="progress-bar" style="height:16px;"><div class="fill${fillCls}" style="width:${pct}%"></div></div>
      </div>`;
  }

  // Votes vrai/faux
  let votes = '';
  if (pm.answerMode === 'true_false') {
    const yes = pm.trueFalseVotes?.yes?.length ?? gs.trueFalseVotes?.yes?.length ?? 0;
    const no  = pm.trueFalseVotes?.no?.length  ?? gs.trueFalseVotes?.no?.length  ?? 0;
    const tot = yes + no;
    votes = `
      <div class="card">
        <div class="grid2" style="text-align:center;gap:24px;">
          <div>
            <div style="font-size:2rem;color:#38ef7d;margin-bottom:8px;">✅ VRAI</div>
            <div style="font-size:3.5rem;font-weight:700;">${yes}</div>
            <div class="progress-bar" style="margin-top:12px;height:12px;">
              <div class="fill" style="background:linear-gradient(90deg,#00c851,#38ef7d);width:${tot>0?Math.round(yes/tot*100):0}%"></div>
            </div>
          </div>
          <div>
            <div style="font-size:2rem;color:#eb3349;margin-bottom:8px;">❌ FAUX</div>
            <div style="font-size:3.5rem;font-weight:700;">${no}</div>
            <div class="progress-bar" style="margin-top:12px;height:12px;">
              <div class="fill" style="background:linear-gradient(90deg,#eb3349,#ff6b7a);width:${tot>0?Math.round(no/tot*100):0}%"></div>
            </div>
          </div>
        </div>
      </div>`;
  }

  // Options QCM
  let opts = '';
  if (pm.answerMode === 'mcq' && Array.isArray(q.options) && q.options.length) {
    const labels = ['A', 'B', 'C', 'D'];
    opts = `<div class="answer-grid">${q.options.map((o, i) =>
      `<div class="answer-btn" style="font-size:1.05rem;padding:20px;" data-label="${labels[i]||''}">${o}</div>`
    ).join('')}</div>`;
  }

  const answered  = gs.answers?.[q.id] ? Object.keys(gs.answers[q.id]).length : 0;
  const connected = state.players.filter(p => p.connected !== false).length;

  return `
    ${media}
    ${timerHtml}
    <div class="card">
      <p style="font-size:1.5rem;font-weight:600;line-height:1.4;">${q.content || ''}</p>
      <p class="muted" style="margin-top:10px;">${answered} / ${connected} réponse(s)</p>
    </div>
    ${opts}
    ${votes}`;
}

function renderAnswerList(answers) {
  if (!answers.length) return '';
  const rows = answers.map(a =>
    `<tr><td><strong>${a.pseudo}</strong></td><td>${a.answer}</td></tr>`
  ).join('');
  return `
    <div class="card">
      <h3>📝 Réponses des joueurs</h3>
      <table style="margin-top:10px;">
        <thead><tr><th>Joueur</th><th>Réponse</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ====================================================================
   PAGE : ADMIN
   ==================================================================== */
pageInits.admin = function() {
  loadQuizList();
};

async function loadQuizList() {
  html('page-admin', `
    <div class="card" style="background:linear-gradient(135deg,rgba(168,85,247,.07),rgba(240,147,251,.05));border-color:rgba(168,85,247,.3);">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <div>
          <h1>⚙️ Admin Quiz</h1>
          <p class="muted">Créez et gérez vos quiz</p>
        </div>
        <div class="row" style="gap:8px;">
          <button class="btn-primary" onclick="startNewQuiz()">✨ Nouveau quiz</button>
          <button class="btn-secondary" onclick="navigate('home')">← Accueil</button>
        </div>
      </div>
    </div>
    <div id="admin-alert"></div>
    <div class="card" id="quiz-list-card" style="min-height:80px;display:flex;align-items:center;justify-content:center;">
      <div class="spinner"></div>
    </div>
  `);

  try {
    const d = await apiFetch('/api/quizzes');
    state.admin.quizzes = d.quizzes || [];
    renderQuizList();
  } catch {
    alert$('admin-alert', 'Impossible de charger les quiz', 'error');
  }
}

function renderQuizList() {
  const qs = state.admin.quizzes;
  if (!qs.length) {
    html('quiz-list-card', `
      <div style="text-align:center;padding:30px 20px;">
        <p style="font-size:2.5rem;margin-bottom:12px;">🎯</p>
        <p class="muted">Aucun quiz. Créez votre premier quiz !</p>
        <button class="btn-primary" style="margin-top:16px;" onclick="startNewQuiz()">✨ Créer un quiz</button>
      </div>`);
    return;
  }
  html('quiz-list-card', `
    <h2 style="margin-bottom:16px;">Mes quiz (${qs.length})</h2>
    <div style="display:grid;gap:10px;">
      ${qs.map(q => `
        <div class="row" style="background:rgba(255,255,255,.04);padding:14px 16px;border-radius:12px;border:1px solid rgba(255,255,255,.07);gap:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:140px;">
            <strong>${q.title}</strong>
            <span class="muted" style="margin-left:8px;font-size:.83rem;">${q.rounds?.length || 0} manche(s)</span>
          </div>
          <div class="row" style="gap:6px;">
            <button class="btn-secondary" style="font-size:.82rem;padding:7px 12px;" onclick="editQuiz('${q.id}')">✏️ Éditer</button>
            <button class="btn-success"   style="font-size:.82rem;padding:7px 12px;" onclick="launchQuiz('${q.id}')">▶️ Lancer</button>
            <button class="btn-danger"    style="font-size:.82rem;padding:7px 12px;" onclick="deleteQuiz('${q.id}')">🗑️</button>
          </div>
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
          <p class="muted" style="font-size:.8rem;margin-bottom:12px;">Les joueurs rejoignent avec le code de session</p>
          <button class="btn-success" style="width:100%;" onclick="doLaunchGame('${quizId}',false)">▶️ Lancer la partie</button>
        </div>
        <div style="background:rgba(245,87,108,.06);border:1px solid rgba(245,87,108,.25);border-radius:16px;padding:16px;text-align:center;">
          <div style="font-size:2rem;margin-bottom:8px;">🧪</div>
          <h3 style="font-size:1rem;margin-bottom:6px;">Mode test</h3>
          <p class="muted" style="font-size:.8rem;margin-bottom:12px;">Simulez avec des bots pour vérifier le quiz</p>
          <div style="margin-bottom:8px;">
            <label style="font-size:.78rem;color:rgba(255,255,255,.5);">Bots :</label>
            <input type="number" id="launch-bots" value="3" min="0" max="20"
              style="width:60px;margin-left:6px;padding:4px 8px;font-size:.9rem;">
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

  if (!code) { alert$('launch-alert', 'Code de session requis', 'error'); return; }

  try {
    const d = await apiFetch('/api/sessions/from-quiz', {
      method: 'POST',
      body: JSON.stringify({ quizId, sessionCode: code, hostKey }),
    });
    if (!d.ok) { alert$('launch-alert', d.error || 'Erreur création session', 'error'); return; }

    const sessionCode = d.session.sessionCode;

    // *** FIX CRITIQUE : sauvegarder dans localStorage AVANT navigate ***
    // Sinon pageInits.host écrase state.host depuis localStorage (vide) et connectHost() échoue
    localStorage.setItem('quiz_host_session_code', sessionCode);
    localStorage.setItem('quiz_host_key', hostKey);
    state.host.sessionCode = sessionCode;
    state.host.hostKey     = hostKey;

    closeModal('launch-modal');
    navigate('host');

    // Émettre join:host directement avec les valeurs connues (ne pas passer par connectHost/DOM)
    state.socket.emit('join:host', { sessionCode, hostKey }, (res) => {
      if (!res?.ok) { alert$('host-alert', res?.error || 'Connexion impossible', 'error'); return; }
      state.host.connected = true;
      updateNavSession();

      if (isTestMode && botCount > 0) {
        const botNames = ['Alice','Bob','Charlie','David','Eva','Frank','Grace','Hugo','Iris','Jules','Kira','Léo'];
        for (let i = 0; i < botCount; i++) {
          const pseudo = botNames[i % botNames.length] + (i >= botNames.length ? `_${Math.floor(i/botNames.length)+1}` : '');
          state.socket.emit('host:action', { sessionCode, hostKey, action: 'add_bot', pseudo }, () => {});
        }
      }

      renderHostGame();
    });
  } catch (e) {
    alert$('launch-alert', 'Erreur réseau', 'error');
  }
}

function emptyQuiz() {
  return {
    id: '',
    title: 'Nouveau quiz',
    teamsConfig: { enabled: true, teamCount: 2, teamNames: ['Équipe 1', 'Équipe 2'] },
    rounds: [],
  };
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
  const base = { id: uid('q'), content: 'Nouvelle question', mediaUrl: '', correctAnswer: '' };
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
    <div class="card" style="background:linear-gradient(135deg,rgba(168,85,247,.07),rgba(240,147,251,.05));border-color:rgba(168,85,247,.3);">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <h1>✏️ Éditeur de quiz</h1>
        <div class="row" style="gap:8px;">
          <button class="btn-success"   onclick="saveQuiz()">💾 Enregistrer</button>
          <button class="btn-secondary" onclick="loadQuizList()">← Retour</button>
        </div>
      </div>
    </div>
    <div id="admin-alert"></div>

    <div class="card">
      <h3>Informations générales</h3>
      <div style="display:grid;gap:12px;margin-top:14px;">
        <div>
          <label>Titre du quiz</label>
          <input id="quiz-title" value="${q.title || ''}" placeholder="Nom du quiz">
        </div>
      </div>
    </div>

    <div class="card">
      <div class="row" style="justify-content:space-between;margin-bottom:14px;">
        <h3>Manches (${q.rounds?.length || 0})</h3>
        <button class="btn-primary" style="font-size:.85rem;" onclick="addRound()">+ Manche</button>
      </div>
      <div id="rounds-container">
        ${(q.rounds || []).map((r, ri) => renderRoundBlock(r, ri)).join('')}
        ${!q.rounds?.length ? `<p class="muted" style="text-align:center;padding:20px;">Aucune manche. Ajoutez-en une !</p>` : ''}
      </div>
    </div>
  `);
}

function renderRoundBlock(round, ri) {
  const roundTypes = ['questionnaire','music','image','speed','true_false','riddle','karaoke'];
  return `
    <div class="round-panel" id="round-${round.id}">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
        <strong>Manche ${ri + 1} · ${round.title || '?'}</strong>
        <button class="btn-danger" style="padding:4px 10px;font-size:.78rem;" onclick="removeRound('${round.id}')">🗑️ Supprimer</button>
      </div>
      <div class="grid2" style="gap:10px;margin-bottom:14px;">
        <div>
          <label>Titre</label>
          <input value="${round.title || ''}" onchange="updateRound('${round.id}','title',this.value)" placeholder="Titre de la manche">
        </div>
        <div>
          <label>Type</label>
          <select onchange="updateRound('${round.id}','type',this.value)">
            ${roundTypes.map(t => `<option value="${t}" ${round.type === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Scoring</label>
          <select onchange="updateRound('${round.id}','scoringMode',this.value)">
            <option value="auto"     ${round.scoringMode === 'auto'     ? 'selected' : ''}>Auto</option>
            <option value="arbitre"  ${round.scoringMode === 'arbitre'  ? 'selected' : ''}>Arbitre (manuel)</option>
          </select>
        </div>
        <div>
          <label>Règles courtes</label>
          <input value="${round.shortRules || ''}" onchange="updateRound('${round.id}','shortRules',this.value)" placeholder="Affiché aux joueurs">
        </div>
      </div>
      <div>
        <div class="row" style="justify-content:space-between;margin-bottom:8px;">
          <span class="muted" style="font-size:.83rem;">Questions (${round.questions?.length || 0})</span>
          <button class="btn-secondary" style="padding:5px 12px;font-size:.82rem;" onclick="addQuestion('${round.id}','${round.type || 'questionnaire'}')">+ Question</button>
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

  // Sélecteur de mode pour les questions musicales (texte libre ou choix multiple)
  const musicTypeHtml = isMusic ? `
    <div style="display:flex;align-items:center;gap:8px;margin-top:6px;margin-left:28px;">
      <span style="font-size:.75rem;color:rgba(255,255,255,.45);">Mode réponse :</span>
      <select onchange="changeQuestionType('${roundId}','${q.id}',this.value)"
        style="font-size:.8rem;padding:3px 8px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:6px;color:#fff;">
        <option value="text" ${q.type !== 'mcq' ? 'selected' : ''}>📝 Texte libre</option>
        <option value="mcq"  ${q.type === 'mcq' ? 'selected' : ''}>🔘 Choix multiple</option>
      </select>
    </div>` : '';

  // Éditeur de choix multiples (questionnaire et musique en mode MCQ)
  const opts = Array.isArray(q.options) && q.options.length ? q.options : ['', '', '', ''];
  const labels = ['A', 'B', 'C', 'D'];
  const labelColors = ['#4ade80','#60a5fa','#f59e0b','#f87171'];

  const optionsHtml = isMcq ? `
    <div style="margin:8px 0 4px 28px;padding:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09);border-radius:10px;">
      <div style="font-size:.72rem;color:rgba(255,255,255,.4);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">Choix multiples</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
        ${opts.slice(0, 4).map((opt, i) => `
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:.78rem;font-weight:700;color:${labelColors[i]};min-width:16px;">${labels[i]}</span>
            <input value="${(opt || '').replace(/"/g, '&quot;')}" placeholder="Option ${labels[i]}"
              oninput="updateQuestionOption('${roundId}','${q.id}',${i},this.value)"
              style="flex:1;font-size:.82rem;padding:5px 8px;">
          </div>`).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:.75rem;color:rgba(255,255,255,.45);white-space:nowrap;">✅ Bonne réponse :</span>
        <select onchange="updateQuestion('${roundId}','${q.id}','correctAnswer',this.value)"
          style="flex:1;font-size:.82rem;padding:5px 8px;">
          ${opts.slice(0, 4).map((opt, i) => `
            <option value="${(opt || '').replace(/"/g, '&quot;')}"
              ${q.correctAnswer === opt ? 'selected' : ''}>${labels[i]}: ${opt || '?'}</option>`).join('')}
        </select>
      </div>
    </div>` : '';

  return `
    <div class="question-row" id="question-${q.id}" style="flex-direction:column;align-items:stretch;gap:0;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="muted" style="min-width:26px;font-size:.85rem;">${qi + 1}.</span>
        <input value="${(q.content || '').replace(/"/g, '&quot;')}" placeholder="Contenu de la question"
          onchange="updateQuestion('${roundId}','${q.id}','content',this.value)" style="flex:2;">
        ${!isMcq
          ? `<input value="${(q.correctAnswer || q.solution || '').replace(/"/g, '&quot;')}" placeholder="Bonne réponse"
               onchange="updateQuestion('${roundId}','${q.id}','correctAnswer',this.value)" style="flex:1;">`
          : ''}
        <button class="btn-secondary" style="padding:5px 10px;font-size:.78rem;white-space:nowrap;" onclick="openMediaUpload('${q.id}')">🖼️</button>
        <button class="btn-danger"    style="padding:5px 8px;font-size:.78rem;" onclick="removeQuestion('${roundId}','${q.id}')">✕</button>
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
  const q     = round?.questions?.find(q => q.id === qId);
  if (q) q[field] = value;
}

function updateQuestionOption(roundId, qId, optIndex, value) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  const q     = round?.questions?.find(q => q.id === qId);
  if (!q) return;
  if (!Array.isArray(q.options)) q.options = ['', '', '', ''];
  q.options[optIndex] = value;
  // Si c'était la bonne réponse, on met à jour correctAnswer avec la nouvelle valeur
  const labels = ['A', 'B', 'C', 'D'];
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
  input.type  = 'file';
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
      for (const round of state.admin.editingQuiz?.rounds || []) {
        const q = (round.questions || []).find(q => q.id === qId);
        if (q) { q.mediaUrl = d.file.mediaUrl; break; }
      }
      alert$('admin-alert', `✅ Fichier uploadé : ${d.file.filename}`, 'success');
      renderQuizEditor();
    } catch { alert$('admin-alert', 'Erreur réseau upload', 'error'); }
  };
  input.click();
}

async function saveQuiz() {
  const q   = state.admin.editingQuiz;
  q.title   = ($('#quiz-title')?.value || '').trim() || q.title;

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

/* ====================================================================
   COMPOSANTS PARTAGÉS
   ==================================================================== */
function renderScoreboard(leaderboard, title = 'Classement') {
  if (!leaderboard?.length) {
    return `<div class="card" style="text-align:center;padding:20px;"><p class="muted">Aucun score</p></div>`;
  }
  const rows = leaderboard.slice(0, 15).map((p, i) => `
    <tr class="rank-${i + 1}">
      <td><strong>${p.rank ?? i + 1}</strong></td>
      <td>${p.pseudo}</td>
      <td class="muted">${p.teamName || '—'}</td>
      <td><strong style="color:#38ef7d;">${p.scoreTotal ?? 0}</strong></td>
    </tr>`).join('');
  return `
    <div class="card">
      <h2>${title}</h2>
      <table style="margin-top:12px;">
        <thead><tr><th>Rang</th><th>Joueur</th><th>Équipe</th><th>Score</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderFinalCeremony(gs, leaderboard) {
  const fc = gs?.phaseMeta?.finalCeremony;
  if (fc) {
    const revealed = fc.revealOrder.filter(p => p.revealed).reverse();
    return `
      <div class="card ceremony-card">
        <div class="ceremony-rank">🎊</div>
        <h1 style="margin-top:16px;">Cérémonie finale</h1>
        <p class="muted" style="margin-top:8px;">${fc.revealCursor} / ${fc.revealOrder.length} révélé(s)</p>
        ${fc.winnerTeam ? `<p style="margin-top:16px;font-size:1.3rem;">🏆 Équipe gagnante : <strong>${fc.winnerTeam.name}</strong></p>` : ''}
      </div>
      ${revealed.length ? `
        <div class="card">
          <h3>Podium</h3>
          <table style="margin-top:10px;">
            <tbody>${revealed.map(p => `
              <tr class="rank-${p.rank}">
                <td><strong>${p.rank}</strong></td>
                <td>${p.pseudo}</td>
                <td style="color:#38ef7d;font-weight:600;">${p.scoreTotal} pts</td>
                <td class="muted">${p.nickname}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}`;
  }
  return renderScoreboard(leaderboard, '🏆 Résultats finaux');
}

/* ====================================================================
   BOOTSTRAP
   ==================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initSocket();

  // Navigation au démarrage
  const urlCode = new URLSearchParams(window.location.search).get('join');
  const hash    = window.location.hash.replace('#', '') || 'home';
  navigate(urlCode ? 'player' : hash);

  // Écouter les changements de hash
  window.addEventListener('hashchange', () => {
    const h = window.location.hash.replace('#', '') || 'home';
    navigate(h);
  });
});
