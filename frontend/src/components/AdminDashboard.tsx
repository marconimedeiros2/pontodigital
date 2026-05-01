import { useState, useEffect, useCallback } from 'react';
import { adminApi, type RegistroAdmin, type DashboardStats, type Usuario } from '../services/adminApi';
import { STEP_LABELS } from '../types';
import { exportToXlsx } from '../utils/exportXlsx';

type AdminTab = 'dashboard' | 'usuarios' | 'relatorio' | 'configuracoes';

interface AdminDashboardProps {
  onLogout: () => void;
}

interface EditModalProps {
  usuario: Usuario;
  onClose: () => void;
  onSaved: () => void;
}

function EditModal({ usuario, onClose, onSaved }: EditModalProps) {
  const [nome, setNome] = useState(usuario.nome);
  const [novoPin, setNovoPin] = useState(usuario.pin);
  const [ativo, setAtivo] = useState(usuario.ativo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pinChanged = novoPin !== usuario.pin;

  const handleSave = async () => {
    setError('');
    if (!nome.trim()) { setError('Nome é obrigatório.'); return; }
    if (!/^\d{4,6}$/.test(novoPin)) { setError('PIN deve ter entre 4 e 6 dígitos numéricos.'); return; }

    setLoading(true);
    try {
      await adminApi.updateUsuario(usuario.pin, {
        nome,
        ativo,
        ...(pinChanged ? { novoPin } : {}),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ textAlign: 'left', maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title" style={{ textAlign: 'left', fontSize: '1.15rem', marginBottom: 20 }}>
          Editar Funcionário
        </h2>

        <div className="input-group" style={{ marginBottom: 14 }}>
          <label className="input-label">Nome</label>
          <input
            type="text"
            className="text-input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoFocus
          />
        </div>

        <div className="input-group" style={{ marginBottom: 14 }}>
          <label className="input-label">PIN</label>
          <input
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            className="text-input"
            value={novoPin}
            onChange={(e) => setNovoPin(e.target.value.replace(/\D/g, ''))}
          />
          {pinChanged && (
            <p style={{ fontSize: '0.78rem', color: '#d97706', marginTop: 4, fontWeight: 500 }}>
              ⚠️ Todos os registros de ponto serão migrados para o novo PIN.
            </p>
          )}
        </div>

        <div className="input-group" style={{ marginBottom: 20 }}>
          <label className="input-label">Status</label>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            {[true, false].map((val) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => setAtivo(val)}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 8,
                  border: `2px solid ${ativo === val ? 'var(--primary)' : 'var(--border)'}`,
                  background: ativo === val ? 'var(--primary-light)' : 'var(--bg-card)',
                  color: ativo === val ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {val ? 'Ativo' : 'Inativo'}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="error-banner" style={{ marginBottom: 14 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="confirm-btn"
            style={{ background: 'var(--keypad-btn-bg)', color: 'var(--text)', boxShadow: 'none', border: '1px solid var(--border)', flex: 1 }}
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button className="confirm-btn" style={{ flex: 1 }} onClick={handleSave} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function calcWorkTime(reg: RegistroAdmin): string {
  if (!reg.hora_inicial || !reg.hora_final) return '—';
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const total = toMin(reg.hora_final) - toMin(reg.hora_inicial);
  const interval = reg.inicio_intervalo && reg.fim_intervalo
    ? toMin(reg.fim_intervalo) - toMin(reg.inicio_intervalo) : 0;
  const worked = total - interval;
  if (worked < 0) return '—';
  return `${Math.floor(worked / 60)}h${String(worked % 60).padStart(2, '0')}`;
}

function formatDate(d: string) {
  const [y, m, day] = d.split('-');
  return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('pt-BR');
}

function StatusBadge({ reg }: { reg: RegistroAdmin }) {
  if (reg.hora_final) return <span className="badge badge--saiu">Saiu</span>;
  if (reg.inicio_intervalo && !reg.fim_intervalo) return <span className="badge badge--intervalo">Intervalo</span>;
  if (reg.hora_inicial) return <span className="badge badge--presente">Presente</span>;
  return <span className="badge badge--ausente">Ausente</span>;
}

const today = new Date().toISOString().split('T')[0];

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [tab, setTab] = useState<AdminTab>('dashboard');

  // Dashboard state
  const [dashDate, setDashDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [dashData, setDashData] = useState<{ registros: RegistroAdmin[]; stats: DashboardStats } | null>(null);
  const [dashLoading, setDashLoading] = useState(false);

  // Usuários state
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [novoPin, setNovoPin] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [usuariosError, setUsuariosError] = useState('');
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);

  // Relatório state
  const [relInicio, setRelInicio] = useState(today);
  const [relFim, setRelFim] = useState(today);
  const [relDataAll, setRelDataAll] = useState<RegistroAdmin[]>([]); // todos (visíveis + ocultos)
  const [relLoading, setRelLoading] = useState(false);
  const [relSelected, setRelSelected] = useState<Set<number>>(new Set());
  const [mostrarOcultos, setMostrarOcultos] = useState(false);

  const ocultosCount = relDataAll.filter((r) => r.oculto).length;
  const relData = mostrarOcultos ? relDataAll : relDataAll.filter((r) => !r.oculto);

  // Config state
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [configMsg, setConfigMsg] = useState('');
  const [configError, setConfigError] = useState('');

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const data = await adminApi.getDashboard(dashDate);
      setDashData({ registros: data.registros, stats: data.stats });
    } catch { /* ignore */ } finally { setDashLoading(false); }
  }, [dashDate]);

  const loadUsuarios = useCallback(async () => {
    setUsuariosLoading(true);
    try {
      const data = await adminApi.listUsuarios();
      setUsuarios(data.usuarios);
    } catch { /* ignore */ } finally { setUsuariosLoading(false); }
  }, []);

  useEffect(() => { if (tab === 'dashboard') loadDashboard(); }, [tab, loadDashboard]);
  useEffect(() => { if (tab === 'usuarios') loadUsuarios(); }, [tab, loadUsuarios]);

  const handleLogout = async () => {
    try { await adminApi.logout(); } catch { /* ignore */ }
    adminApi.clearToken();
    onLogout();
  };

  const handleAddUsuario = async () => {
    setUsuariosError('');
    if (!novoPin || !novoNome.trim()) { setUsuariosError('Preencha PIN e Nome.'); return; }
    try {
      await adminApi.createUsuario(novoPin, novoNome);
      setNovoPin(''); setNovoNome('');
      await loadUsuarios();
    } catch (e) { setUsuariosError(e instanceof Error ? e.message : 'Erro'); }
  };

  const handleToggleAtivo = async (u: Usuario) => {
    try { await adminApi.updateUsuario(u.pin, { ativo: !u.ativo }); await loadUsuarios(); } catch { /* ignore */ }
  };

  const handleDeleteUsuario = async (pin: string) => {
    if (!confirm('Remover este funcionário?')) return;
    try { await adminApi.deleteUsuario(pin); await loadUsuarios(); } catch { /* ignore */ }
  };

  const handleRelatorio = async () => {
    setRelLoading(true);
    setRelSelected(new Set());
    setMostrarOcultos(false);
    try {
      // Sempre busca todos (visíveis + ocultos) — filtragem é feita no frontend
      const data = await adminApi.getRelatorio(relInicio || undefined, relFim || undefined, true);
      setRelDataAll(data.registros);
    } catch { /* ignore */ } finally { setRelLoading(false); }
  };

  const handleToggleOcultos = () => setMostrarOcultos((v) => !v);

  const toggleRelSelect = (id: number) =>
    setRelSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const allRelSelected = relData.length > 0 && relSelected.size === relData.length;
  const toggleAllRel = () =>
    setRelSelected(allRelSelected ? new Set() : new Set(relData.map((r) => r.id)));

  const handleHideSelected = async () => {
    if (!confirm(`Ocultar ${relSelected.size} registro(s) selecionado(s)?`)) return;
    await Promise.all([...relSelected].map((id) => adminApi.hideRegistro(id).catch(() => {})));
    setRelData((prev) => prev.filter((r) => !relSelected.has(r.id)));
    setRelSelected(new Set());
  };

  const exportCSV = (registros: RegistroAdmin[], prefix = 'relatorio') => {
    const header = 'Data,Funcionário,PIN,Entrada,Início Intervalo,Fim Intervalo,Saída,Horas Trabalhadas,Status\n';
    const rows = registros.map((r) =>
      [r.data, r.nome, r.pin, r.hora_inicial || '', r.inicio_intervalo || '',
       r.fim_intervalo || '', r.hora_final || '', calcWorkTime(r),
       r.completo ? 'Completo' : 'Incompleto'].join(',')
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${prefix}_${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const ExportButtons = ({ registros, prefix }: { registros: RegistroAdmin[]; prefix: string }) => (
    <div className="export-btn-group">
      <button className="export-btn" onClick={() => exportCSV(registros, prefix)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
        CSV
      </button>
      <button className="export-btn export-btn--xlsx" onClick={() => exportToXlsx(registros, `${prefix}_${today}`)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
        Excel
      </button>
    </div>
  );

  const handleChangePassword = async () => {
    setConfigMsg(''); setConfigError('');
    if (novaSenha !== confirmarSenha) { setConfigError('As senhas não coincidem.'); return; }
    if (novaSenha.length < 6) { setConfigError('Nova senha deve ter ao menos 6 caracteres.'); return; }
    try {
      await adminApi.changePassword(senhaAtual, novaSenha);
      setConfigMsg('Senha alterada com sucesso!');
      setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha('');
    } catch (e) { setConfigError(e instanceof Error ? e.message : 'Erro'); }
  };

  const TABS: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'usuarios', label: 'Funcionários', icon: '👥' },
    { id: 'relatorio', label: 'Relatório', icon: '📋' },
    { id: 'configuracoes', label: 'Configurações', icon: '⚙️' },
  ];

  return (
    <div className="admin-layout">
      {editingUsuario && (
        <EditModal
          usuario={editingUsuario}
          onClose={() => setEditingUsuario(null)}
          onSaved={loadUsuarios}
        />
      )}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Admin</span>
        </div>
        <nav className="admin-nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`admin-nav-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <button className="admin-logout-btn" onClick={handleLogout}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          Sair
        </button>
      </aside>

      <main className="admin-main">
        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Dashboard</h2>
              <div className="dash-controls">
                <input type="date" value={dashDate}
                  onChange={(e) => setDashDate(e.target.value)}
                  className="text-input" style={{ width: 160 }} />
                <button className="search-btn" onClick={loadDashboard}>Atualizar</button>
              </div>
            </div>

            {dashLoading && <div className="admin-loading"><span className="spinner spinner--large" /></div>}

            {dashData && !dashLoading && (
              <>
                <div className="stats-grid">
                  {[
                    { label: 'Registros', value: dashData.stats.total, color: '#3b82f6' },
                    { label: 'Presentes', value: dashData.stats.presentes, color: '#16a34a' },
                    { label: 'Em Intervalo', value: dashData.stats.emIntervalo, color: '#d97706' },
                    { label: 'Saíram', value: dashData.stats.saiu, color: '#dc2626' },
                  ].map((s) => (
                    <div key={s.label} className="stat-card" style={{ borderTopColor: s.color }}>
                      <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
                      <span className="stat-label">{s.label}</span>
                    </div>
                  ))}
                </div>

                {dashData.registros.length === 0 ? (
                  <div className="admin-empty">Nenhum registro nesta data.</div>
                ) : (
                  <div className="admin-table-wrap">
                    <div className="admin-table-actions">
                      <span className="history-count">{dashData.registros.length} registros</span>
                      <ExportButtons registros={dashData.registros} prefix={`ponto_${dashDate}`} />
                    </div>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Funcionário</th>
                          <th>PIN</th>
                          <th>{STEP_LABELS.hora_inicial}</th>
                          <th>{STEP_LABELS.inicio_intervalo}</th>
                          <th>{STEP_LABELS.fim_intervalo}</th>
                          <th>{STEP_LABELS.hora_final}</th>
                          <th>Trabalhado</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashData.registros.map((r) => (
                          <tr key={r.id}>
                            <td className="td-nome">{r.nome}</td>
                            <td><code>{r.pin}</code></td>
                            <td>{r.hora_inicial || '—'}</td>
                            <td>{r.inicio_intervalo || '—'}</td>
                            <td>{r.fim_intervalo || '—'}</td>
                            <td>{r.hora_final || '—'}</td>
                            <td><strong>{calcWorkTime(r)}</strong></td>
                            <td><StatusBadge reg={r} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── USUÁRIOS ── */}
        {tab === 'usuarios' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Funcionários</h2>
            </div>

            <div className="admin-card">
              <h3 className="admin-card-title">Adicionar Funcionário</h3>
              <div className="add-user-form">
                <div className="input-group">
                  <label className="input-label">PIN (4-6 dígitos numéricos)</label>
                  <input type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                    value={novoPin} onChange={(e) => setNovoPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ex: 1234" className="text-input" />
                </div>
                <div className="input-group">
                  <label className="input-label">Nome</label>
                  <input type="text" value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    placeholder="Nome completo" className="text-input" />
                </div>
                <button className="confirm-btn" style={{ marginTop: 8 }} onClick={handleAddUsuario}>
                  Adicionar
                </button>
              </div>
              {usuariosError && <p className="error-msg" style={{ marginTop: 8 }}>{usuariosError}</p>}
            </div>

            {usuariosLoading && <div className="admin-loading"><span className="spinner spinner--large" /></div>}

            {!usuariosLoading && usuarios.length === 0 && (
              <div className="admin-empty">Nenhum funcionário cadastrado.</div>
            )}

            {!usuariosLoading && usuarios.length > 0 && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>Nome</th><th>PIN</th><th>Status</th><th>Ações</th></tr>
                  </thead>
                  <tbody>
                    {usuarios.map((u) => (
                      <tr key={u.pin}>
                        <td className="td-nome">{u.nome}</td>
                        <td><code>{u.pin}</code></td>
                        <td>
                          <span className={`badge ${u.ativo ? 'badge--presente' : 'badge--ausente'}`}>
                            {u.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td>
                          <div className="action-btns">
                            <button className="action-btn action-btn--edit"
                              onClick={() => setEditingUsuario(u)} title="Editar">
                              Editar
                            </button>
                            <button className="action-btn action-btn--toggle"
                              onClick={() => handleToggleAtivo(u)}
                              title={u.ativo ? 'Desativar' : 'Ativar'}>
                              {u.ativo ? 'Desativar' : 'Ativar'}
                            </button>
                            <button className="action-btn action-btn--delete"
                              onClick={() => handleDeleteUsuario(u.pin)} title="Remover">
                              Remover
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── RELATÓRIO ── */}
        {tab === 'relatorio' && (
          <div className="admin-section">
            <div className="admin-section-header"><h2>Relatório</h2></div>

            <div className="admin-card">
              <div className="rel-filters">
                <div className="input-group">
                  <label className="input-label">Data Inicial</label>
                  <input type="date" value={relInicio}
                    onChange={(e) => setRelInicio(e.target.value)} className="text-input" />
                </div>
                <div className="input-group">
                  <label className="input-label">Data Final</label>
                  <input type="date" value={relFim}
                    onChange={(e) => setRelFim(e.target.value)} className="text-input" />
                </div>
                <button className="search-btn" style={{ alignSelf: 'flex-end' }}
                  onClick={handleRelatorio} disabled={relLoading}>
                  {relLoading ? <span className="spinner" /> : 'Buscar'}
                </button>
              </div>

              <div className="rel-quick-filters">
                {[
                  { label: 'Hoje',            days: 0  },
                  { label: 'Ontem',           days: 1  },
                  { label: 'Anteontem',       days: 2  },
                  { label: 'Últimos 7 dias',  days: 6  },
                  { label: 'Últimos 30 dias', days: 29 },
                ].map(({ label, days }) => {
                  const end   = new Date();
                  const start = new Date(); start.setDate(start.getDate() - days);
                  const fmt = (d: Date) => d.toISOString().split('T')[0];
                  const endStr   = fmt(end);
                  const startStr = fmt(start);
                  const active = relInicio === startStr && relFim === endStr;
                  return (
                    <button
                      key={label}
                      className={`rel-quick-btn${active ? ' rel-quick-btn--active' : ''}`}
                      onClick={() => { setRelInicio(startStr); setRelFim(endStr); }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {relData.length > 0 && (
              <>
                <div className="admin-table-actions">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span className="history-count">{relData.length} registros</span>
                    {ocultosCount > 0 && (
                      <button className="btn-toggle-ocultos" onClick={handleToggleOcultos}>
                        {mostrarOcultos ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                            <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                        {mostrarOcultos ? 'Esconder ocultos' : `${ocultosCount} oculto${ocultosCount > 1 ? 's' : ''}`}
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {relSelected.size > 0 && (
                      <button className="btn-delete-selected" onClick={handleHideSelected}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                        Ocultar {relSelected.size} selecionado{relSelected.size > 1 ? 's' : ''}
                      </button>
                    )}
                    <ExportButtons registros={relDataAll} prefix="relatorio" />
                  </div>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>
                          <input type="checkbox" className="rel-checkbox"
                            checked={allRelSelected} onChange={toggleAllRel} />
                        </th>
                        <th>Data</th><th>Funcionário</th><th>Entrada</th><th>Iníc. Int.</th><th>Fim Int.</th><th>Saída</th><th>Trabalhado</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relData.map((r) => (
                        <tr key={r.id} className={[relSelected.has(r.id) ? 'rel-row--selected' : '', r.oculto ? 'rel-row--oculto' : ''].filter(Boolean).join(' ')}>
                          <td>
                            <input type="checkbox" className="rel-checkbox"
                              checked={relSelected.has(r.id)} onChange={() => toggleRelSelect(r.id)} />
                          </td>
                          <td>{formatDate(r.data)}</td>
                          <td className="td-nome">{r.nome}</td>
                          <td>{r.hora_inicial || '—'}</td>
                          <td>{r.inicio_intervalo || '—'}</td>
                          <td>{r.fim_intervalo || '—'}</td>
                          <td>{r.hora_final || '—'}</td>
                          <td><strong>{calcWorkTime(r)}</strong></td>
                          <td><StatusBadge reg={r} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {!relLoading && relData.length === 0 && relInicio && (
              <div className="admin-empty">Nenhum registro no período selecionado.</div>
            )}
          </div>
        )}

        {/* ── CONFIGURAÇÕES ── */}
        {tab === 'configuracoes' && (
          <div className="admin-section">
            <div className="admin-section-header"><h2>Configurações</h2></div>

            <div className="admin-card" style={{ maxWidth: 440 }}>
              <h3 className="admin-card-title">Alterar Senha do Admin</h3>
              <div className="input-group">
                <label className="input-label">Senha Atual</label>
                <input type="password" value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  className="text-input" placeholder="Digite a senha atual" />
              </div>
              <div className="input-group">
                <label className="input-label">Nova Senha</label>
                <input type="password" value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="text-input" placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="input-group">
                <label className="input-label">Confirmar Nova Senha</label>
                <input type="password" value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className="text-input" placeholder="Repita a nova senha" />
              </div>
              {configError && <p className="error-msg" style={{ marginTop: 8 }}>{configError}</p>}
              {configMsg && <p style={{ color: 'var(--success)', marginTop: 8, fontWeight: 600 }}>{configMsg}</p>}
              <button className="confirm-btn" style={{ marginTop: 16 }} onClick={handleChangePassword}>
                Salvar Nova Senha
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
