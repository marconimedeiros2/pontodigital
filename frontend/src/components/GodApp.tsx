import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../god.css';

// ── API helpers ───────────────────────────────────────────────────────────────
const BASE = '/api/god';
const getToken = () => sessionStorage.getItem('god_token');
const setToken = (t: string) => sessionStorage.setItem('god_token', t);
const clearToken = () => { sessionStorage.removeItem('god_token'); };

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

function fmt(iso: string) { return new Date(iso).toLocaleDateString('pt-BR'); }

// ── Types ─────────────────────────────────────────────────────────────────────
interface GodUser   { id: string; email: string; nome: string; ativo: boolean; last_login: string | null }
interface Client    { id: string; subdomain: string; nome: string; ativo: boolean; created_at: string }
interface UserRow   { id: string; nome: string; pin: string; ativo: boolean; horas_diarias: number; intervalo: number; created_at: string }
interface ContRow   { id: number; email: string; nome: string; ativo: boolean; created_at: string }
interface Overview  { totalClients: number; totalUsers: number; totalRegistros: number; registrosHoje: number; totalGodUsers: number; totalContadores: number }
interface RegistroGod {
  id: number; data: string; hora_inicial: string | null; inicio_intervalo: string | null;
  fim_intervalo: string | null; hora_final: string | null; horas_diarias: number | null;
  extra: boolean | null; oculto: boolean;
  usuarios: { id: string; nome: string; pin: string } | null;
}

// ── Shared: SVG icons ─────────────────────────────────────────────────────────
const IconEye     = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconEyeOff  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const IconPlus    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconEdit    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IconTrash   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>;
const IconDownload= () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;

// ── Reusable Modal ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="god-modal-overlay" onClick={onClose}>
      <div className="god-modal" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

