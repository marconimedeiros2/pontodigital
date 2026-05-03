import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const [horasDiarias, setHorasDiarias] = useState(minutesToHHMM(usuario.horas_diarias ?? 440));
  const [intervaloModal, setIntervaloModal] = useState(minutesToHHMM(usuario.intervalo ?? 60));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pinChanged = novoPin !== usuario.pin;

  const handleSave = async () => {
    setError('');
    if (!nome.trim()) { setError('Nome é obrigatório.'); return; }
    if (!/^\d{4,6}$/.test(novoPin)) { setError('PIN deve ter entre 4 e 6 dígitos numéricos.'); return; }
    const minutos = hhmmToMinutes(horasDiarias);
    if (isNaN(minutos) || minutos < 60 || minutos > 1440) { setError('Jornada inválida. Use o formato H:MM (ex: 7:20).'); return; }
    const intMin = hhmmToMinutes(intervaloModal);
    if (isNaN(intMin) || intMin < 0 || intMin > 480) { setError('Intervalo inválido. Use o formato H:MM (ex: 1:00).'); return; }

    setLoading(true);
    try {
      await adminApi.updateUsuario(usuario.pin, {
        nome,
        ativo,
        horas_diarias: minutos,
        intervalo: intMin,
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div className="input-group">
            <label className="input-label">Jornada (H:MM)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="text" pattern="\d+:[0-5]\d" placeholder="7:20"
                className="text-input" style={{ width: 80 }}
                value={horasDiarias} onChange={(e) => setHorasDiarias(e.target.value)} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>h:mm</span>
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Intervalo (H:MM)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="text" pattern="\d+:[0-5]\d" placeholder="1:00"
                className="text-input" style={{ width: 80 }}
                value={intervaloModal} onChange={(e) => setIntervaloModal(e.target.value)} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>h:mm</span>
            </div>
          </div>
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
  const { hora_inicial: entrada, inicio_intervalo: inicInt, fim_intervalo: fimInt, hora_final: saida } = reg;

  if (!entrada || !saida) return '—';

  const parseTime = (timeStr: string) => {
    const time = timeStr.includes(' ') ? timeStr.split(' ')[1] : timeStr;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const minEntrada = parseTime(entrada);
  let minSaida = parseTime(saida);

  // Trata virada de dia (ex: entrou 13:00 e saiu 00:10)
  if (minSaida < minEntrada) {
    minSaida += 24 * 60;
  }

  let totalInterval = 0;
  if (inicInt || fimInt) {
    // Se algum campo do intervalo estiver vazio mas o outro não, não calcula
    if (!inicInt || !fimInt) return '—';
    const minInic = parseTime(inicInt);
    let minFim = parseTime(fimInt);
    
    // Trata virada de dia no intervalo
    if (minFim < minInic) {
      minFim += 24 * 60;
    }
    totalInterval = minFim - minInic;
  }

  const worked = (minSaida - minEntrada) - totalInterval;

  if (worked < 0) return '—';

  const h = Math.floor(worked / 60);
  const m = worked % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDate(d: string) {
  const [y, m, day] = d.split('-');
  return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('pt-BR');
}

function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function hhmmToMinutes(str: string): number {
  const [h, m] = str.split(':').map(Number);
  if (isNaN(h) || isNaN(m) || m < 0 || m > 59) return NaN;
  return h * 60 + m;
}


function StatusBadge({ reg }: { reg: RegistroAdmin }) {
  if (reg.hora_final)                                    return <span className="badge badge--saiu">Saída</span>;
  if (reg.fim_intervalo)                                 return <span className="badge badge--presente">Fim do Intervalo</span>;
  if (reg.inicio_intervalo && !reg.fim_intervalo)        return <span className="badge badge--intervalo">Início do Intervalo</span>;
  if (reg.hora_inicial)                                  return <span className="badge badge--presente">Entrada</span>;
  return <span className="badge badge--ausente">Ausente</span>;
}

function SearchableSelect({ options, value, onChange, placeholder }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()) || o.value.includes(search)
  );
  const selected = options.find((o) => o.value === value);

  return (
    <div className="ss-wrap" ref={ref}>
      <button type="button" className="ss-trigger" onClick={() => setOpen((v) => !v)}>
        <span>{selected ? `${selected.label}` : (placeholder ?? 'Selecione...')}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="ss-dropdown">
          <input
            type="text" className="ss-search" autoFocus placeholder="Buscar..."
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
          <div className="ss-options">
            {filtered.length === 0
              ? <div className="ss-empty">Nenhum resultado</div>
              : filtered.map((o) => (
                <div
                  key={o.value}
                  className={`ss-option${value === o.value ? ' ss-option--selected' : ''}`}
                  onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
                >
                  <span>{o.label}</span>
                  <code style={{ fontSize: '0.75rem', opacity: 0.6 }}>{o.value}</code>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

function AddRegistroModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [usuariosOpts, setUsuariosOpts] = useState<{ value: string; label: string }[]>([]);
  const [pin, setPin] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [entrada, setEntrada] = useState('');
  const [iniInt, setIniInt] = useState('');
  const [fimInt, setFimInt] = useState('');
  const [saida, setSaida] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.listUsuarios()
      .then((d) => setUsuariosOpts(d.usuarios.filter((u) => u.ativo).map((u) => ({ value: u.pin, label: u.nome }))))
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, []);

  const toDbVal = (t: string) => t ? `${data} ${t}:00` : null;

  const handleSave = async () => {
    setError('');
    if (!pin) { setError('Selecione um funcionário.'); return; }
    if (!data) { setError('Data é obrigatória.'); return; }
    setLoading(true);
    try {
      await adminApi.createRegistro(pin, data, {
        hora_inicial:     toDbVal(entrada) as string | null,
        inicio_intervalo: toDbVal(iniInt)  as string | null,
        fim_intervalo:    toDbVal(fimInt)  as string | null,
        hora_final:       toDbVal(saida)   as string | null,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ textAlign: 'left', maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title" style={{ textAlign: 'left', fontSize: '1.15rem', marginBottom: 20 }}>
          Novo Registro
        </h2>

        {loadingUsers ? (
          <div className="admin-loading"><span className="spinner" /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="input-group">
              <label className="input-label">Funcionário</label>
              <SearchableSelect
                options={usuariosOpts}
                value={pin}
                onChange={setPin}
                placeholder="Selecione o funcionário..."
              />
            </div>

            <div className="input-group">
              <label className="input-label">Data</label>
              <input type="date" className="text-input" value={data} onChange={(e) => setData(e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {([
                ['Entrada',         entrada, setEntrada],
                ['Início Intervalo', iniInt, setIniInt],
                ['Fim Intervalo',    fimInt, setFimInt],
                ['Saída',            saida,  setSaida],
              ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                <div className="input-group" key={label}>
                  <label className="input-label">{label}</label>
                  <input type="time" className="text-input" value={val} onChange={(e) => setter(e.target.value)} />
                </div>
              ))}
            </div>

            {error && (
              <div className="error-banner">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                className="confirm-btn"
                style={{ background: 'var(--keypad-btn-bg)', color: 'var(--text)', boxShadow: 'none', border: '1px solid var(--border)', flex: 1 }}
                onClick={onClose} disabled={loading}
              >
                Cancelar
              </button>
              <button className="confirm-btn" style={{ flex: 1 }} onClick={handleSave} disabled={loading}>
                {loading ? <span className="spinner" /> : 'Criar Registro'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const today = new Date().toISOString().split('T')[0];

type TimeField = 'hora_inicial' | 'inicio_intervalo' | 'fim_intervalo' | 'hora_final';

const UTC_OFFSET = -3;

function shiftTime(utcStr: string, offsetH: number): { date: string; hhmm: string; hhmmss: string } {
  const [datePart, timePart] = utcStr.includes(' ') ? utcStr.split(' ') : ['', utcStr];
  const [h, m, s = '00'] = timePart.split(':');
  let lh = parseInt(h, 10) + offsetH;
  let ld = datePart;
  if (lh < 0) {
    lh += 24;
    if (ld) { const d = new Date(ld + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); ld = d.toISOString().split('T')[0]; }
  } else if (lh >= 24) {
    lh -= 24;
    if (ld) { const d = new Date(ld + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); ld = d.toISOString().split('T')[0]; }
  }
  const hhmm = `${String(lh).padStart(2, '0')}:${m.padStart(2, '0')}`;
  return { date: ld, hhmm, hhmmss: `${hhmm}:${s}` };
}

function displayTime(val: string | null): string {
  if (!val) return '—';
  return shiftTime(val, UTC_OFFSET).hhmm;
}

function localTimestamp(val: string | null): string {
  if (!val) return '';
  const { date, hhmmss } = shiftTime(val, UTC_OFFSET);
  return date ? `${date} ${hhmmss}` : hhmmss;
}

function toInputVal(val: string | null): string {
  if (!val) return '';
  const { date, hhmm } = shiftTime(val, UTC_OFFSET);
  return date ? `${date}T${hhmm}` : hhmm;
}

function fromInputVal(val: string): string | null {
  if (!val) return null;
  const [datePart, timePart] = val.split('T');
  const { date, hhmmss } = shiftTime(`${datePart} ${timePart}:00`, -UTC_OFFSET);
  return `${date} ${hhmmss}`;
}

function TimeCell({ value, onSave }: { value: string | null; onSave: (v: string | null) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const commit = async (raw: string) => {
    const next = fromInputVal(raw);
    if (next === value) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(next); }
    catch (e) { alert('Erro ao salvar: ' + (e instanceof Error ? e.message : 'Erro')); }
    finally { setSaving(false); setEditing(false); }
  };

  if (editing) {
    return (
      <input
        type="datetime-local"
        className="rel-time-input rel-time-input--open"
        autoFocus
        defaultValue={toInputVal(value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className={`rel-time-display${!value ? ' rel-time-display--empty' : ''}${saving ? ' rel-time-display--saving' : ''}`}
      onClick={() => !saving && setEditing(true)}
      title="Clique para editar"
    >
      {value ? displayTime(value) : '+'}
    </span>
  );
}

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
  const [novoHoras, setNovoHoras] = useState('7:20');
  const [novoIntervalo, setNovoIntervalo] = useState('1:00');
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [usuariosError, setUsuariosError] = useState('');
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [selectedUsuarios, setSelectedUsuarios] = useState<Set<string>>(new Set());
  const [bulkHoras, setBulkHoras] = useState('7:20');
  const [bulkIntervalo, setBulkIntervalo] = useState('1:00');
  const [bulkLoading, setBulkLoading] = useState(false);

  // Relatório state
  const [relInicio, setRelInicio] = useState(today);
  const [relFim, setRelFim] = useState(today);
  const [relDataAll, setRelDataAll] = useState<RegistroAdmin[]>([]); // todos (visíveis + ocultos)
  const [relLoading, setRelLoading] = useState(false);
  const [relSelected, setRelSelected] = useState<Set<number>>(new Set());
  const [mostrarOcultos, setMostrarOcultos] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const ocultosCount = relDataAll.filter((r) => r.oculto).length;
  const relData = mostrarOcultos ? relDataAll : relDataAll.filter((r) => !r.oculto);

  // Config state
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [configMsg, setConfigMsg] = useState('');
  const [configError, setConfigError] = useState('');
  const [escalaPadrao, setEscalaPadrao] = useState('7:20');
  const [intervaloPadrao, setIntervaloPadrao] = useState('1:00');
  const [escalaMsg, setEscalaMsg] = useState('');
  const [escalaError, setEscalaError] = useState('');
  const [configTab, setConfigTab] = useState<'escala' | 'senha'>('escala');

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

  useEffect(() => {
    adminApi.getEscala().then(({ escala_padrao, intervalo_padrao }) => {
      const hhmm = minutesToHHMM(escala_padrao);
      setEscalaPadrao(hhmm);
      setNovoHoras(hhmm);
      setBulkHoras(hhmm);
      setIntervaloPadrao(minutesToHHMM(intervalo_padrao));
    }).catch(() => {});
  }, []);

  const handleLogout = async () => {
    try { await adminApi.logout(); } catch { /* ignore */ }
    adminApi.clearToken();
    onLogout();
  };

  const handleAddUsuario = async () => {
    setUsuariosError('');
    if (!novoPin || !novoNome.trim()) { setUsuariosError('Preencha PIN e Nome.'); return; }
    const minutos = hhmmToMinutes(novoHoras);
    if (isNaN(minutos) || minutos < 60 || minutos > 1440) { setUsuariosError('Jornada inválida. Use o formato H:MM (ex: 7:20).'); return; }
    const intMin = hhmmToMinutes(novoIntervalo);
    if (isNaN(intMin) || intMin < 0 || intMin > 480) { setUsuariosError('Intervalo inválido. Use o formato H:MM (ex: 1:00).'); return; }
    try {
      await adminApi.createUsuario(novoPin, novoNome, minutos, intMin);
      setNovoPin(''); setNovoNome(''); setNovoHoras(escalaPadrao); setNovoIntervalo(intervaloPadrao);
      await loadUsuarios();
    } catch (e) { setUsuariosError(e instanceof Error ? e.message : 'Erro'); }
  };

  const toggleSelectUsuario = (pin: string) =>
    setSelectedUsuarios((prev) => { const n = new Set(prev); n.has(pin) ? n.delete(pin) : n.add(pin); return n; });

  const allUsuariosSelected = usuarios.length > 0 && selectedUsuarios.size === usuarios.length;
  const toggleAllUsuarios = () =>
    setSelectedUsuarios(allUsuariosSelected ? new Set() : new Set(usuarios.map((u) => u.pin)));

  const handleBulkJornada = async () => {
    const minutos = hhmmToMinutes(bulkHoras);
    if (isNaN(minutos) || minutos < 60 || minutos > 1440) return;
    if (!confirm(`Alterar jornada de ${selectedUsuarios.size} funcionário(s) para ${minutesToHHMM(minutos)}?`)) return;
    setBulkLoading(true);
    try {
      await adminApi.bulkUpdateJornada([...selectedUsuarios], minutos);
      setUsuarios((prev) => prev.map((u) => selectedUsuarios.has(u.pin) ? { ...u, horas_diarias: minutos } : u));
      setSelectedUsuarios(new Set());
    } catch (e) { setUsuariosError(e instanceof Error ? e.message : 'Erro ao atualizar'); }
    finally { setBulkLoading(false); }
  };

  const handleBulkIntervalo = async () => {
    const minutos = hhmmToMinutes(bulkIntervalo);
    if (isNaN(minutos) || minutos < 0 || minutos > 480) return;
    if (!confirm(`Alterar intervalo de ${selectedUsuarios.size} funcionário(s) para ${minutesToHHMM(minutos)}?`)) return;
    setBulkLoading(true);
    try {
      await adminApi.bulkUpdateIntervalo([...selectedUsuarios], minutos);
      setUsuarios((prev) => prev.map((u) => selectedUsuarios.has(u.pin) ? { ...u, intervalo: minutos } : u));
      setSelectedUsuarios(new Set());
    } catch (e) { setUsuariosError(e instanceof Error ? e.message : 'Erro ao atualizar'); }
    finally { setBulkLoading(false); }
  };

  const handleSaveEscala = async () => {
    setEscalaError(''); setEscalaMsg('');
    const minEscala = hhmmToMinutes(escalaPadrao);
    const minIntervalo = hhmmToMinutes(intervaloPadrao);
    if (isNaN(minEscala) || minEscala < 60 || minEscala > 1440) { setEscalaError('Jornada inválida. Use o formato H:MM (ex: 7:20).'); return; }
    if (isNaN(minIntervalo) || minIntervalo < 0 || minIntervalo > 480) { setEscalaError('Intervalo inválido. Use o formato H:MM (ex: 1:00).'); return; }
    try {
      await adminApi.setEscala(minEscala, minIntervalo);
      setNovoHoras(escalaPadrao);
      setBulkHoras(escalaPadrao);
      setEscalaMsg('Configurações salvas com sucesso!');
    } catch { setEscalaError('Erro ao salvar configurações.'); }
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
    setRelDataAll((prev) => prev.map((r) => relSelected.has(r.id) ? { ...r, oculto: true } : r));
    setRelSelected(new Set());
  };

  const handleRestoreRegistro = async (id: number) => {
    await adminApi.restoreRegistro(id);
    setRelDataAll((prev) => prev.map((r) => r.id === id ? { ...r, oculto: false } : r));
  };

  const selectedOcultos = [...relSelected].filter((id) => relDataAll.find((r) => r.id === id)?.oculto);

  const handleRestoreSelected = async () => {
    if (!confirm(`Desocultar ${selectedOcultos.length} registro(s)?`)) return;
    await Promise.all(selectedOcultos.map((id) => adminApi.restoreRegistro(id).catch(() => {})));
    setRelDataAll((prev) => prev.map((r) => selectedOcultos.includes(r.id) ? { ...r, oculto: false } : r));
    setRelSelected(new Set());
  };

  const handleFieldEdit = async (id: number, field: TimeField, apiVal: string | null) => {
    await adminApi.updateRegistro(id, { [field]: apiVal });
    setRelDataAll((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const u = { ...r, [field]: apiVal };
      u.completo = !!(u.hora_inicial && u.inicio_intervalo && u.fim_intervalo && u.hora_final);
      return u;
    }));
  };

  const handleExtraToggle = async (id: number, currentVal: boolean) => {
    const nextVal = !currentVal;
    // Otimistic update
    setRelDataAll((prev) => prev.map((r) => r.id === id ? { ...r, extra: nextVal } : r));
    try {
      await adminApi.updateRegistro(id, { extra: nextVal });
    } catch (e) {
      alert('Erro ao atualizar Extra');
      // Revert if error
      setRelDataAll((prev) => prev.map((r) => r.id === id ? { ...r, extra: currentVal } : r));
    }
  };

  const exportCSV = (registros: RegistroAdmin[], prefix = 'relatorio') => {
    const header = 'Data,Funcionário,PIN,Entrada,Início Intervalo,Fim Intervalo,Saída,Horas Trabalhadas,Extra,Status\n';
    const rows = registros.map((r) =>
      [r.data, r.nome, r.pin, r.hora_inicial || '', r.inicio_intervalo || '',
       r.fim_intervalo || '', r.hora_final || '', calcWorkTime(r),
       r.extra ? 'Sim' : 'Não',
       r.completo ? 'Completo' : 'Incompleto'].join(',')
    ).join('\n');
    const blob = new Blob(['﻿' + header + rows], { type: 'text/csv;charset=utf-8;' });
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

  const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'dashboard', label: 'Dashboard',
      icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
      </svg>,
    },
    {
      id: 'usuarios', label: 'Funcionários',
      icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>,
    },
    {
      id: 'relatorio', label: 'Relatório',
      icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        <line x1="10" y1="9" x2="8" y2="9"/>
      </svg>,
    },
    {
      id: 'configuracoes', label: 'Configurações',
      icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>,
    },
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
          <div className="admin-sidebar-brand-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="admin-sidebar-brand-text">
            <span className="admin-sidebar-brand-name">Ponto Digital</span>
            <span className="admin-sidebar-brand-sub">Painel Admin</span>
          </div>
        </div>

        <nav className="admin-nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`admin-nav-btn${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="admin-nav-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <button className="admin-logout-btn" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Sair da conta
          </button>
        </div>
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
                    { label: 'Registros', value: dashData.stats.total, color: 'var(--status-primary)' },
                    { label: 'Presentes', value: dashData.stats.presentes, color: 'var(--status-success)' },
                    { label: 'Em Intervalo', value: dashData.stats.emIntervalo, color: 'var(--status-warning)' },
                    { label: 'Saíram', value: dashData.stats.saiu, color: 'var(--status-danger)' },
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
                            {(['hora_inicial', 'inicio_intervalo', 'fim_intervalo', 'hora_final'] as const).map((f) => (
                              <td key={f}>
                                {r[f]
                                  ? <span className="dash-time" title={localTimestamp(r[f])}>{displayTime(r[f])}</span>
                                  : '—'}
                              </td>
                            ))}
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
                  <label className="input-label">PIN (4-6 dígitos)</label>
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
                <div className="input-group">
                  <label className="input-label">Jornada (h:mm)</label>
                  <input type="text" pattern="\d+:[0-5]\d" placeholder="7:20"
                    value={novoHoras} onChange={(e) => setNovoHoras(e.target.value)}
                    className="text-input" style={{ width: '100%' }} />
                </div>
                <div className="input-group">
                  <label className="input-label">Intervalo (h:mm)</label>
                  <input type="text" pattern="\d+:[0-5]\d" placeholder="1:00"
                    value={novoIntervalo} onChange={(e) => setNovoIntervalo(e.target.value)}
                    className="text-input" style={{ width: '100%' }} />
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
                {selectedUsuarios.size > 0 && (
                  <div className="bulk-jornada-bar">
                    <span className="bulk-jornada-info">
                      {selectedUsuarios.size} selecionado{selectedUsuarios.size > 1 ? 's' : ''}
                    </span>
                    <div className="bulk-jornada-controls">
                      <label className="bulk-jornada-label">Jornada</label>
                      <input
                        type="text" pattern="\d+:[0-5]\d" placeholder="7:20"
                        className="bulk-jornada-input"
                        value={bulkHoras}
                        onChange={(e) => setBulkHoras(e.target.value)}
                      />
                      <span className="bulk-jornada-unit">h:mm</span>
                      <button className="bulk-jornada-btn" onClick={handleBulkJornada} disabled={bulkLoading}>
                        {bulkLoading ? <span className="spinner" /> : 'Aplicar'}
                      </button>
                      <span className="bulk-jornada-divider" />
                      <label className="bulk-jornada-label">Intervalo</label>
                      <input
                        type="text" pattern="\d+:[0-5]\d" placeholder="1:00"
                        className="bulk-jornada-input"
                        value={bulkIntervalo}
                        onChange={(e) => setBulkIntervalo(e.target.value)}
                      />
                      <span className="bulk-jornada-unit">h:mm</span>
                      <button className="bulk-jornada-btn" style={{ background: '#d97706' }} onClick={handleBulkIntervalo} disabled={bulkLoading}>
                        {bulkLoading ? <span className="spinner" /> : 'Aplicar'}
                      </button>
                    </div>
                  </div>
                )}
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>
                        <input type="checkbox" className="rel-checkbox"
                          checked={allUsuariosSelected} onChange={toggleAllUsuarios} />
                      </th>
                      <th>Nome</th><th>PIN</th><th>Horas Diárias</th><th>Intervalo</th><th>Status</th><th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((u) => (
                      <tr key={u.pin} className={selectedUsuarios.has(u.pin) ? 'rel-row--selected' : ''}>
                        <td>
                          <input type="checkbox" className="rel-checkbox"
                            checked={selectedUsuarios.has(u.pin)}
                            onChange={() => toggleSelectUsuario(u.pin)} />
                        </td>
                        <td className="td-nome">{u.nome}</td>
                        <td><code>{u.pin}</code></td>
                        <td>
                          <span className="jornada-badge">{minutesToHHMM(u.horas_diarias ?? 440)}</span>
                        </td>
                        <td>
                          <span className="jornada-badge" style={{ background: 'rgba(217,119,6,0.1)', color: '#d97706', borderColor: 'rgba(217,119,6,0.25)' }}>
                            {minutesToHHMM(u.intervalo ?? 60)}
                          </span>
                        </td>
                        <td>
                          <button
                            className={`status-toggle ${u.ativo ? 'status-toggle--on' : 'status-toggle--off'}`}
                            onClick={() => handleToggleAtivo(u)}
                            title={u.ativo ? 'Desativar' : 'Ativar'}
                          >
                            <span className="status-toggle-knob" />
                          </button>
                        </td>
                        <td>
                          <div className="action-btns">
                            <button className="icon-btn icon-btn--edit"
                              onClick={() => setEditingUsuario(u)} title="Editar">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button className="icon-btn icon-btn--delete"
                              onClick={() => handleDeleteUsuario(u.pin)} title="Remover">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M10 11v6M14 11v6"/>
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                              </svg>
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
            {showAddModal && (
              <AddRegistroModal
                onClose={() => setShowAddModal(false)}
                onSaved={() => { if (relDataAll.length > 0) handleRelatorio(); }}
              />
            )}
            <div className="admin-section-header">
              <h2>Relatório</h2>
              <button className="btn-novo-registro" onClick={() => setShowAddModal(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Novo Registro
              </button>
            </div>

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
                    {selectedOcultos.length > 0 && (
                      <button className="btn-restore btn-restore--bulk" onClick={handleRestoreSelected}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                          <path d="M3 3v5h5"/>
                        </svg>
                        Desocultar {selectedOcultos.length} selecionado{selectedOcultos.length > 1 ? 's' : ''}
                      </button>
                    )}
                    {relSelected.size > 0 && relSelected.size > selectedOcultos.length && (
                      <button className="btn-delete-selected" onClick={handleHideSelected}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                        Ocultar {relSelected.size - selectedOcultos.length} selecionado{relSelected.size - selectedOcultos.length > 1 ? 's' : ''}
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
                        <th>Data</th><th>Funcionário</th><th>Entrada</th><th>Iníc. Int.</th><th>Fim Int.</th><th>Saída</th><th>Trabalhado</th><th>Extra</th><th>Status</th><th></th>
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
                          {(['hora_inicial', 'inicio_intervalo', 'fim_intervalo', 'hora_final'] as TimeField[]).map((field) => (
                            <td key={field}>
                              <TimeCell
                                value={r[field]}
                                onSave={(v) => handleFieldEdit(r.id, field, v)}
                              />
                            </td>
                          ))}
                          <td><strong>{calcWorkTime(r)}</strong></td>
                          <td>
                            <input 
                              type="checkbox" 
                              className="rel-checkbox"
                              checked={!!r.extra} 
                              onChange={() => handleExtraToggle(r.id, !!r.extra)} 
                            />
                          </td>
                          <td><StatusBadge reg={r} /></td>
                          <td>
                            {r.oculto && (
                              <button className="btn-restore" onClick={() => handleRestoreRegistro(r.id)} title="Restaurar">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                                  <path d="M3 3v5h5"/>
                                </svg>
                                Restaurar
                              </button>
                            )}
                          </td>
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

            <div className="config-tabs" style={{ display: 'flex', gap: 16, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
              <button 
                style={{ background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', color: configTab === 'escala' ? 'var(--status-primary)' : 'var(--text-muted)', borderBottom: configTab === 'escala' ? '2px solid var(--status-primary)' : '2px solid transparent', transition: 'all 0.2s' }}
                onClick={() => setConfigTab('escala')}
              >
                Escala
              </button>
              <button 
                style={{ background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', color: configTab === 'senha' ? 'var(--status-primary)' : 'var(--text-muted)', borderBottom: configTab === 'senha' ? '2px solid var(--status-primary)' : '2px solid transparent', transition: 'all 0.2s' }}
                onClick={() => setConfigTab('senha')}
              >
                Senha
              </button>
            </div>

            {configTab === 'escala' && (
              <div className="admin-card" style={{ maxWidth: 440 }}>
                <h3 className="admin-card-title">Escala Padrão</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                  Jornada padrão aplicada ao cadastrar novos funcionários. Use o formato <strong>H:MM</strong> (ex: 7:20).
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="input-group">
                    <label className="input-label">Jornada padrão (H:MM)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="text" pattern="\d+:[0-5]\d" placeholder="7:20"
                        className="text-input" style={{ width: 100 }}
                        value={escalaPadrao}
                        onChange={(e) => { setEscalaPadrao(e.target.value); setEscalaMsg(''); setEscalaError(''); }}
                      />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>h:mm</span>
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Intervalo padrão (H:MM)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="text" pattern="\d+:[0-5]\d" placeholder="1:00"
                        className="text-input" style={{ width: 100 }}
                        value={intervaloPadrao}
                        onChange={(e) => { setIntervaloPadrao(e.target.value); setEscalaMsg(''); setEscalaError(''); }}
                      />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>h:mm</span>
                    </div>
                  </div>
                </div>
                {escalaError && <p className="error-msg" style={{ marginTop: 8 }}>{escalaError}</p>}
                {escalaMsg && <p style={{ color: 'var(--success)', marginTop: 8, fontWeight: 600 }}>{escalaMsg}</p>}
                <button className="confirm-btn" style={{ marginTop: 16 }} onClick={handleSaveEscala}>
                  Salvar Escala
                </button>
              </div>
            )}

            {configTab === 'senha' && (
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
            )}
          </div>
        )}
      </main>
    </div>
  );
}
