import { useState, useEffect, createContext, useContext } from "react";
import "./index.css";

const API = "https://taskflow-copy-production.up.railway.app";

// ─── AUTH CONTEXT ─────────────────────────────────────────
const AuthContext = createContext(null);

function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(u => { setUser(u); setLoading(false); })
        .catch(() => { setLoading(false); });
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = (tok, userData) => {
    localStorage.setItem("token", tok);
    setToken(tok);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── API HELPERS ──────────────────────────────────────────
function useApi() {
  const { token } = useAuth();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const get    = (url) => fetch(`${API}${url}`, { headers }).then(r => r.json());
  const post   = (url, body) => fetch(`${API}${url}`, { method: "POST", headers, body: JSON.stringify(body) }).then(r => r.json());
  const patch  = (url, body) => fetch(`${API}${url}`, { method: "PATCH", headers, body: JSON.stringify(body) }).then(r => r.json());
  const del    = (url) => fetch(`${API}${url}`, { method: "DELETE", headers });

  return { get, post, patch, del };
}

// ─── AUTH PAGES ───────────────────────────────────────────
function AuthPage() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handle = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError("");
  try {
    let res;
    if (mode === "register") {
      res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      const fd = new URLSearchParams();
      fd.append("username", form.username);
      fd.append("password", form.password);
      res = await fetch(`${API}/auth/login`, {
        method: "POST",
        body: fd,
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Błąd");
    login(data.access_token, data.user);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="logo-icon">✓</span>
          <span className="logo-text">TaskFlow</span>
        </div>
        <h1 className="auth-title">{mode === "login" ? "Zaloguj się" : "Utwórz konto"}</h1>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handle} className="auth-form">
          {mode === "register" && (
            <div className="field">
              <label>Email</label>
              <input type="email" placeholder="eryk@example.com" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
          )}
          <div className="field">
            <label>Nazwa użytkownika</label>
            <input type="text" placeholder="eryknowak" value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })} required />
          </div>
          <div className="field">
            <label>Hasło</label>
            <input type="password" placeholder="••••••••" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })} required />
          </div>
          <button className="btn btn-primary btn-full" disabled={loading}>
            {loading ? "Ładowanie..." : mode === "login" ? "Zaloguj" : "Zarejestruj się"}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "login" ? "Nie masz konta?" : "Masz już konto?"}
          <button className="link-btn" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? " Zarejestruj się" : " Zaloguj się"}
          </button>
        </p>
      </div>
    </div>
  );
}

