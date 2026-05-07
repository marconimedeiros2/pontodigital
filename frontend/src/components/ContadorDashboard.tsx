import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { contadorApi, ContadorCliente, RegistroContador } from '../services/contadorApi';

// ── helpers ──────────────────────────────────────────────────────────────────
function extractTime(t: string): string {
  // Handle full ISO datetime "2026-05-07T08:30:00" or "2026-05-07 08:30:00"
  // Apply UTC-3 offset if it's a full datetime
  if (t.includes('T') || (t.length > 8 && t.includes(' '))) {
    const iso = t.includes('T') ? t : t.replace(' ', 'T');
    const date = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
    const h = date.getUTCHours() - 3;
    const adjustedH = ((h % 24) + 24) % 24;
    const m = date.getUTCMinutes();
    const s = date.getUTCSeconds();
    return `${String(adjustedH).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return t;
}

function displayTime(t: string | null): string {
  if (!t) return '—';
  return extractTime(t).slice(0, 5);
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function calcWorked(r: RegistroContador): string {
  if (!r.hora_inicial || !r.hora_final) return '—';
  const toMin = (t: string) => {
    const clean = extractTime(t);
    const [h, m] = clean.split(':').map(Number);
    return h * 60 + m;
  };
  let total = toMin(r.hora_final) - toMin(r.hora_inicial);
  if (r.inicio_intervalo && r.fim_intervalo) {
    total -= toMin(r.fim_intervalo) - toMin(r.inicio_intervalo);
  }
  if (total < 0) return '—';
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function exportXlsx(registros: RegistroContador[], clienteNome: string, inicio: string, fim: string): void {
  const rows = registros.map((r) => ({
    'Funcionário': r.nome,
    'Data': fmtDate(r.data),
    'Entrada': displayTime(r.hora_inicial),
    'Iní. Intervalo': displayTime(r.inicio_intervalo),
    'Fim Intervalo': displayTime(r.fim_intervalo),
    'Saída': displayTime(r.hora_final),
    'Total': calcWorked(r),
    'Status': r.completo ? 'Completo' : 'Incompleto',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 14 },
    { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registros');

  const filename = `ponto_${clienteNome.replace(/\s+/g, '_')}_${inicio}_${fim}.xlsx`;
  XLSX.writeFile(wb, filename);
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

// ── Connect modal ─────────────────────────────────────────────────────────────
interface ConnectModalProps {
  onConnect: (chave: string, nome: string) => Promise<void>;
  onClose: () => void;
}

function ConnectModal({ onConnect, onClose }: ConnectModalProps) {
  const [chave, setChave] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chave.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onConnect(chave.trim(), nome.trim() || 'Cliente');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cnt-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cnt-modal">
        <div className="cnt-modal-header">
          <h3 className="cnt-modal-title">Conectar Cliente</h3>
          <button className="cnt-modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="cnt-modal-form">
          <div className="cnt-field">
            <label className="cnt-label">UUID ou Chave de API</label>
            <input
              className="cnt-input"
              value={chave}
              onChange={(e) => { setChave(e.target.value); setError(''); }}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx ou pd_live_…"
              disabled={loading}
              autoFocus
            />
            <span className="cnt-field-hint">
              UUID disponível em Configurações → Integrações no sistema do cliente.
            </span>
          </div>

          <div className="cnt-field">
            <label className="cnt-label">Nome do cliente (opcional)</label>
            <input
              className="cnt-input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Empresa XYZ Ltda"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="cnt-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <div className="cnt-modal-actions">
            <button type="button" className="cnt-btn cnt-btn--ghost" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="cnt-btn cnt-btn--primary" disabled={loading || !chave.trim()}>
              {loading ? 'Conectando…' : 'Conectar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Rename modal ──────────────────────────────────────────────────────────────
interface RenameModalProps {
  nomeAtual: string;
  onRename: (novoNome: string) => Promise<void>;
  onClose: () => void;
}

function RenameModal({ nomeAtual, onRename, onClose }: RenameModalProps) {
  const [nome, setNome] = useState(nomeAtual);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || nome.trim() === nomeAtual) { onClose(); return; }
    setLoading(true);
    setError('');
    try {
      await onRename(nome.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao renomear');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cnt-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cnt-modal cnt-modal--sm">
        <div className="cnt-modal-header">
          <h3 className="cnt-modal-title">Renomear cliente</h3>
          <button className="cnt-modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="cnt-modal-form">
          <div className="cnt-field">
            <label className="cnt-label">Nome do cliente</label>
            <input
              className="cnt-input"
              value={nome}
              onChange={(e) => { setNome(e.target.value); setError(''); }}
              disabled={loading}
              autoFocus
            />
          </div>
          {error && (
            <div className="cnt-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}
          <div className="cnt-modal-actions">
            <button type="button" className="cnt-btn cnt-btn--ghost" onClick={onClose} disabled={loading}>Cancelar</button>
            <button type="submit" className="cnt-btn cnt-btn--primary" disabled={loading || !nome.trim()}>
              {loading ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete confirm modal ──────────────────────────────────────────────────────
interface ConfirmDeleteProps {
  nome: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

function ConfirmDeleteModal({ nome, onConfirm, onClose }: ConfirmDeleteProps) {
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    setLoading(true);
    try { await onConfirm(); onClose(); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };
  return (
    <div className="cnt-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cnt-modal cnt-modal--sm">
        <div className="cnt-modal-header">
          <h3 className="cnt-modal-title">Desconectar cliente</h3>
          <button className="cnt-modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <p className="cnt-modal-body">
          Deseja remover <strong>{nome}</strong> da sua lista de clientes? Você poderá reconectar a qualquer momento.
        </p>
        <div className="cnt-modal-actions">
          <button className="cnt-btn cnt-btn--ghost" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="cnt-btn cnt-btn--danger" onClick={handle} disabled={loading}>
            {loading ? 'Removendo…' : 'Remover'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  nome: string;
  onLogout: () => void;
}

export function ContadorDashboard({ nome, onLogout }: Props) {
  const [clientes, setClientes] = useState<ContadorCliente[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<ContadorCliente | null>(null);
  const [registros, setRegistros] = useState<RegistroContador[]>([]);
  const [inicio, setInicio] = useState(thirtyDaysAgo());
  const [fim, setFim] = useState(today());
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [loadingRel, setLoadingRel] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContadorCliente | null>(null);
  const [renameTarget, setRenameTarget] = useState<ContadorCliente | null>(null);
  const [relError, setRelError] = useState('');

  // Load clients
  const loadClientes = useCallback(async () => {
    setLoadingClientes(true);
    try {
      const { clientes } = await contadorApi.listClientes();
      setClientes(clientes);
    } catch {
      // ignore
    } finally {
      setLoadingClientes(false);
    }
  }, []);

  useEffect(() => { loadClientes(); }, [loadClientes]);

  // Load relatorio when client or dates change
  const loadRelatorio = useCallback(async () => {
    if (!selectedCliente) return;
    setLoadingRel(true);
    setRelError('');
    try {
      const { registros } = await contadorApi.getRelatorio(selectedCliente.id, inicio, fim);
      setRegistros(registros);
    } catch (err) {
      setRelError(err instanceof Error ? err.message : 'Erro ao carregar registros');
      setRegistros([]);
    } finally {
      setLoadingRel(false);
    }
  }, [selectedCliente, inicio, fim]);

  useEffect(() => { loadRelatorio(); }, [loadRelatorio]);

  const handleConnect = async (chave: string, nome: string) => {
    const { cliente } = await contadorApi.connect(chave, nome);
    setClientes((prev) => {
      const exists = prev.find((c) => c.id === cliente.id);
      if (exists) return prev.map((c) => (c.id === cliente.id ? cliente : c));
      return [...prev, cliente];
    });
    setSelectedCliente(cliente);
  };

  const handleRename = async (cliente: ContadorCliente, novoNome: string) => {
    const { cliente: updated } = await contadorApi.renameCliente(cliente.id, novoNome);
    setClientes((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    if (selectedCliente?.id === updated.id) setSelectedCliente(updated);
  };

  const handleDelete = async (cliente: ContadorCliente) => {
    await contadorApi.deleteCliente(cliente.id);
    setClientes((prev) => prev.filter((c) => c.id !== cliente.id));
    if (selectedCliente?.id === cliente.id) {
      setSelectedCliente(null);
      setRegistros([]);
    }
  };

  const handleLogout = async () => {
    try { await contadorApi.logout(); } catch { /* ignore */ }
    contadorApi.clearSession();
    onLogout();
  };

  // Stats
  const stats = {
    total: registros.length,
    completos: registros.filter((r) => r.completo).length,
    incompletos: registros.filter((r) => !r.completo).length,
  };

  return (
    <div className="cnt-dash">
      {/* Sidebar */}
      <aside className="cnt-sidebar">
        {/* Brand */}
        <div className="cnt-sidebar-brand">
          <div className="cnt-sidebar-brand-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="cnt-sidebar-brand-text">
            <span className="cnt-sidebar-brand-name">tempu</span>
            <span className="cnt-sidebar-brand-sub">Área do Contador</span>
          </div>
        </div>

        {/* User */}
        <div className="cnt-sidebar-user">
          <div className="cnt-sidebar-user-label">Contador</div>
          <div className="cnt-sidebar-user-name">{nome}</div>
        </div>

        {/* Client list */}
        <div className="cnt-sidebar-section-label">Clientes</div>

        {loadingClientes ? (
          <div className="cnt-sidebar-loading">Carregando…</div>
        ) : clientes.length === 0 ? (
          <div className="cnt-sidebar-empty">Nenhum cliente conectado</div>
        ) : (
          <ul className="cnt-client-list">
            {clientes.map((c) => (
              <li
                key={c.id}
                className={`cnt-client-item${selectedCliente?.id === c.id ? ' cnt-client-item--active' : ''}`}
                onClick={() => setSelectedCliente(c)}
              >
                <div className="cnt-client-item-main">
                  <span className="cnt-client-nome">{c.nome_conexao}</span>
                </div>
                <div className="cnt-client-actions">
                  <button
                    className="cnt-client-action"
                    title="Renomear"
                    onClick={(e) => { e.stopPropagation(); setRenameTarget(c); }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    className="cnt-client-action cnt-client-action--danger"
                    title="Desconectar"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Footer */}
        <div className="cnt-sidebar-footer">
          <button className="cnt-connect-btn" onClick={() => setShowConnect(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Conectar cliente
          </button>
          <button className="cnt-logout-btn" onClick={handleLogout}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="cnt-main">
        {!selectedCliente ? (
          <div className="cnt-empty-state">
            <div className="cnt-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h2 className="cnt-empty-title">Selecione um cliente</h2>
            <p className="cnt-empty-sub">
              Escolha um cliente na barra lateral ou conecte um novo para visualizar os registros.
            </p>
            <button className="cnt-btn cnt-btn--primary" onClick={() => setShowConnect(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Conectar cliente
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="cnt-report-header">
              <div className="cnt-report-title">
                <h2>{selectedCliente.nome_conexao}</h2>
                <span className="cnt-report-uuid">{selectedCliente.client_uuid}</span>
              </div>

              {/* Date range + export */}
              <div className="cnt-date-range">
                <label className="cnt-label">De</label>
                <input
                  type="date"
                  className="cnt-input cnt-input--date"
                  value={inicio}
                  max={fim}
                  onChange={(e) => setInicio(e.target.value)}
                />
                <label className="cnt-label">Até</label>
                <input
                  type="date"
                  className="cnt-input cnt-input--date"
                  value={fim}
                  min={inicio}
                  max={today()}
                  onChange={(e) => setFim(e.target.value)}
                />
                <button
                  className="cnt-btn cnt-btn--export"
                  disabled={registros.length === 0}
                  onClick={() => exportXlsx(registros, selectedCliente.nome_conexao, inicio, fim)}
                  title="Exportar para Excel"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Exportar XLSX
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="cnt-stats-row">
              <div className="cnt-stat-card">
                <span className="cnt-stat-label">Total de registros</span>
                <span className="cnt-stat-value">{stats.total}</span>
              </div>
              <div className="cnt-stat-card cnt-stat-card--green">
                <span className="cnt-stat-label">Completos</span>
                <span className="cnt-stat-value">{stats.completos}</span>
              </div>
              <div className="cnt-stat-card cnt-stat-card--orange">
                <span className="cnt-stat-label">Incompletos</span>
                <span className="cnt-stat-value">{stats.incompletos}</span>
              </div>
            </div>

            {/* Table */}
            {loadingRel ? (
              <div className="cnt-loading">Carregando registros…</div>
            ) : relError ? (
              <div className="cnt-error cnt-error--block">{relError}</div>
            ) : registros.length === 0 ? (
              <div className="cnt-table-empty">Nenhum registro no período selecionado.</div>
            ) : (
              <div className="cnt-table-wrap">
                <table className="cnt-table">
                  <thead>
                    <tr>
                      <th>Funcionário</th>
                      <th>Data</th>
                      <th>Entrada</th>
                      <th>Iní. Intervalo</th>
                      <th>Fim Intervalo</th>
                      <th>Saída</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registros.map((r) => (
                      <tr key={r.id} className={r.completo ? '' : 'cnt-row--incomplete'}>
                        <td className="cnt-td-nome">{r.nome}</td>
                        <td>{fmtDate(r.data)}</td>
                        <td>{displayTime(r.hora_inicial)}</td>
                        <td>{displayTime(r.inicio_intervalo)}</td>
                        <td>{displayTime(r.fim_intervalo)}</td>
                        <td>{displayTime(r.hora_final)}</td>
                        <td>{calcWorked(r)}</td>
                        <td>
                          {r.completo ? (
                            <span className="cnt-badge cnt-badge--ok">Completo</span>
                          ) : (
                            <span className="cnt-badge cnt-badge--warn">Incompleto</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {showConnect && (
        <ConnectModal
          onConnect={handleConnect}
          onClose={() => setShowConnect(false)}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          nome={deleteTarget.nome_conexao}
          onConfirm={() => handleDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {renameTarget && (
        <RenameModal
          nomeAtual={renameTarget.nome_conexao}
          onRename={(novoNome) => handleRename(renameTarget, novoNome)}
          onClose={() => setRenameTarget(null)}
        />
      )}
    </div>
  );
}
