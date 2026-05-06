import React, { useState, useEffect, useCallback } from 'react';
import '../god.css';

// ── API ──────────────────────────────────────────────────────────────────────
const BASE = '/api/god';

function getToken() { return sessionStorage.getItem('god_token'); }
function setToken(t: string) { sessionStorage.setItem('god_token', t); }
function clearToken() { sessionStorage.removeItem('god_token'); sessionStorage.removeItem('god_user'); }

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders(), ...opts });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro na requisição');
  return data as T;
}

// ── Types ────────────────────────────────────────────────────────────────────
interface GodUser { id: string; email: string; nome: string; ativo: boolean; last_login: string | null }
interface Client { id: string; subdomain: string; nome: string; ativo: boolean; created_at: string }
interface AuditLog { id: number; god_email: string; action: string; target_type: string | null; target_label: string | null; ip: string | null; created_at: string }
interface Overview { totalClients: number; totalUsers: number; totalRegistros: number; registrosHoje: number; totalGodUsers: number }

// ─────────────────────────────────────────────────────────────────────────────
// GOD LOGIN
// ─────────────────────────────────────────────────────────────────────────────
function GodLogin({ onLogin }: { onLogin: (god: GodUser, token: string) => void }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await api<{ token: string; god: GodUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, senha }),
      });
      setToken(data.token);
      onLogin(data.god, data.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally { setLoading(false); }
  }

  return (
    <div className="god-root">
      <div className="god-login-wrap">
        <div className="god-login-card">
          <div className="god-login-logo">
            <div className="god-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              GOD MODE
            </div>
            <div className="god-login-title">Super Admin</div>
            <div className="god-login-sub">Acesso restrito — todas as ações são auditadas</div>
          </div>

          {error && <div className="god-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="god-form-group">
              <label className="god-label">Email</label>
              <input className="god-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="god@flowbase.tech" required autoComplete="email" />
            </div>
            <div className="god-form-group">
              <label className="god-label">Senha</label>
              <div className="god-input-wrap">
                <input className="god-input" type={showPwd ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••••" required autoComplete="current-password" />
                <button type="button" className="god-eye-btn" onClick={() => setShowPwd(v => !v)}>
                  {showPwd
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>
            <button className="god-btn" type="submit" disabled={loading}>
              {loading ? 'Autenticando…' : 'Entrar no GOD Mode'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW TAB
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Overview>('/overview').then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  const stats = data ? [
    { label: 'Clientes Ativos', value: data.totalClients, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> },
    { label: 'Usuários', value: data.totalUsers, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> },
    { label: 'Registros Total', value: data.totalRegistros, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
    { label: 'Registros Hoje', value: data.registrosHoje, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
    { label: 'GOD Users', value: data.totalGodUsers, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
  ] : [];

  if (loading) return <div className="god-empty">Carregando…</div>;

  return (
    <div>
      <div className="god-stats-grid">
        {stats.map(s => (
          <div className="god-stat-card" key={s.label}>
            <div className="god-stat-icon">{s.icon}</div>
            <div>
              <div className="god-stat-value">{s.value.toLocaleString('pt-BR')}</div>
              <div className="god-stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="god-card">
        <div className="god-card-body">
          <p style={{ color: 'var(--god-muted)', fontSize: '0.85rem', margin: 0 }}>
            Sistema operacional. Todas as ações realizadas neste painel são registradas no log de auditoria.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTS TAB
// ─────────────────────────────────────────────────────────────────────────────
function ClientsTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newSub, setNewSub] = useState('');
  const [newNome, setNewNome] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setClients(await api<Client[]>('/clients')); } catch (e: unknown) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setCreating(true);
    try {
      await api('/clients', { method: 'POST', body: JSON.stringify({ subdomain: newSub.toLowerCase(), nome: newNome }) });
      setShowCreate(false); setNewSub(''); setNewNome('');
      await load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erro'); }
    finally { setCreating(false); }
  }

  async function toggleAtivo(c: Client) {
    await api(`/clients/${c.id}`, { method: 'PATCH', body: JSON.stringify({ ativo: !c.ativo }) });
    await load();
  }

  async function handleDelete(id: string) {
    await api(`/clients/${id}`, { method: 'DELETE' });
    setDeleteId(null);
    await load();
  }

  return (
    <div>
      <div className="god-section-header">
        <span className="god-section-title">Clientes ({clients.length})</span>
        <button className="god-btn-sm god-btn-sm--primary" onClick={() => { setShowCreate(true); setError(''); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo cliente
        </button>
      </div>

      <div className="god-card">
        <div className="god-table-wrap">
          <table className="god-table">
            <thead>
              <tr>
                <th>Subdomínio</th>
                <th>Nome</th>
                <th>Status</th>
                <th>Criado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="god-empty">Carregando…</td></tr>
              )}
              {!loading && clients.length === 0 && (
                <tr><td colSpan={5} className="god-empty">Nenhum cliente cadastrado.</td></tr>
              )}
              {clients.map(c => (
                <tr key={c.id}>
                  <td>
                    <code style={{ color: 'var(--god-accent)', fontSize: '0.82rem' }}>{c.subdomain}.flowbase.tech</code>
                  </td>
                  <td style={{ fontWeight: 600 }}>{c.nome}</td>
                  <td><span className={`god-pill ${c.ativo ? 'god-pill--active' : 'god-pill--inactive'}`}>{c.ativo ? 'Ativo' : 'Inativo'}</span></td>
                  <td style={{ color: 'var(--god-muted)', fontSize: '0.8rem' }}>{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className={`god-btn-sm ${c.ativo ? 'god-btn-sm--ghost' : 'god-btn-sm--success'}`} onClick={() => toggleAtivo(c)}>
                        {c.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                      <button className="god-btn-sm god-btn-sm--danger" onClick={() => setDeleteId(c.id)}>
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal criar */}
      {showCreate && (
        <div className="god-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="god-modal" onClick={e => e.stopPropagation()}>
            <h3>Novo Cliente</h3>
            {error && <div className="god-error">{error}</div>}
            <form onSubmit={handleCreate}>
              <div className="god-form-group">
                <label className="god-label">Subdomínio</label>
                <input className="god-input" placeholder="ex: empresa" value={newSub} onChange={e => setNewSub(e.target.value)} required pattern="[a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9]" />
                <div style={{ fontSize: '0.75rem', color: 'var(--god-muted)', marginTop: 4 }}>{newSub && `${newSub.toLowerCase()}.flowbase.tech`}</div>
              </div>
              <div className="god-form-group">
                <label className="god-label">Nome da empresa</label>
                <input className="god-input" placeholder="Nome do cliente" value={newNome} onChange={e => setNewNome(e.target.value)} required />
              </div>
              <div className="god-modal-actions">
                <button type="button" className="god-btn-sm god-btn-sm--ghost" onClick={() => setShowCreate(false)}>Cancelar</button>
                <button type="submit" className="god-btn-sm god-btn-sm--primary" disabled={creating}>{creating ? 'Criando…' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmar exclusão */}
      {deleteId && (
        <div className="god-modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="god-modal" onClick={e => e.stopPropagation()}>
            <h3>Confirmar exclusão</h3>
            <p style={{ color: 'var(--god-muted)', fontSize: '0.88rem' }}>
              Tem certeza? Esta ação não pode ser desfeita e será registrada no audit log.
            </p>
            <div className="god-modal-actions">
              <button className="god-btn-sm god-btn-sm--ghost" onClick={() => setDeleteId(null)}>Cancelar</button>
              <button className="god-btn-sm god-btn-sm--danger" onClick={() => handleDelete(deleteId)}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USERS TAB
// ─────────────────────────────────────────────────────────────────────────────
interface UserRow { id: string; nome: string; pin: string; ativo: boolean; horas_diarias: number; created_at: string }

function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    api<UserRow[]>(`/users${q}`).then(setUsers).catch(console.error).finally(() => setLoading(false));
  }, [search]);

  return (
    <div>
      <div className="god-section-header">
        <span className="god-section-title">Usuários ({users.length})</span>
        <input
          className="god-search"
          placeholder="Buscar por nome…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="god-card">
        <div className="god-table-wrap">
          <table className="god-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>PIN</th>
                <th>Jornada</th>
                <th>Status</th>
                <th>Cadastrado</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="god-empty">Carregando…</td></tr>}
              {!loading && users.length === 0 && <tr><td colSpan={5} className="god-empty">Nenhum usuário encontrado.</td></tr>}
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.nome}</td>
                  <td><code style={{ fontSize: '0.8rem', color: 'var(--god-muted)' }}>••••</code></td>
                  <td style={{ color: 'var(--god-muted)' }}>{Math.floor(u.horas_diarias / 60)}h{u.horas_diarias % 60 > 0 ? `${u.horas_diarias % 60}m` : ''}</td>
                  <td><span className={`god-pill ${u.ativo ? 'god-pill--active' : 'god-pill--inactive'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
                  <td style={{ color: 'var(--god-muted)', fontSize: '0.8rem' }}>{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT TAB
// ─────────────────────────────────────────────────────────────────────────────
function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ logs: AuditLog[]; total: number }>('/audit?limit=100')
      .then(d => { setLogs(d.logs); setTotal(d.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  return (
    <div>
      <div className="god-section-header">
        <span className="god-section-title">Audit Log ({total} registros)</span>
      </div>

      <div className="god-card">
        <div className="god-table-wrap">
          <table className="god-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>GOD User</th>
                <th>Ação</th>
                <th>Alvo</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="god-empty">Carregando…</td></tr>}
              {!loading && logs.length === 0 && <tr><td colSpan={5} className="god-empty">Nenhuma ação registrada.</td></tr>}
              {logs.map(l => (
                <tr key={l.id}>
                  <td style={{ color: 'var(--god-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{formatDate(l.created_at)}</td>
                  <td style={{ fontSize: '0.82rem' }}>{l.god_email}</td>
                  <td><div className="god-audit-action">{l.action}</div></td>
                  <td>
                    {l.target_label
                      ? <div><span style={{ fontSize: '0.8rem' }}>{l.target_label}</span>{l.target_type && <div className="god-audit-meta">{l.target_type}</div>}</div>
                      : <span style={{ color: 'var(--god-muted)' }}>—</span>
                    }
                  </td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--god-muted)' }}>{l.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GOD DASHBOARD (layout principal)
// ─────────────────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'clients' | 'users' | 'audit';

function GodDashboard({ god, onLogout }: { god: GodUser; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');

  async function handleLogout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignora */ }
    clearToken();
    onLogout();
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Visão Geral', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
    { id: 'clients', label: 'Clientes', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> },
    { id: 'users', label: 'Usuários', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> },
    { id: 'audit', label: 'Audit Log', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
  ];

  return (
    <div className="god-root">
      <div className="god-layout">
        {/* Header */}
        <header className="god-header">
          <div className="god-header-brand">
            <div className="god-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              GOD
            </div>
            Flowbase Super Admin
          </div>
          <div className="god-header-spacer" />
          <span className="god-header-user">{god.nome} · {god.email}</span>
          <button className="god-logout-btn" onClick={handleLogout}>Sair</button>
        </header>

        {/* Tabs */}
        <nav className="god-tabs">
          {tabs.map(t => (
            <button key={t.id} className={`god-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.icon}{t.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main className="god-main">
          {tab === 'overview' && <OverviewTab />}
          {tab === 'clients'  && <ClientsTab />}
          {tab === 'users'    && <UsersTab />}
          {tab === 'audit'    && <AuditTab />}
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GOD APP root — gerencia auth state
// ─────────────────────────────────────────────────────────────────────────────
export default function GodApp() {
  const [god, setGod] = useState<GodUser | null>(() => {
    const token = getToken();
    if (!token) return null;
    // Valida sessão existente
    return null; // será validado no useEffect
  });
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!getToken()) { setChecking(false); return; }
    api<{ god: GodUser }>('/auth/me')
      .then(d => setGod(d.god))
      .catch(() => clearToken())
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="god-root" style={{ alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
        <div style={{ color: 'var(--god-muted)' }}>Verificando sessão…</div>
      </div>
    );
  }

  if (!god) {
    return <GodLogin onLogin={(g) => setGod(g)} />;
  }

  return <GodDashboard god={god} onLogout={() => setGod(null)} />;
}