// ─── TASK FORM ────────────────────────────────────────────
function TaskForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium" });
  const [loading, setLoading] = useState(false);
  const api = useApi();

  const handle = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    const task = await api.post("/tasks", form);
    onAdd(task);
    setForm({ title: "", description: "", priority: "medium" });
    setOpen(false);
    setLoading(false);
  };

  if (!open) return (
    <button className="btn-add-task" onClick={() => setOpen(true)}>
      <span>+</span> Nowe zadanie
    </button>
  );

  return (
    <div className="task-form-card">
      <form onSubmit={handle}>
        <input className="task-title-input" placeholder="Tytuł zadania..." autoFocus
          value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        <textarea className="task-desc-input" placeholder="Opis (opcjonalnie)..."
          value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        <div className="form-row">
          <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
            <option value="low">🟢 Niski priorytet</option>
            <option value="medium">🟡 Średni priorytet</option>
            <option value="high">🔴 Wysoki priorytet</option>
          </select>
          <div className="form-btns">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Anuluj</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "..." : "Dodaj"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ─── TASK CARD ────────────────────────────────────────────
const PRIORITY_LABEL = { low: "Niski", medium: "Średni", high: "Wysoki" };
const PRIORITY_COLOR = { low: "green", medium: "amber", high: "red" };

function TaskCard({ task, onUpdate, onDelete }) {
  const api = useApi();

  const toggle = async () => {
    const updated = await api.patch(`/tasks/${task.id}`, { completed: !task.completed });
    onUpdate(updated);
  };

  const remove = async () => {
    await api.del(`/tasks/${task.id}`);
    onDelete(task.id);
  };

  return (
    <div className={`task-card ${task.completed ? "completed" : ""}`}>
      <button className={`checkbox ${task.completed ? "checked" : ""}`} onClick={toggle}>
        {task.completed && "✓"}
      </button>
      <div className="task-content">
        <div className="task-title">{task.title}</div>
        {task.description && <div className="task-desc">{task.description}</div>}
        <div className="task-meta">
          <span className={`priority-badge priority-${PRIORITY_COLOR[task.priority]}`}>
            {PRIORITY_LABEL[task.priority]}
          </span>
          <span className="task-date">
            {new Date(task.created_at).toLocaleDateString("pl-PL")}
          </span>
        </div>
      </div>
      <button className="delete-btn" onClick={remove} title="Usuń">✕</button>
    </div>
  );
}

// ─── STATS BAR ────────────────────────────────────────────
function StatsBar({ stats }) {
  const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  return (
    <div className="stats-bar">
      <div className="stat"><span className="stat-num">{stats.total}</span><span className="stat-label">Wszystkich</span></div>
      <div className="stat"><span className="stat-num">{stats.completed}</span><span className="stat-label">Ukończonych</span></div>
      <div className="stat"><span className="stat-num">{stats.pending}</span><span className="stat-label">Do zrobienia</span></div>
      <div className="stat"><span className="stat-num stat-red">{stats.high}</span><span className="stat-label">Pilnych</span></div>
      <div className="stat-progress">
        <div className="progress-label">{pct}% ukończone</div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────
function Dashboard() {
  const { user, logout } = useAuth();
  const api = useApi();
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, high: 0 });
  const [filter, setFilter] = useState("all");

  const loadTasks = async () => {
    const data = await api.get("/tasks");
    if (Array.isArray(data)) setTasks(data);
  };

  const loadStats = async () => {
    const data = await api.get("/tasks/stats");
    if (data.total !== undefined) setStats(data);
  };

  useEffect(() => { loadTasks(); loadStats(); }, []);

  const onAdd = (task) => { setTasks(prev => [task, ...prev]); loadStats(); };
  const onUpdate = (updated) => { setTasks(prev => prev.map(t => t.id === updated.id ? updated : t)); loadStats(); };
  const onDelete = (id) => { setTasks(prev => prev.filter(t => t.id !== id)); loadStats(); };

  const filtered = tasks.filter(t => {
    if (filter === "active") return !t.completed;
    if (filter === "done") return t.completed;
    if (filter === "high") return t.priority === "high" && !t.completed;
    return true;
  });

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="logo-icon">✓</span>
          <span className="logo-text">TaskFlow</span>
        </div>
        <div className="header-right">
          <span className="user-name">Cześć, {user?.username}!</span>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Wyloguj</button>
        </div>
      </header>

      <main className="main">
        <StatsBar stats={stats} />

        <div className="filters">
          {[["all","Wszystkie"],["active","Aktywne"],["done","Ukończone"],["high","Pilne 🔴"]].map(([val, label]) => (
            <button key={val} className={`filter-btn ${filter === val ? "active" : ""}`}
              onClick={() => setFilter(val)}>{label}</button>
          ))}
        </div>

        <TaskForm onAdd={onAdd} />

        <div className="task-list">
          {filtered.length === 0 && (
            <div className="empty">
              <div className="empty-icon">📋</div>
              <div>Brak zadań w tej kategorii</div>
            </div>
          )}
          {filtered.map(task => (
            <TaskCard key={task.id} task={task} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      </main>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

function AppInner() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Ładowanie...</div>;
  return user ? <Dashboard /> : <AuthPage />;
}

export default App;
