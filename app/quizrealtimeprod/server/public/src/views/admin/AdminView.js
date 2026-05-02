import { useState, useEffect } from 'react';
import { html, uid, emptyQuiz, randCode } from '../../utils.js';
import { useGame } from '../../contexts/GameContext.js';
import { Btn, Alert, Card, Badge, Modal } from '../../components/ui.js';
import QuizEditor from './QuizEditor.js';

// Launch modal
function LaunchModal({ quiz, onClose, socket, setHostSession, navigate }) {
  const [code,    setCode]    = useState(randCode());
  const [hostKey, setHostKey] = useState('demo-host');
  const [bots,    setBots]    = useState(3);
  const [alert,   setAlert]   = useState(null);
  const { apiFetch } = useGame();

  const launch = async (testMode) => {
    const sessionCode = code.trim().toUpperCase() || randCode();
    const hk = hostKey.trim() || 'demo-host';
    setAlert(null);
    try {
      const d = await apiFetch('/api/sessions/from-quiz', {
        method: 'POST',
        body: JSON.stringify({ quizId: quiz.id, sessionCode, hostKey: hk }),
      });
      if (!d.ok) { setAlert({ type: 'error', message: d.error || 'Erreur' }); return; }
      const sc = d.session.sessionCode;
      localStorage.setItem('quiz_host_session_code', sc);
      localStorage.setItem('quiz_host_key', hk);
      setHostSession({ sessionCode: sc, hostKey: hk, connected: false });
      onClose();
      // Connect as host
      socket.emit('join:host', { sessionCode: sc, hostKey: hk }, (res) => {
        if (!res?.ok) return;
        setHostSession({ sessionCode: sc, hostKey: hk, connected: true });
        if (testMode && bots > 0) {
          const names = ['Alice','Bob','Charlie','David','Eva','Frank','Grace','Hugo'];
          for (let i = 0; i < bots; i++) {
            socket.emit('host:action', { sessionCode: sc, hostKey: hk, action: 'add_bot', pseudo: names[i % names.length] }, () => {});
          }
        }
      });
      navigate('host');
    } catch(e) {
      setAlert({ type: 'error', message: 'Erreur réseau : ' + e.message });
    }
  };

  return html`
    <${Modal} show=${true} onClose=${onClose} title="▶️ Lancer le quiz">
      <div className="flex flex-col gap-4">
        <p className="text-white/50 text-sm">📚 <strong className="text-white">${quiz?.title}</strong></p>
        ${alert && html`<${Alert} type=${alert.type} message=${alert.message} />`}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Code de session</label>
            <input
              type="text"
              value=${code}
              onInput=${e => setCode(e.target.value.toUpperCase())}
              className="bg-bg-input border border-white/10 rounded-xl px-4 py-2.5 text-white text-base font-mono font-bold tracking-widest text-center focus:border-accent/60 outline-none transition-colors min-h-[48px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Clé host</label>
            <input
              type="text"
              value=${hostKey}
              onInput=${e => setHostKey(e.target.value)}
              placeholder="demo-host"
              className="bg-bg-input border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-accent/60 outline-none transition-colors min-h-[48px]"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="flex flex-col items-center p-4 rounded-xl bg-emerald-500/8 border border-emerald-500/25" style=${{ minHeight:'150px' }}>
            <span className="text-3xl mb-2">🎮</span>
            <p className="text-sm font-bold text-white/80 text-center mb-auto">Partie réelle</p>
            <div className="mt-3 w-full">
              <${Btn} variant="success" wide onClick=${() => launch(false)}>▶️ Lancer<//>
            </div>
          </div>
          <div className="flex flex-col items-center p-4 rounded-xl bg-amber-500/8 border border-amber-500/25" style=${{ minHeight:'150px' }}>
            <span className="text-3xl mb-2">🧪</span>
            <p className="text-sm font-bold text-white/80 text-center">Mode test</p>
            <div className="flex items-center gap-2 w-full mt-2">
              <label className="text-xs text-white/40">Bots :</label>
              <input
                type="number"
                value=${bots}
                onInput=${e => setBots(parseInt(e.target.value)||0)}
                min="0" max="20"
                className="flex-1 bg-bg-input border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm font-mono text-center focus:border-accent/60 outline-none"
              />
            </div>
            <div className="mt-3 w-full">
              <${Btn} variant="warning" wide onClick=${() => launch(true)}>🧪 Tester<//>
            </div>
          </div>
        </div>
      </div>
    <//>
  `;
}