// ── GOD LOGIN ─────────────────────────────────────────────────────────────────
function GodLogin({ onLogin }: { onLogin: (god: GodUser) => void }) {
  const [email, setEmail]   = useState('');
  const [senha, setSenha]   = useState('');
  const [show, setShow]     = useState(false);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const d = await api<{ token: string; god: GodUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
      setToken(d.token); onLogin(d.god);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erro'); }
    finally { setLoading(false); }
  }

  return (
    <div className="god-root">
      <div className="god-login-wrap">
        <div className="god-login-card">
          <div className="god-login-logo">
            <div className="god-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> GOD MODE</div>
            <div className="god-login-title">Super Admin</div>
            <div className="god-login-sub">Acesso restrito ao sistema global</div>
          </div>
          {error && <div className="god-error">{error}</div>}
          <form onSubmit={submit}>
            <div className="god-form-group">
              <label className="god-label">Email</label>
              <input className="god-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="god-form-group">
              <label className="god-label">Senha</label>
              <div className="god-input-wrap">
                <input className="god-input" type={show ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} required autoComplete="current-password" />
                <button type="button" className="god-eye-btn" onClick={() => setShow(v => !v)}>{show ? <IconEyeOff /> : <IconEye />}</button>
              </div>
            </div>
            <button className="god-btn" disabled={loading}>{loading ? 'Autenticando…' : 'Entrar no GOD Mode'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────────
function OverviewTab() {
  const [data, setData] = useState<Overview | null>(null);
  useEffect(() => { api<Overview>('/overview').then(setData).catch(console.error); }, []);

  const cards = data ? [
    { label: 'Clientes',       value: data.totalClients,    icon: '🏢' },
    { label: 'Usuários Ativos',value: data.totalUsers,      icon: '👤' },
    { label: 'Contadores',     value: data.totalContadores, icon: '🧮' },
    { label: 'Registros Total',value: data.totalRegistros,  icon: '📋' },
    { label: 'Registros Hoje', value: data.registrosHoje,   icon: '📅' },
    { label: 'GOD Users',      value: data.totalGodUsers,   icon: '⭐' },
  ] : [];

  return (
    <div>
      <div className="god-stats-grid">
        {!data ? <div className="god-empty">Carregando…</div> : cards.map(c => (
          <div className="god-stat-card" key={c.label}>
            <div className="god-stat-icon" style={{ fontSize: '1.3rem' }}>{c.icon}</div>
            <div>
              <div className="god-stat-value">{c.value.toLocaleString('pt-BR')}</div>
              <div className="god-stat-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CLIENTS ───────────────────────────────────────────────────────────────────
function ClientsTab() {
  const [clients, setClients]   = useState<Client[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);

  // form state
  const [fNome, setFNome]       = useState('');
  const [fSub, setFSub]         = useState('');
  const [fAtivo, setFAtivo]     = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setClients(await api<Client[]>('/clients')); } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openEdit(c: Client) { setEditing(c); setFNome(c.nome); setFSub(c.subdomain); setFAtivo(c.ativo); setError(''); }
  function openCreate() { setCreating(true); setFNome(''); setFSub(''); setFAtivo(true); setError(''); }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api(`/clients/${editing!.id}`, { method: 'PATCH', body: JSON.stringify({ nome: fNome, subdomain: fSub.toLowerCase(), ativo: fAtivo }) });
      setEditing(null); await load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erro'); }
    finally { setSaving(false); }
  }

  async function saveCreate(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api('/clients', { method: 'POST', body: JSON.stringify({ nome: fNome, subdomain: fSub.toLowerCase() }) });
      setCreating(false); await load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erro'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    try { await api(`/clients/${id}`, { method: 'DELETE' }); setDeleteId(null); await load(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Erro ao excluir'); }
  }

  return (
    <div>
      <div className="god-section-header">
        <span className="god-section-title">Clientes ({clients.length})</span>
        <button className="god-btn-sm god-btn-sm--primary" onClick={openCreate}><IconPlus /> Novo cliente</button>
      </div>

      <div className="god-card">
        <div className="god-table-wrap">
          <table className="god-table">
            <thead><tr><th>Subdomínio</th><th>Nome</th><th>Status</th><th>Criado em</th><th>Ações</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="god-empty">Carregando…</td></tr>}
              {!loading && clients.length === 0 && <tr><td colSpan={5} className="god-empty">Nenhum cliente.</td></tr>}
              {clients.map(c => (
                <tr key={c.id}>
                  <td><code style={{ color: 'var(--god-accent)', fontSize: '0.82rem' }}>{c.subdomain}.flowbase.tech</code></td>
                  <td style={{ fontWeight: 600 }}>{c.nome}</td>
                  <td><span className={`god-pill ${c.ativo ? 'god-pill--active' : 'god-pill--inactive'}`}>{c.ativo ? 'Ativo' : 'Inativo'}</span></td>
                  <td style={{ color: 'var(--god-muted)', fontSize: '0.8rem' }}>{fmt(c.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="god-btn-sm god-btn-sm--ghost" onClick={() => openEdit(c)}><IconEdit /> Editar</button>
                      <button className="god-btn-sm god-btn-sm--danger" onClick={() => setDeleteId(c.id)}><IconTrash /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal editar */}
      {editing && (
        <Modal title="Editar Cliente" onClose={() => setEditing(null)}>
          {error && <div className="god-error">{error}</div>}
          <form onSubmit={saveEdit}>
            <div className="god-form-group">
              <label className="god-label">Nome da empresa</label>
              <input className="god-input" value={fNome} onChange={e => setFNome(e.target.value)} required />
            </div>
            <div className="god-form-group">
              <label className="god-label">Subdomínio</label>
              <input className="god-input" value={fSub} onChange={e => setFSub(e.target.value)} required pattern="[a-z0-9][a-z0-9-]*" />
              {fSub && <div style={{ fontSize: '0.74rem', color: 'var(--god-muted)', marginTop: 4 }}>{fSub}.flowbase.tech</div>}
            </div>
            <div className="god-form-group">
              <label className="god-label">Status</label>
              <select className="god-input" value={fAtivo ? 'true' : 'false'} onChange={e => setFAtivo(e.target.value === 'true')}>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </div>
            <div className="god-modal-actions">
              <button type="button" className="god-btn-sm god-btn-sm--ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button type="submit" className="god-btn-sm god-btn-sm--primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal criar */}
      {creating && (
        <Modal title="Novo Cliente" onClose={() => setCreating(false)}>
          {error && <div className="god-error">{error}</div>}
          <form onSubmit={saveCreate}>
            <div className="god-form-group">
              <label className="god-label">Nome da empresa</label>
              <input className="god-input" value={fNome} onChange={e => setFNome(e.target.value)} required placeholder="Ex: Empresa ABC" />
            </div>
            <div className="god-form-group">
              <label className="god-label">Subdomínio</label>
              <input className="god-input" value={fSub} onChange={e => setFSub(e.target.value)} required placeholder="ex: empresa" pattern="[a-z0-9][a-z0-9-]*" />
              {fSub && <div style={{ fontSize: '0.74rem', color: 'var(--god-muted)', marginTop: 4 }}>{fSub.toLowerCase()}.flowbase.tech</div>}
            </div>
            <div className="god-modal-actions">
              <button type="button" className="god-btn-sm god-btn-sm--ghost" onClick={() => setCreating(false)}>Cancelar</button>
              <button type="submit" className="god-btn-sm god-btn-sm--primary" disabled={saving}>{saving ? 'Criando…' : 'Criar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal delete */}
      {deleteId && (
        <Modal title="Confirmar exclusão" onClose={() => setDeleteId(null)}>
          <p style={{ color: 'var(--god-muted)', fontSize: '0.88rem' }}>Tem certeza? Esta ação não pode ser desfeita.</p>
          <div className="god-modal-actions">
            <button className="god-btn-sm god-btn-sm--ghost" onClick={() => setDeleteId(null)}>Cancelar</button>
            <button className="god-btn-sm god-btn-sm--danger" onClick={() => handleDelete(deleteId!)}>Excluir</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── USERS ─────────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers]           = useState<UserRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterAtivo, setFilterAtivo] = useState('');
  const [filterDateIni, setFilterDateIni] = useState('');
  const [filterDateFim, setFilterDateFim] = useState('');
  const [showPin, setShowPin]       = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterAtivo) params.set('ativo', filterAtivo);
    if (filterDateIni) params.set('created_after', filterDateIni);
    if (filterDateFim) params.set('created_before', filterDateFim);

    api<UserRow[]>(`/users?${params}`)
      .then(setUsers).catch(console.error).finally(() => setLoading(false));
  }, [search, filterAtivo, filterDateIni, filterDateFim]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, 300);
  }, [load]);

  function jornada(min: number) { return `${Math.floor(min / 60)}h${min % 60 > 0 ? `${min % 60}m` : ''}`; }

  return (
    <div>
      {/* Filtros */}
      <div className="god-filters-row">
        <input className="god-search" placeholder="Buscar por nome…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="god-input god-input--sm" value={filterAtivo} onChange={e => setFilterAtivo(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
        <input type="date" className="god-input god-input--sm" value={filterDateIni} onChange={e => setFilterDateIni(e.target.value)} placeholder="De" title="Cadastrado de" />
        <input type="date" className="god-input god-input--sm" value={filterDateFim} onChange={e => setFilterDateFim(e.target.value)} placeholder="Até" title="Cadastrado até" />
        <button className={`god-btn-sm ${showPin ? 'god-btn-sm--primary' : 'god-btn-sm--ghost'}`} onClick={() => setShowPin(v => !v)}>
          {showPin ? <IconEyeOff /> : <IconEye />} {showPin ? 'Ocultar PINs' : 'Mostrar PINs'}
        </button>
      </div>

      <div className="god-section-header" style={{ marginTop: 14 }}>
        <span className="god-section-title">{loading ? 'Carregando…' : `${users.length} usuário${users.length !== 1 ? 's' : ''}`}</span>
      </div>

      <div className="god-card">
        <div className="god-table-wrap">
          <table className="god-table">
            <thead><tr><th>Nome</th><th>PIN</th><th>Jornada</th><th>Intervalo</th><th>Status</th><th>Cadastrado</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="god-empty">Carregando…</td></tr>}
              {!loading && users.length === 0 && <tr><td colSpan={6} className="god-empty">Nenhum usuário encontrado.</td></tr>}
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.nome}</td>
                  <td>
                    <code style={{ fontSize: '0.85rem', color: 'var(--god-accent)', letterSpacing: showPin ? 'normal' : '0.15em' }}>
                      {showPin ? u.pin : '••••'}
                    </code>
                  </td>
                  <td style={{ color: 'var(--god-muted)' }}>{jornada(u.horas_diarias)}</td>
                  <td style={{ color: 'var(--god-muted)' }}>{u.intervalo}min</td>
                  <td><span className={`god-pill ${u.ativo ? 'god-pill--active' : 'god-pill--inactive'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
                  <td style={{ color: 'var(--god-muted)', fontSize: '0.8rem' }}>{fmt(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── RELATÓRIOS ────────────────────────────────────────────────────────────────
function RelatoriosTab() {
  const [rows, setRows]           = useState<RegistroGod[]>([]);
  const [loading, setLoading]     = useState(false);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const perPage = 50;

  const today = new Date().toISOString().split('T')[0];
  const [dataIni, setDataIni]     = useState(today);
  const [dataFim, setDataFim]     = useState(today);
  const [search, setSearch]       = useState('');

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), per_page: String(perPage) });
    if (dataIni) params.set('data_ini', dataIni);
    if (dataFim) params.set('data_fim', dataFim);
    if (search)  params.set('search', search);
    try {
      const d = await api<{ registros: RegistroGod[]; total: number }>(`/registros?${params}`);
      setRows(d.registros); setTotal(d.total); setPage(p);
    } catch (e: unknown) { console.error(e); }
    finally { setLoading(false); }
  }, [dataIni, dataFim, search]);

  // CSV download com auth header via fetch
  async function downloadCsv() {
    const params = new URLSearchParams({ format: 'csv' });
    if (dataIni) params.set('data_ini', dataIni);
    if (dataFim) params.set('data_fim', dataFim);
    if (search)  params.set('search', search);
    const res = await fetch(`${BASE}/registros?${params}`, { headers: { Authorization: `Bearer ${getToken() ?? ''}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'registros-god.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function mins(m: number | null) {
    if (m == null) return '—';
    const h = Math.floor(m / 60), mm = m % 60;
    return `${h}h${mm > 0 ? `${mm}m` : ''}`;
  }

  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      {/* Filtros */}
      <div className="god-filters-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="date" className="god-input god-input--sm" value={dataIni} onChange={e => setDataIni(e.target.value)} />
          <span style={{ color: 'var(--god-muted)', fontSize: '0.8rem' }}>até</span>
          <input type="date" className="god-input god-input--sm" value={dataFim} onChange={e => setDataFim(e.target.value)} />
        </div>
        <input className="god-search" placeholder="Buscar por nome…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="god-btn-sm god-btn-sm--primary" onClick={() => load(1)} disabled={loading}>
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
        <button className="god-btn-sm god-btn-sm--ghost" onClick={downloadCsv} title="Exportar CSV">
          <IconDownload /> CSV
        </button>
      </div>

      <div className="god-section-header" style={{ marginTop: 14 }}>
        <span className="god-section-title">{total.toLocaleString('pt-BR')} registro{total !== 1 ? 's' : ''}</span>
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="god-btn-sm god-btn-sm--ghost" disabled={page <= 1} onClick={() => load(page - 1)}>‹</button>
            <span style={{ fontSize: '0.82rem', color: 'var(--god-muted)' }}>Pág. {page}/{totalPages}</span>
            <button className="god-btn-sm god-btn-sm--ghost" disabled={page >= totalPages} onClick={() => load(page + 1)}>›</button>
          </div>
        )}
      </div>

      <div className="god-card">
        <div className="god-table-wrap">
          <table className="god-table">
            <thead>
              <tr>
                <th>Data</th><th>Usuário</th><th>PIN</th>
                <th>Entrada</th><th>Ini. Int.</th><th>Fim Int.</th><th>Saída</th>
                <th>Trabalhado</th><th>Extra</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="god-empty">Buscando…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={9} className="god-empty">Nenhum registro. Clique em Buscar.</td></tr>}
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--god-muted)', fontSize: '0.82rem' }}>{r.data}</td>
                  <td style={{ fontWeight: 600 }}>{r.usuarios?.nome ?? '—'}</td>
                  <td><code style={{ fontSize: '0.8rem', color: 'var(--god-accent)' }}>{r.usuarios?.pin ?? '—'}</code></td>
                  <td>{r.hora_inicial ?? '—'}</td>
                  <td>{r.inicio_intervalo ?? '—'}</td>
                  <td>{r.fim_intervalo ?? '—'}</td>
                  <td>{r.hora_final ?? '—'}</td>
                  <td>{mins(r.horas_diarias)}</td>
                  <td>{r.extra ? <span className="god-pill god-pill--active">Sim</span> : <span style={{ color: 'var(--god-muted)' }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── CONTADORES ────────────────────────────────────────────────────────────────
function ContadoresTab() {
  const [contadores, setContadores] = useState<ContRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterAtivo, setFilterAtivo] = useState('');
  const [editing, setEditing]       = useState<ContRow | null>(null);
  const [creating, setCreating]     = useState(false);
  const [deleteId, setDeleteId]     = useState<number | null>(null);
  const [error, setError]           = useState('');
  const [saving, setSaving]         = useState(false);

  // form
  const [fEmail, setFEmail] = useState('');
  const [fNome, setFNome]   = useState('');
  const [fAtivo, setFAtivo] = useState(true);
  const [fSenha, setFSenha] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterAtivo) params.set('ativo', filterAtivo);
    try { setContadores(await api<ContRow[]>(`/contadores?${params}`)); } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [search, filterAtivo]);

  useEffect(() => { load(); }, [load]);

  function openEdit(c: ContRow) { setEditing(c); setFEmail(c.email); setFNome(c.nome); setFAtivo(c.ativo); setFSenha(''); setError(''); }
  function openCreate() { setCreating(true); setFEmail(''); setFNome(''); setFAtivo(true); setFSenha(''); setError(''); }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const body: Record<string, unknown> = { email: fEmail, nome: fNome, ativo: fAtivo };
      if (fSenha) body.senha = fSenha;
      await api(`/contadores/${editing!.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setEditing(null); await load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erro'); }
    finally { setSaving(false); }
  }

  async function saveCreate(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api('/contadores', { method: 'POST', body: JSON.stringify({ email: fEmail, nome: fNome, senha: fSenha }) });
      setCreating(false); await load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erro'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    try { await api(`/contadores/${id}`, { method: 'DELETE' }); setDeleteId(null); await load(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Erro'); }
  }

  const PwdField = ({ label, required }: { label: string; required?: boolean }) => (
    <div className="god-form-group">
      <label className="god-label">{label}{!required && <span style={{ color: 'var(--god-muted)', marginLeft: 4, fontWeight: 400 }}>(deixe vazio para não alterar)</span>}</label>
      <div className="god-input-wrap">
        <input className="god-input" type={showPwd ? 'text' : 'password'} value={fSenha} onChange={e => setFSenha(e.target.value)} required={required} />
        <button type="button" className="god-eye-btn" onClick={() => setShowPwd(v => !v)}>{showPwd ? <IconEyeOff /> : <IconEye />}</button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="god-filters-row">
        <input className="god-search" placeholder="Buscar por nome ou email…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="god-input god-input--sm" value={filterAtivo} onChange={e => setFilterAtivo(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
        <button className="god-btn-sm god-btn-sm--primary" onClick={openCreate}><IconPlus /> Novo contador</button>
      </div>

      <div className="god-section-header" style={{ marginTop: 14 }}>
        <span className="god-section-title">Contadores ({contadores.length})</span>
      </div>

      <div className="god-card">
        <div className="god-table-wrap">
          <table className="god-table">
            <thead><tr><th>Nome</th><th>Email</th><th>Status</th><th>Cadastrado</th><th>Ações</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="god-empty">Carregando…</td></tr>}
              {!loading && contadores.length === 0 && <tr><td colSpan={5} className="god-empty">Nenhum contador encontrado.</td></tr>}
              {contadores.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.nome}</td>
                  <td style={{ color: 'var(--god-muted)', fontSize: '0.85rem' }}>{c.email}</td>
                  <td><span className={`god-pill ${c.ativo ? 'god-pill--active' : 'god-pill--inactive'}`}>{c.ativo ? 'Ativo' : 'Inativo'}</span></td>
                  <td style={{ color: 'var(--god-muted)', fontSize: '0.8rem' }}>{fmt(c.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="god-btn-sm god-btn-sm--ghost" onClick={() => openEdit(c)}><IconEdit /> Editar</button>
                      <button className="god-btn-sm god-btn-sm--danger" onClick={() => setDeleteId(c.id)}><IconTrash /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <Modal title="Editar Contador" onClose={() => setEditing(null)}>
          {error && <div className="god-error">{error}</div>}
          <form onSubmit={saveEdit}>
            <div className="god-form-group"><label className="god-label">Nome</label><input className="god-input" value={fNome} onChange={e => setFNome(e.target.value)} required /></div>
            <div className="god-form-group"><label className="god-label">Email</label><input className="god-input" type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} required /></div>
            <div className="god-form-group">
              <label className="god-label">Status</label>
              <select className="god-input" value={fAtivo ? 'true' : 'false'} onChange={e => setFAtivo(e.target.value === 'true')}>
                <option value="true">Ativo</option><option value="false">Inativo</option>
              </select>
            </div>
            <PwdField label="Nova senha" />
            <div className="god-modal-actions">
              <button type="button" className="god-btn-sm god-btn-sm--ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button type="submit" className="god-btn-sm god-btn-sm--primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {creating && (
        <Modal title="Novo Contador" onClose={() => setCreating(false)}>
          {error && <div className="god-error">{error}</div>}
          <form onSubmit={saveCreate}>
            <div className="god-form-group"><label className="god-label">Nome</label><input className="god-input" value={fNome} onChange={e => setFNome(e.target.value)} required placeholder="Nome completo" /></div>
            <div className="god-form-group"><label className="god-label">Email</label><input className="god-input" type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} required placeholder="email@exemplo.com" /></div>
            <PwdField label="Senha" required />
            <div className="god-modal-actions">
              <button type="button" className="god-btn-sm god-btn-sm--ghost" onClick={() => setCreating(false)}>Cancelar</button>
              <button type="submit" className="god-btn-sm god-btn-sm--primary" disabled={saving}>{saving ? 'Criando…' : 'Criar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {deleteId !== null && (
        <Modal title="Confirmar exclusão" onClose={() => setDeleteId(null)}>
          <p style={{ color: 'var(--god-muted)', fontSize: '0.88rem' }}>Tem certeza? Esta ação não pode ser desfeita.</p>
          <div className="god-modal-actions">
            <button className="god-btn-sm god-btn-sm--ghost" onClick={() => setDeleteId(null)}>Cancelar</button>
            <button className="god-btn-sm god-btn-sm--danger" onClick={() => handleDelete(deleteId!)}>Excluir</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── CONFIGURAÇÕES ─────────────────────────────────────────────────────────────
function ConfiguracoesTab() {
  const [hasGlobal, setHasGlobal]   = useState<boolean | null>(null);
  const [updatedAt, setUpdatedAt]   = useState<string | null>(null);
  const [novaSenha, setNovaSenha]   = useState('');
  const [confirma, setConfirma]     = useState('');
  const [showPwd, setShowPwd]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [removing, setRemoving]     = useState(false);
  const [msg, setMsg]               = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ hasGlobalPassword: boolean; updated_at: string }>('/settings');
      setHasGlobal(d.hasGlobalPassword);
      setUpdatedAt(d.updated_at);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (novaSenha !== confirma) { setMsg({ type: 'err', text: 'As senhas não coincidem.' }); return; }
    if (novaSenha.length < 4)  { setMsg({ type: 'err', text: 'Senha deve ter ao menos 4 caracteres.' }); return; }
    setSaving(true);
    try {
      await api('/settings/senha-global', { method: 'PUT', body: JSON.stringify({ senha: novaSenha }) });
      setNovaSenha(''); setConfirma('');
      setMsg({ type: 'ok', text: 'Senha global definida com sucesso.' });
      await load();
    } catch (err: unknown) { setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Erro' }); }
    finally { setSaving(false); }
  }

  async function handleRemove() {
    if (!confirm('Remover a senha global? Cada empresa voltará a usar sua própria senha.')) return;
    setRemoving(true); setMsg(null);
    try {
      await api('/settings/senha-global', { method: 'DELETE' });
      setMsg({ type: 'ok', text: 'Senha global removida.' });
      await load();
    } catch (err: unknown) { setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Erro' }); }
    finally { setRemoving(false); }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div className="god-section-header">
        <span className="god-section-title">⚙️ Configurações do Sistema</span>
      </div>

      {/* Card: senha global de admin */}
      <div className="god-card">
        <div className="god-card-body">
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, color: 'var(--god-text)', marginBottom: 6 }}>
              Senha global de admin
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--god-muted)', lineHeight: 1.5 }}>
              Quando definida, esta senha funciona no painel admin de <strong style={{ color: 'var(--god-accent)' }}>todos os subdomínios</strong>,
              independente da senha individual de cada empresa.
            </div>
          </div>

          {/* Status */}
          {hasGlobal !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '10px 14px', background: 'var(--god-bg)', borderRadius: 8, border: '1px solid var(--god-border)' }}>
              <span style={{ fontSize: '1.1rem' }}>{hasGlobal ? '🔒' : '🔓'}</span>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: hasGlobal ? 'var(--god-success)' : 'var(--god-warning)' }}>
                  {hasGlobal ? 'Senha global ativa' : 'Nenhuma senha global definida'}
                </div>
                {updatedAt && hasGlobal && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--god-muted)' }}>
                    Atualizada em {new Date(updatedAt).toLocaleString('pt-BR')}
                  </div>
                )}
              </div>
              {hasGlobal && (
                <button
                  className="god-btn-sm god-btn-sm--danger"
                  style={{ marginLeft: 'auto' }}
                  onClick={handleRemove}
                  disabled={removing}
                >
                  {removing ? 'Removendo…' : '🗑 Remover'}
                </button>
              )}
            </div>
          )}

          {msg && (
            <div className={msg.type === 'ok' ? undefined : 'god-error'} style={msg.type === 'ok' ? {
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
              color: 'var(--god-success)', borderRadius: 8, padding: '10px 14px',
              fontSize: '0.85rem', marginBottom: 14,
            } : { marginBottom: 14 }}>
              {msg.text}
            </div>
          )}

          <form onSubmit={handleSave}>
            <div className="god-form-group">
              <label className="god-label">{hasGlobal ? 'Nova senha global' : 'Definir senha global'}</label>
              <div className="god-input-wrap">
                <input
                  className="god-input"
                  type={showPwd ? 'text' : 'password'}
                  value={novaSenha}
                  onChange={e => setNovaSenha(e.target.value)}
                  required
                  placeholder="Mínimo 4 caracteres"
                  autoComplete="new-password"
                />
                <button type="button" className="god-eye-btn" onClick={() => setShowPwd(v => !v)}>
                  {showPwd ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>
            <div className="god-form-group">
              <label className="god-label">Confirmar senha</label>
              <input
                className="god-input"
                type={showPwd ? 'text' : 'password'}
                value={confirma}
                onChange={e => setConfirma(e.target.value)}
                required
                placeholder="Repita a senha"
                autoComplete="new-password"
              />
            </div>
            <button className="god-btn" type="submit" disabled={saving} style={{ marginTop: 4 }}>
              {saving ? 'Salvando…' : hasGlobal ? '🔑 Atualizar senha global' : '🔑 Definir senha global'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── DASHBOARD LAYOUT ──────────────────────────────────────────────────────────
type Tab = 'overview' | 'clients' | 'users' | 'relatorios' | 'contadores' | 'configuracoes';

function GodDashboard({ god, onLogout }: { god: GodUser; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');

  async function handleLogout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    clearToken(); onLogout();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview',      label: '📊 Visão Geral' },
    { id: 'clients',       label: '🏢 Clientes' },
    { id: 'users',         label: '👤 Usuários' },
    { id: 'relatorios',    label: '📋 Relatórios' },
    { id: 'contadores',    label: '🧮 Contadores' },
    { id: 'configuracoes', label: '⚙️ Configurações' },
  ];

  return (
    <div className="god-root">
      <div className="god-layout">
        <header className="god-header">
          <div className="god-header-brand">
            <div className="god-badge"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> GOD</div>
            Flowbase Super Admin
          </div>
          <div className="god-header-spacer" />
          <span className="god-header-user">{god.nome}</span>
          <button className="god-logout-btn" onClick={handleLogout}>Sair</button>
        </header>

        <nav className="god-tabs">
          {tabs.map(t => (
            <button key={t.id} className={`god-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>

        <main className="god-main">
          {tab === 'overview'      && <OverviewTab />}
          {tab === 'clients'       && <ClientsTab />}
          {tab === 'users'         && <UsersTab />}
          {tab === 'relatorios'    && <RelatoriosTab />}
          {tab === 'contadores'    && <ContadoresTab />}
          {tab === 'configuracoes' && <ConfiguracoesTab />}
        </main>
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function GodApp() {
  const [god, setGod]         = useState<GodUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!getToken()) { setChecking(false); return; }
    api<{ god: GodUser }>('/auth/me')
      .then(d => setGod(d.god))
      .catch(() => clearToken())
      .finally(() => setChecking(false));
  }, []);

  if (checking) return (
    <div className="god-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--god-muted)' }}>Verificando sessão…</div>
    </div>
  );

  return god
    ? <GodDashboard god={god} onLogout={() => setGod(null)} />
    : <GodLogin onLogin={setGod} />;
}
