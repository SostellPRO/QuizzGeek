import { useState, useEffect } from 'react';
import { html, emptyQuiz, randCode } from '../../utils.js';
import { useGame } from '../../contexts/GameContext.js';
import { Btn, Alert, Modal } from '../../components/ui.js';
import QuizEditor from './QuizEditor.js';

function LaunchModal({ quiz, onClose, socket, setHostSession, navigate }) {
  const [code, setCode] = useState(randCode());
  const [hostKey, setHostKey] = useState('demo-host');
  const [bots, setBots] = useState(3);
  const [alert, setAlert] = useState(null);
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
      setAlert({ type: 'error', message: 'Erreur reseau : ' + e.message });
    }
  };

  return html`
    <${Modal} show=${true} onClose=${onClose} title="Lancer le quiz">
      <div className="flex flex-col gap-4">
        <div className="rounded-lg app-panel p-3">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-white/38">Quiz selectionne</div>
          <div className="mt-1 font-extrabold text-white">${quiz?.title}</div>
        </div>
        ${alert && html`<${Alert} type=${alert.type} message=${alert.message} />`}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-white/50">Code de session</label>
            <input
              type="text"
              value=${code}
              onInput=${e => setCode(e.target.value.toUpperCase())}
              className="min-h-[48px] rounded-lg border border-white/10 bg-bg-input/90 px-4 py-2.5 text-center font-mono text-base font-bold tracking-widest text-white outline-none transition-colors focus:border-sky-400/70"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-white/50">Cle host</label>
            <input
              type="text"
              value=${hostKey}
              onInput=${e => setHostKey(e.target.value)}
              placeholder="demo-host"
              className="min-h-[48px] rounded-lg border border-white/10 bg-bg-input/90 px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-sky-400/70"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-teal-400/25 bg-teal-400/8 p-4">
            <div className="text-lg font-black text-white">Partie reelle</div>
            <p className="mt-1 min-h-[42px] text-sm text-white/46">Lance la session pour les joueurs connectes.</p>
            <div className="mt-4">
              <${Btn} variant="success" wide onClick=${() => launch(false)}>Lancer<//>
            </div>
          </div>
          <div className="rounded-lg border border-amber-400/25 bg-amber-400/8 p-4">
            <div className="text-lg font-black text-white">Mode test</div>
            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-white/42">Bots</label>
              <input
                type="number"
                value=${bots}
                onInput=${e => setBots(parseInt(e.target.value) || 0)}
                min="0"
                max="20"
                className="min-h-[36px] flex-1 rounded-lg border border-white/10 bg-bg-input/90 px-2 py-1.5 text-center font-mono text-sm text-white outline-none focus:border-sky-400/70"
              />
            </div>
            <div className="mt-4">
              <${Btn} variant="warning" wide onClick=${() => launch(true)}>Tester<//>
            </div>
          </div>
        </div>
      </div>
    <//>
  `;
}

function QuizItem({ quiz, onEdit, onLaunch, onDelete }) {
  const rounds = (quiz.rounds || []).length;
  const questions = (quiz.rounds || []).reduce((acc, r) => acc + (r.questions || []).length, 0);

  return html`
    <div className="group rounded-lg app-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300/35">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-black text-white">${quiz.title}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-white/42">
            <span className="rounded-full app-chip px-2.5 py-1">${rounds} manche(s)</span>
            <span className="rounded-full app-chip px-2.5 py-1">${questions} question(s)</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-shrink-0">
          <${Btn} variant="ghost" size="sm" onClick=${onEdit}>Editer<//>
          <${Btn} variant="success" size="sm" onClick=${onLaunch}>Lancer<//>
          <${Btn} variant="danger" size="sm" onClick=${onDelete}>Suppr.<//>
        </div>
      </div>
    </div>
  `;
}

export default function AdminView() {
  const { apiFetch, adminQuizzes, setAdminQuizzes, editingQuiz, setEditingQuiz, socket, setHostSession, navigate } = useGame();
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
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
    if (!confirm('Supprimer ce quiz definitivement ?')) return;
    try {
      await apiFetch(`/api/quizzes/${id}`, { method: 'DELETE' });
      await loadQuizzes();
    } catch {
      setAlert({ type: 'error', message: 'Erreur de suppression.' });
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

  if (editingQuiz) {
    return html`<${QuizEditor} onBack=${() => { setEditingQuiz(null); loadQuizzes(); }} />`;
  }

  return html`
    <div className="min-h-[100dvh] px-4 py-5 sm:px-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg app-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button onClick=${() => navigate('home')} className="mb-3 text-sm font-bold text-white/42 transition-colors hover:text-white">← Accueil</button>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">Studio</div>
            <h1 className="mt-1 font-display text-4xl font-black gradient-text">Mes quiz</h1>
            <p className="mt-2 text-sm text-white/48">Creez, testez et lancez vos experiences live.</p>
          </div>
          <${Btn} variant="primary" onClick=${newQuiz}>Nouveau quiz<//>
        </header>

        ${alert && html`<${Alert} type=${alert.type} message=${alert.message} />`}

        ${loading && html`
          <div className="rounded-lg app-panel py-12 text-center text-white/38">Chargement...</div>
        `}

        ${!loading && adminQuizzes.length === 0 && html`
          <div className="rounded-lg app-surface px-5 py-14 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg app-panel text-3xl">+</div>
            <h2 className="text-xl font-black text-white">Aucun quiz pour le moment</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/46">Demarrez avec un premier quiz, ajoutez vos manches, vos medias et vos transitions de jeu.</p>
            <div className="mt-5">
              <${Btn} variant="primary" onClick=${newQuiz}>Creer un quiz<//>
            </div>
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