// Quiz list item
function QuizItem({ quiz, onEdit, onLaunch, onDelete }) {
  return html`
    <div className="flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-bg-card border border-white/8 hover:border-white/15 transition-all">
      <div className="flex-1 min-w-0">
        <div className="font-bold text-white/90 truncate">${quiz.title}</div>
        <div className="text-xs text-white/35 mt-0.5">
          ${(quiz.rounds||[]).length} manche(s) ·
          ${(quiz.rounds||[]).reduce((acc,r) => acc + (r.questions||[]).length, 0)} question(s)
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <${Btn} variant="ghost" size="sm" onClick=${onEdit}>✏️<//>
        <${Btn} variant="success" size="sm" onClick=${onLaunch}>▶️<//>
        <${Btn} variant="danger" size="sm" onClick=${onDelete}>🗑<//>
      </div>
    </div>
  `;
}

export default function AdminView() {
  const { apiFetch, adminQuizzes, setAdminQuizzes, editingQuiz, setEditingQuiz, socket, setHostSession, navigate } = useGame();
  const [loading, setLoading] = useState(false);
  const [alert,   setAlert]   = useState(null);
  const [launchQuiz, setLaunchQuiz] = useState(null);

  const loadQuizzes = async () => {
    setLoading(true);
    try {
      const d = await apiFetch('/api/quizzes');
      setAdminQuizzes(d.quizzes || []);
    } catch(e) {
      setAlert({ type: 'error', message: 'Impossible de charger les quiz.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQuizzes(); }, []); // eslint-disable-line

  const deleteQuiz = async (id) => {
    if (!confirm('Supprimer ce quiz définitivement ?')) return;
    try {
      await apiFetch(`/api/quizzes/${id}`, { method: 'DELETE' });
      await loadQuizzes();
    } catch {
      setAlert({ type: 'error', message: 'Erreur suppression.' });
    }
  };

  const editQuiz = async (id) => {
    try {
      const d = await apiFetch(`/api/quizzes/${id}`);
      setEditingQuiz(d.quiz);
    } catch {
      setAlert({ type: 'error', message: 'Impossible de charger le quiz.' });
    }
  };

  const newQuiz = () => setEditingQuiz(emptyQuiz());

  // Show editor if editing
  if (editingQuiz) {
    return html`<${QuizEditor} onBack=${() => { setEditingQuiz(null); loadQuizzes(); }} />`;
  }

  return html`
    <div className="flex flex-col min-h-[100dvh] bg-bg">

      <!-- Header -->
      <div className="sticky top-0 z-10 bg-bg-alt border-b border-white/8 px-4 py-3 flex items-center gap-3">
        <button onClick=${() => navigate('home')} className="text-white/30 hover:text-white text-sm transition-colors">← Accueil</button>
        <h1 className="flex-1 text-base font-bold text-white/80">⚙️ Mes Quiz</h1>
        <${Btn} variant="primary" size="sm" onClick=${newQuiz}>+ Nouveau<//>
      </div>

      <!-- Content -->
      <div className="flex-1 px-4 py-5 max-w-2xl mx-auto w-full flex flex-col gap-4">

        ${alert && html`<${Alert} type=${alert.type} message=${alert.message} />`}

        ${loading && html`
          <div className="text-center py-10 text-white/30">Chargement…</div>
        `}

        ${!loading && adminQuizzes.length === 0 && html`
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-white/30 mb-4">Aucun quiz. Créez votre premier quiz !</p>
            <${Btn} variant="primary" onClick=${newQuiz}>+ Créer un quiz<//>
          </div>
        `}

        ${adminQuizzes.map(q => html`
          <${QuizItem}
            key=${q.id}
            quiz=${q}
            onEdit=${() => editQuiz(q.id)}
            onLaunch=${() => setLaunchQuiz(q)}
            onDelete=${() => deleteQuiz(q.id)}
          />
        `)}

      </div>

      <!-- Launch modal -->
      ${launchQuiz && html`
        <${LaunchModal}
          quiz=${launchQuiz}
          onClose=${() => setLaunchQuiz(null)}
          socket=${socket}
          setHostSession=${setHostSession}
          navigate=${navigate}
        />
      `}

    </div>
  `;
}
