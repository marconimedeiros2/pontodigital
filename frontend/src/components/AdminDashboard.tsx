import React, { useState, useEffect, useCallback, useRef } from 'react';
import { adminApi, type RegistroAdmin, type DashboardStats, type Usuario, type RegistroLog, type CustomField, type ApiKey } from '../services/adminApi';
import { STEP_LABELS } from '../types';
import { exportToXlsx } from '../utils/exportXlsx';

type AdminTab = 'dashboard' | 'usuarios' | 'relatorio' | 'configuracoes';

// ── Column Filter Types ────────────────────────────────────────────────────────
type ColType = 'string' | 'time' | 'date' | 'boolean' | 'select' | 'number';

interface ColSpec {
  key: string;
  label: string;
  colType: ColType;
  tipo: 'default' | 'custom';
  fieldId?: number;
  options?: { label: string; value: string }[];
}

interface FilterDef {
  id: string;
  colKey: string;
  tipo: 'default' | 'custom';
  fieldId?: number;
  operador: string;
  valor: string;
  valor2?: string;
  colLabel: string;
  colType: ColType;
  options?: { label: string; value: string }[];
}

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
    
    if (minFim < minInic) {
      const wrapped = minFim + 24 * 60 - minInic;
      // intervalo > 8h = dados inconsistentes (início/fim invertidos)
      if (wrapped > 480) return '—';
      totalInterval = wrapped;
    } else {
      totalInterval = minFim - minInic;
    }
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

/** Converte "HH:MM" ou "YYYY-MM-DD HH:MM:SS" → minutos desde meia-noite */
function timeToMin(t: string | null): number | null {
  if (!t) return null;
  const part = t.includes(' ') ? t.split(' ')[1] : t;
  const [h, m] = part.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/** Formata minutos → "HHh MM min" (ex: 7h 20 min) */
function minToHuman(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m} min`;
}

function hhmmToMinutes(str: string): number {
  const [h, m] = str.split(':').map(Number);
  if (isNaN(h) || isNaN(m) || m < 0 || m > 59) return NaN;
  return h * 60 + m;
}

// ── Column Filter Constants & Helpers ─────────────────────────────────────────

const OPERATORS_BY_TYPE: Record<ColType, { value: string; label: string }[]> = {
  string:  [{ value: 'contains', label: 'Contém' }, { value: 'equals', label: 'Igual a' }, { value: 'starts_with', label: 'Começa com' }],
  time:    [{ value: 'equals', label: 'Igual a' }, { value: 'before', label: 'Antes de' }, { value: 'after', label: 'Depois de' }],
  date:    [{ value: 'equals', label: 'Igual a' }, { value: 'before', label: 'Antes de' }, { value: 'after', label: 'Depois de' }, { value: 'between', label: 'Entre' }],
  boolean: [{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }],
  select:  [{ value: 'equals', label: 'Igual a' }, { value: 'not_equals', label: 'Diferente de' }],
  number:  [{ value: 'equals', label: 'Igual a' }, { value: 'greater', label: 'Maior que' }, { value: 'less', label: 'Menor que' }, { value: 'between', label: 'Entre' }],
};

const DEFAULT_COL_SPECS: ColSpec[] = [
  { key: 'nome',             label: 'Funcionário',  colType: 'string', tipo: 'default' },
  { key: 'data',             label: 'Data',         colType: 'date',   tipo: 'default' },
  { key: 'hora_inicial',     label: 'Entrada',      colType: 'time',   tipo: 'default' },
  { key: 'inicio_intervalo', label: 'Iníc. Int.',   colType: 'time',   tipo: 'default' },
  { key: 'fim_intervalo',    label: 'Fim Int.',      colType: 'time',   tipo: 'default' },
  { key: 'hora_final',       label: 'Saída',        colType: 'time',   tipo: 'default' },
  {
    key: 'status', label: 'Status', colType: 'select', tipo: 'default',
    options: [
      { label: 'Entrada',             value: 'Entrada'             },
      { label: 'Início do Intervalo', value: 'Início do Intervalo' },
      { label: 'Fim do Intervalo',    value: 'Fim do Intervalo'    },
      { label: 'Saída',               value: 'Saída'               },
      { label: 'Ausente',             value: 'Ausente'             },
    ],
  },
];

function getStatusValue(reg: RegistroAdmin): string {
  if (reg.hora_final)                             return 'Saída';
  if (reg.fim_intervalo)                          return 'Fim do Intervalo';
  if (reg.inicio_intervalo && !reg.fim_intervalo) return 'Início do Intervalo';
  if (reg.hora_inicial)                           return 'Entrada';
  return 'Ausente';
}

function matchesFilter(rawVal: string, f: FilterDef): boolean {
  const val = rawVal;
  const fv  = f.valor;
  switch (f.operador) {
    case 'contains':    return val.toLowerCase().includes(fv.toLowerCase());
    case 'equals':      return val.toLowerCase() === fv.toLowerCase();
    case 'not_equals':  return val.toLowerCase() !== fv.toLowerCase();
    case 'starts_with': return val.toLowerCase().startsWith(fv.toLowerCase());
    case 'before':      return val !== '' && val < fv;
    case 'after':       return val !== '' && val > fv;
    case 'between':     return val !== '' && val >= fv && val <= (f.valor2 ?? fv);
    case 'greater':     return Number(val) > Number(fv);
    case 'less':        return Number(val) < Number(fv);
    case 'true':        return val === 'true' || val === '1';
    case 'false':       return val === 'false' || val === '0' || val === '';
    default:            return true;
  }
}

function applyColFilters(
  records: RegistroAdmin[],
  filters: FilterDef[],
  customVals: Record<number, Record<number, string>>
): RegistroAdmin[] {
  if (filters.length === 0) return records;
  return records.filter((r) =>
    filters.every((f) => {
      let rawVal = '';
      if (f.tipo === 'custom' && f.fieldId !== undefined) {
        rawVal = customVals[r.id]?.[f.fieldId] ?? '';
      } else {
        switch (f.colKey) {
          case 'nome':             rawVal = r.nome;                                                      break;
          case 'data':             rawVal = r.data;                                                      break;
          case 'hora_inicial':     rawVal = r.hora_inicial     ? displayTime(r.hora_inicial)     : '';  break;
          case 'inicio_intervalo': rawVal = r.inicio_intervalo ? displayTime(r.inicio_intervalo) : '';  break;
          case 'fim_intervalo':    rawVal = r.fim_intervalo    ? displayTime(r.fim_intervalo)    : '';  break;
          case 'hora_final':       rawVal = r.hora_final       ? displayTime(r.hora_final)       : '';  break;
          case 'status':           rawVal = getStatusValue(r);                                          break;
        }
      }
      return matchesFilter(rawVal, f);
    })
  );
}

// ── FilterPanel Component ──────────────────────────────────────────────────────

interface FilterPanelProps {
  colSpecs: ColSpec[];
  activeFilters: FilterDef[];
  onAdd: (f: FilterDef) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

function FilterPanel({ colSpecs, activeFilters, onAdd, onRemove, onClear }: FilterPanelProps) {
  const firstSpec = colSpecs[0];
  const [open, setOpen] = useState(false);
  const [draftCol, setDraftCol] = useState(firstSpec?.key ?? 'nome');
  const [draftOp, setDraftOp] = useState(
    firstSpec ? OPERATORS_BY_TYPE[firstSpec.colType][0].value : 'contains'
  );
  const [draftVal, setDraftVal] = useState('');
  const [draftVal2, setDraftVal2] = useState('');

  const spec = colSpecs.find((s) => s.key === draftCol) ?? firstSpec;
  const ops = spec ? OPERATORS_BY_TYPE[spec.colType] : [];
  const isBool = spec?.colType === 'boolean';
  const needBetween = draftOp === 'between';

  const handleColChange = (key: string) => {
    setDraftCol(key);
    const s = colSpecs.find((c) => c.key === key);
    if (s) {
      setDraftOp(OPERATORS_BY_TYPE[s.colType][0].value);
      setDraftVal('');
      setDraftVal2('');
    }
  };

  const handleAdd = () => {
    if (!spec) return;
    if (spec.colType !== 'boolean' && !draftVal) return;
    onAdd({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      colKey: draftCol,
      tipo: spec.tipo,
      fieldId: spec.fieldId,
      operador: draftOp,
      valor: draftVal,
      valor2: needBetween && draftVal2 ? draftVal2 : undefined,
      colLabel: spec.label,
      colType: spec.colType,
      options: spec.options,
    });
    setDraftVal('');
    setDraftVal2('');
  };

  const chipText = (f: FilterDef) => {
    if (f.colType === 'boolean') {
      return `${f.colLabel}: ${f.operador === 'true' ? 'Sim' : 'Não'}`;
    }
    const opLabel = OPERATORS_BY_TYPE[f.colType].find((o) => o.value === f.operador)?.label?.toLowerCase() ?? f.operador;
    const valLabel = f.options?.find((o) => o.value === f.valor)?.label ?? f.valor;
    const val2Label = f.valor2 ? (f.options?.find((o) => o.value === f.valor2)?.label ?? f.valor2) : '';
    const valStr = val2Label ? `${valLabel} – ${val2Label}` : valLabel;
    return `${f.colLabel} ${opLabel} "${valStr}"`;
  };

  return (
    <div className="filter-bar">
      <div className="filter-bar__top">
        <button
          className={`filter-toggle-btn${activeFilters.length > 0 ? ' filter-toggle-btn--active' : ''}`}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          Filtros
          {activeFilters.length > 0 && (
            <span className="filter-toggle-badge">{activeFilters.length}</span>
          )}
        </button>

        {activeFilters.map((f) => (
          <span key={f.id} className="filter-chip">
            <span className="filter-chip__text">{chipText(f)}</span>
            <button className="filter-chip__remove" onClick={() => onRemove(f.id)} title="Remover filtro">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </span>
        ))}

        {activeFilters.length > 0 && (
          <button className="filter-clear-btn" onClick={onClear}>Limpar todos</button>
        )}
      </div>

      {open && (
        <div className="filter-panel">
          <div className="filter-panel__row">
            {/* Column selector */}
            <div className="filter-panel__group">
              <label className="filter-panel__label">Coluna</label>
              <select
                className="filter-panel__select"
                value={draftCol}
                onChange={(e) => handleColChange(e.target.value)}
              >
                {colSpecs.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Operator selector (boolean uses operator as value) */}
            <div className="filter-panel__group">
              <label className="filter-panel__label">{isBool ? 'Valor' : 'Operador'}</label>
              <select
                className="filter-panel__select"
                value={draftOp}
                onChange={(e) => { setDraftOp(e.target.value); setDraftVal2(''); }}
              >
                {ops.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Value input (hidden for boolean since operator IS the value) */}
            {!isBool && (
              <div className="filter-panel__group filter-panel__group--val">
                <label className="filter-panel__label">{needBetween ? 'De' : 'Valor'}</label>
                {spec?.colType === 'select' && spec.options ? (
                  <select className="filter-panel__select" value={draftVal} onChange={(e) => setDraftVal(e.target.value)}>
                    <option value="">— selecione —</option>
                    {spec.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : spec?.colType === 'date' ? (
                  <input type="date" className="filter-panel__input" value={draftVal} onChange={(e) => setDraftVal(e.target.value)} />
                ) : spec?.colType === 'time' ? (
                  <input type="time" className="filter-panel__input" value={draftVal} onChange={(e) => setDraftVal(e.target.value)} />
                ) : spec?.colType === 'number' ? (
                  <input type="number" className="filter-panel__input" value={draftVal} onChange={(e) => setDraftVal(e.target.value)} />
                ) : (
                  <input
                    type="text"
                    className="filter-panel__input"
                    value={draftVal}
                    onChange={(e) => setDraftVal(e.target.value)}
                    placeholder="Valor..."
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                  />
                )}
              </div>
            )}

            {/* Between: second value */}
            {needBetween && (
              <div className="filter-panel__group filter-panel__group--val">
                <label className="filter-panel__label">Até</label>
                {spec?.colType === 'date' ? (
                  <input type="date" className="filter-panel__input" value={draftVal2} onChange={(e) => setDraftVal2(e.target.value)} />
                ) : spec?.colType === 'time' ? (
                  <input type="time" className="filter-panel__input" value={draftVal2} onChange={(e) => setDraftVal2(e.target.value)} />
                ) : (
                  <input type="number" className="filter-panel__input" value={draftVal2} onChange={(e) => setDraftVal2(e.target.value)} />
                )}
              </div>
            )}

            {/* Add button */}
            <div className="filter-panel__group filter-panel__group--btn">
              <label className="filter-panel__label">&nbsp;</label>
              <button
                className="filter-panel__add"
                onClick={handleAdd}
                disabled={!isBool && !draftVal}
              >
                + Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ reg }: { reg: RegistroAdmin }) {
  if (reg.hora_final)                                    return <span className="badge badge--saiu">Saída</span>;
  if (reg.fim_intervalo)                                 return <span className="badge badge--presente">Fim do Intervalo</span>;
  if (reg.inicio_intervalo && !reg.fim_intervalo)        return <span className="badge badge--intervalo">Início do Intervalo</span>;
  if (reg.hora_inicial)                                  return <span className="badge badge--presente">Entrada</span>;
  return <span className="badge badge--ausente">Ausente</span>;
}

const FIELD_LABELS: Record<string, string> = {
  hora_inicial: 'Entrada',
  inicio_intervalo: 'Iníc. Int.',
  fim_intervalo: 'Fim Int.',
  hora_final: 'Saída',
  oculto: 'Oculto',
  extra: 'Extra',
};

function formatLogValue(campo: string, valor: string | null): string {
  if (valor === null || valor === '') return '—';
  if (campo === 'oculto' || campo === 'extra') return valor === 'true' ? 'Sim' : 'Não';
  // timestamps: "2024-01-15 08:00:00" → "08:00"
  const timeMatch = valor.match(/(\d{2}:\d{2})(?::\d{2})?$/);
  return timeMatch ? timeMatch[1] : valor;
}

function formatLogDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

type LogFiltro = 'todos' | 'default' | 'custom';

function LogsModal({ registroId, nomeFuncionario, onClose }: {
  registroId: number;
  nomeFuncionario: string;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<RegistroLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState<LogFiltro>('todos');

  useEffect(() => {
    adminApi.getLogs(registroId)
      .then((r) => setLogs(r.logs))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [registroId]);

  const filtered = filtro === 'todos' ? logs : logs.filter((l) => (l.tipo ?? 'default') === filtro);
  const countDefault = logs.filter((l) => (l.tipo ?? 'default') === 'default').length;
  const countCustom  = logs.filter((l) => l.tipo === 'custom').length;

  const campoLabel = (log: RegistroLog) =>
    log.tipo === 'custom' ? log.campo : (FIELD_LABELS[log.campo] ?? log.campo);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box logs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Histórico de alterações</h3>
          <span className="logs-modal__subtitle">{nomeFuncionario} — Registro #{registroId}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {!loading && logs.length > 0 && (
          <div className="logs-filter">
            {([
              ['todos',   'Todos',               logs.length],
              ['default', 'Campos padrão',        countDefault],
              ['custom',  'Campos personalizados', countCustom],
            ] as [LogFiltro, string, number][]).map(([val, label, cnt]) => (
              <button
                key={val}
                className={`logs-filter-btn${filtro === val ? ' logs-filter-btn--active' : ''}`}
                onClick={() => setFiltro(val)}
              >
                {label} <span className="logs-filter-count">{cnt}</span>
              </button>
            ))}
          </div>
        )}

        <div className="logs-modal__body">
          {loading && <div className="admin-empty">Carregando...</div>}
          {error && <div className="admin-empty" style={{ color: 'var(--danger)' }}>{error}</div>}
          {!loading && !error && filtered.length === 0 && (
            <div className="admin-empty">Nenhuma alteração {filtro !== 'todos' ? 'neste filtro' : 'registrada'}.</div>
          )}
          {!loading && filtered.length > 0 && (
            <ul className="logs-list">
              {filtered.map((log) => (
                <li key={log.id} className={`log-entry${log.tipo === 'custom' ? ' log-entry--custom' : ''}`}>
                  <div className="log-entry__main">
                    <span className="log-entry__campo">{campoLabel(log)}</span>
                    {log.tipo === 'custom' && (
                      <span className="log-entry__badge">personalizado</span>
                    )}
                    {' alterado de '}
                    <span className="log-entry__valor log-entry__valor--old">
                      {formatLogValue(log.campo, log.valor_anterior)}
                    </span>
                    {' para '}
                    <span className="log-entry__valor log-entry__valor--new">
                      {formatLogValue(log.campo, log.valor_novo)}
                    </span>
                  </div>
                  <div className="log-entry__meta">
                    {formatLogDate(log.alterado_em)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Custom Field Input ────────────────────────────────────────────────────────

function CustomFieldInput({ field, value, onSave, rowKey }: {
  field: CustomField;
  value: string;
  onSave: (v: string) => void;
  rowKey: number;
}) {
  const [local, setLocal] = React.useState(value);
  React.useEffect(() => { setLocal(value); }, [value]);
  const save = () => { if (local !== value) onSave(local); };

  // Checkbox/boolean → botão ✅/❌ clicável
  if (field.input_type === 'checkbox') {
    const checked = local === 'true';
    return (
      <button className={`cf-bool-toggle${checked ? ' cf-bool-toggle--on' : ' cf-bool-toggle--off'}`}
        title={checked ? 'Sim — clique para alterar' : 'Não — clique para alterar'}
        onClick={() => { const v = checked ? 'false' : 'true'; setLocal(v); onSave(v); }}>
        {checked
          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        }
      </button>
    );
  }

  // Select → dropdown mostrando labels
  if (field.input_type === 'select') {
    return (
      <select className="cf-select" value={local}
        onChange={(e) => { setLocal(e.target.value); onSave(e.target.value); }}>
        <option value="">—</option>
        {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  // Radio → botões inline
  if (field.input_type === 'radio') {
    return (
      <div className="cf-radio-group">
        {(field.options ?? []).map((o) => (
          <label key={o.value} className="cf-radio-label">
            <input type="radio" name={`cf-${field.id}-${rowKey}`}
              value={o.value} checked={local === o.value}
              onChange={() => { setLocal(o.value); onSave(o.value); }}
            />
            {o.label}
          </label>
        ))}
      </div>
    );
  }

  if (field.input_type === 'textarea') {
    return (
      <textarea className="cf-textarea" value={local} rows={2} placeholder="—"
        onChange={(e) => setLocal(e.target.value)} onBlur={save} />
    );
  }

  const inputType = field.input_type === 'datepicker' ? 'date'
    : field.input_type === 'timepicker' ? 'time'
    : field.input_type === 'number' ? 'number'
    : 'text';
  return (
    <input type={inputType} className="cf-input" value={local} placeholder="—"
      onChange={(e) => setLocal(e.target.value)} onBlur={save} />
  );
}

// ── Custom Field Form Modal ───────────────────────────────────────────────────

const CF_TIPOS = [
  { value: 'string', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'boolean', label: 'Booleano' },
  { value: 'date', label: 'Data' },
  { value: 'time', label: 'Hora' },
];

const CF_INPUTS: { value: string; label: string; tipos: string[] }[] = [
  { value: 'text',        label: 'Campo de texto',   tipos: ['string'] },
  { value: 'textarea',    label: 'Área de texto',    tipos: ['string'] },
  { value: 'number',      label: 'Número',           tipos: ['number'] },
  { value: 'checkbox',    label: 'Checkbox',         tipos: ['boolean'] },
  { value: 'select',      label: 'Dropdown',         tipos: ['string', 'number'] },
  { value: 'radio',       label: 'Radio',            tipos: ['string', 'number'] },
  { value: 'datepicker',  label: 'Seletor de data',  tipos: ['date'] },
  { value: 'timepicker',  label: 'Seletor de hora',  tipos: ['time'] },
];

function CustomFieldFormModal({ field, onClose, onSaved }: {
  field: CustomField | null;
  onClose: () => void;
  onSaved: (f: CustomField) => void;
}) {
  const [nome, setNome] = useState(field?.nome ?? '');
  const [tipo, setTipo] = useState(field?.tipo ?? 'string');
  const [inputType, setInputType] = useState(field?.input_type ?? 'text');
  const [required, setRequired] = useState(field?.required ?? false);
  const [valorPadrao, setValorPadrao] = useState(field?.valor_padrao ?? '');
  const [options, setOptions] = useState<{ label: string; value: string }[]>(field?.options ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const availableInputs = CF_INPUTS.filter((i) => i.tipos.includes(tipo));
  const needsOptions = inputType === 'select' || inputType === 'radio';

  const handleTipoChange = (t: string) => {
    setTipo(t);
    const first = CF_INPUTS.find((i) => i.tipos.includes(t));
    if (first) setInputType(first.value);
  };

  const addOption = () => setOptions((p) => [...p, { label: '', value: '' }]);
  const removeOption = (i: number) => setOptions((p) => p.filter((_, j) => j !== i));
  const updateOption = (i: number, key: 'label' | 'value', val: string) =>
    setOptions((p) => p.map((o, j) => j === i ? { ...o, [key]: val } : o));

  const handleSave = async () => {
    if (!nome.trim()) { setError('Nome é obrigatório.'); return; }
    if (needsOptions && options.filter((o) => o.label.trim()).length === 0) {
      setError('Adicione pelo menos uma opção.'); return;
    }
    setLoading(true); setError('');
    try {
      const payload = {
        nome: nome.trim(), tipo, input_type: inputType,
        options: needsOptions ? options.filter((o) => o.label.trim()) : null,
        required, valor_padrao: valorPadrao || null,
        ordem: field?.ordem ?? 0, ativo: field?.ativo ?? true,
      };
      const r = field
        ? await adminApi.updateCustomField(field.id, payload)
        : await adminApi.createCustomField(payload);
      onSaved(r.field);
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box cf-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{field ? 'Editar Coluna' : 'Nova Coluna'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="cf-form-body">
          <div className="input-group">
            <label className="input-label">Nome da coluna</label>
            <input className="text-input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: Motivo da Falta" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group">
              <label className="input-label">Tipo de dado</label>
              <select className="text-input" value={tipo} onChange={(e) => handleTipoChange(e.target.value)}>
                {CF_TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Tipo de input</label>
              <select className="text-input" value={inputType} onChange={(e) => setInputType(e.target.value)}>
                {availableInputs.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
          </div>
          <div className="input-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="cf-required" checked={required} onChange={(e) => setRequired(e.target.checked)} />
            <label htmlFor="cf-required" className="input-label" style={{ margin: 0, cursor: 'pointer' }}>Campo obrigatório</label>
          </div>
          {!needsOptions && (
            <div className="input-group">
              <label className="input-label">Valor padrão (opcional)</label>
              <input className="text-input" value={valorPadrao} onChange={(e) => setValorPadrao(e.target.value)} placeholder="Deixe vazio para sem padrão" />
            </div>
          )}
          {needsOptions && (
            <div className="input-group">
              <label className="input-label">Opções</label>
              <div className="cf-options-list">
                {options.map((o, i) => (
                  <div key={i} className="cf-option-row">
                    <input className="text-input" placeholder="Rótulo" value={o.label}
                      onChange={(e) => {
                        const label = e.target.value;
                        const autoValue = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                        updateOption(i, 'label', label);
                        if (!o.value || o.value === options[i]?.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')) {
                          updateOption(i, 'value', autoValue);
                        }
                      }}
                    />
                    <input className="text-input" placeholder="Valor" value={o.value}
                      onChange={(e) => updateOption(i, 'value', e.target.value)} style={{ width: 110 }} />
                    <button className="btn-icon-danger" onClick={() => removeOption(i)} title="Remover">✕</button>
                  </div>
                ))}
                <button className="btn-add-option" onClick={addOption}>+ Adicionar opção</button>
              </div>
            </div>
          )}
          {error && <p className="error-msg">{error}</p>}
          <button className="confirm-btn" onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando…' : 'Salvar Coluna'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Custom Field Manager (aba de configurações) ───────────────────────────────

function CustomFieldManager({ fields, onChange }: {
  fields: CustomField[];
  onChange: (updated: CustomField[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CustomField | null>(null);

  const sorted = [...fields].sort((a, b) => a.ordem - b.ordem);

  const handleSaved = (f: CustomField) => {
    const exists = fields.find((x) => x.id === f.id);
    onChange(exists ? fields.map((x) => x.id === f.id ? f : x) : [...fields, f]);
  };

  const handleToggleAtivo = async (f: CustomField) => {
    try {
      const r = await adminApi.updateCustomField(f.id, { ativo: !f.ativo });
      onChange(fields.map((x) => x.id === f.id ? r.field : x));
    } catch { /* ignore */ }
  };

  const handleDelete = async (f: CustomField) => {
    if (!confirm(`Remover a coluna "${f.nome}"? Os dados já salvos serão mantidos.`)) return;
    try {
      await adminApi.deleteCustomField(f.id);
      onChange(fields.filter((x) => x.id !== f.id));
    } catch { /* ignore */ }
  };

  const move = async (f: CustomField, dir: -1 | 1) => {
    const idx = sorted.findIndex((x) => x.id === f.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    try {
      await adminApi.reorderCustomFields([
        { id: f.id, ordem: swap.ordem },
        { id: swap.id, ordem: f.ordem },
      ]);
      onChange(fields.map((x) => {
        if (x.id === f.id) return { ...x, ordem: swap.ordem };
        if (x.id === swap.id) return { ...x, ordem: f.ordem };
        return x;
      }));
    } catch { /* ignore */ }
  };

  const inputLabel = (it: string) => CF_INPUTS.find((i) => i.value === it)?.label ?? it;
  const tipoLabel  = (t: string)  => CF_TIPOS.find((x) => x.value === t)?.label ?? t;

  return (
    <div className="admin-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 className="admin-card-title" style={{ margin: 0 }}>Colunas Personalizadas</h3>
        <button className="btn-novo-registro" onClick={() => { setShowForm(true); setEditing(null); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nova Coluna
        </button>
      </div>

      {sorted.length === 0 && (
        <div className="admin-empty">Nenhuma coluna criada ainda. Clique em "Nova Coluna" para começar.</div>
      )}

      {sorted.length > 0 && (
        <div className="cf-manager-list">
          {sorted.map((f, idx) => (
            <div key={f.id} className={`cf-manager-row${f.ativo ? '' : ' cf-manager-row--inactive'}`}>
              <div className="cf-manager-reorder">
                <button className="btn-icon" onClick={() => move(f, -1)} disabled={idx === 0} title="Mover para cima">▲</button>
                <button className="btn-icon" onClick={() => move(f, 1)} disabled={idx === sorted.length - 1} title="Mover para baixo">▼</button>
              </div>
              <div className="cf-manager-info">
                <span className="cf-manager-nome">{f.nome}</span>
                <span className="cf-manager-meta">{tipoLabel(f.tipo)} · {inputLabel(f.input_type)}{f.required ? ' · Obrigatório' : ''}</span>
                {f.options && f.options.length > 0 && (
                  <span className="cf-manager-opts">{f.options.map((o) => o.label).join(', ')}</span>
                )}
              </div>
              <div className="cf-manager-actions">
                <span className={`badge ${f.ativo ? 'badge--presente' : 'badge--ausente'}`}>{f.ativo ? 'Ativo' : 'Inativo'}</span>
                <button className="btn-icon" onClick={() => { setEditing(f); setShowForm(true); }} title="Editar">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button className="btn-icon" onClick={() => handleToggleAtivo(f)} title={f.ativo ? 'Desativar' : 'Ativar'}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {f.ativo
                      ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                    }
                  </svg>
                </button>
                <button className="btn-icon btn-icon--danger" onClick={() => handleDelete(f)} title="Remover">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <CustomFieldFormModal
          field={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
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

/** Retorna YYYY-MM-DD no fuso local, sem depender de UTC */
function localDateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

const today = localDateStr(0);

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

// ── IntegrationsTab ────────────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button className={`integ-copy-btn${copied ? ' integ-copy-btn--done' : ''}`} onClick={handle}>
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Copiado!
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

function maskKey(prefix: string): string {
  return `${prefix}${'•'.repeat(14)}`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function IntegrationsTab() {
  const [uuid, setUuid] = useState('');
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newKeyModal, setNewKeyModal] = useState<{ key: ApiKey; fullKey: string } | null>(null);
  const [revoking, setRevoking] = useState<number | null>(null);

  useEffect(() => {
    adminApi.getIntegrations()
      .then(({ uuid, keys }) => { setUuid(uuid); setKeys(keys); })
      .catch(() => setLoadError('Erro ao carregar integrações.'))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreateError('');
    setCreating(true);
    try {
      const result = await adminApi.createApiKey(newName.trim());
      setKeys((prev) => [result.key, ...prev]);
      setNewName('');
      setNewKeyModal(result);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Erro ao gerar chave.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: number) => {
    if (!confirm('Revogar esta API Key? A ação não pode ser desfeita.')) return;
    setRevoking(id);
    try {
      await adminApi.revokeApiKey(id);
      setKeys((prev) =>
        prev.map((k) => k.id === id ? { ...k, ativo: false, revoked_at: new Date().toISOString() } : k)
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao revogar.');
    } finally {
      setRevoking(null);
    }
  };

  if (loading) return <div className="admin-loading"><span className="spinner spinner--large" /></div>;
  if (loadError) return <div className="admin-empty" style={{ color: 'var(--danger, #e11d48)' }}>{loadError}</div>;

  const activeKeys = keys.filter((k) => k.ativo);
  const revokedKeys = keys.filter((k) => !k.ativo);

  return (
    <div className="integrations-tab">

      {/* ── Client UUID ── */}
      <div className="admin-card integ-section">
        <div className="integ-section-header">
          <div className="integ-section-icon integ-section-icon--uuid">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div>
            <h3 className="admin-card-title" style={{ marginBottom: 2 }}>Identificador do Cliente</h3>
            <p className="integ-section-desc">UUID único desta instalação. Use para identificar seu sistema em integrações.</p>
          </div>
        </div>
        <div className="integ-uuid-row">
          <code className="integ-uuid">{uuid}</code>
          <CopyButton text={uuid} />
        </div>
      </div>

      {/* ── API Keys ── */}
      <div className="admin-card integ-section" style={{ marginTop: 20 }}>
        <div className="integ-section-header">
          <div className="integ-section-icon integ-section-icon--key">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
            </svg>
          </div>
          <div>
            <h3 className="admin-card-title" style={{ marginBottom: 2 }}>API Keys</h3>
            <p className="integ-section-desc">Tokens de acesso para integrar sistemas externos. A chave completa é exibida <strong>apenas no momento da criação</strong>.</p>
          </div>
        </div>

        {/* Create form */}
        <div className="integ-create-row">
          <input
            type="text"
            className="text-input"
            placeholder='Nome da integração (ex: "Zapier", "n8n", "Webhook site")'
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setCreateError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            style={{ flex: 1 }}
          />
          <button
            className="confirm-btn"
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            style={{ whiteSpace: 'nowrap', minWidth: 140 }}
          >
            {creating ? <span className="spinner" /> : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Gerar chave
              </>
            )}
          </button>
        </div>
        {createError && <p className="error-msg" style={{ marginTop: 6 }}>{createError}</p>}

        {/* Active keys */}
        {activeKeys.length === 0 && revokedKeys.length === 0 ? (
          <div className="admin-empty" style={{ marginTop: 16 }}>
            Nenhuma API Key criada. Gere sua primeira chave acima.
          </div>
        ) : (
          <div className="integ-keys-list">
            {activeKeys.map((k) => (
              <div key={k.id} className="integ-key-row">
                <div className="integ-key-main">
                  <div className="integ-key-top">
                    <span className="integ-key-nome">{k.nome}</span>
                    <span className="integ-key-badge integ-key-badge--active">Ativa</span>
                  </div>
                  <code className="integ-key-prefix">{maskKey(k.key_prefix)}</code>
                  <div className="integ-key-meta">
                    <span>Criada em {fmtDateTime(k.created_at)}</span>
                    {k.last_used_at && (
                      <span>· Último uso {fmtDateTime(k.last_used_at)}</span>
                    )}
                    {!k.last_used_at && (
                      <span className="integ-key-meta--unused">· Nunca usada</span>
                    )}
                  </div>
                </div>
                <button
                  className="integ-revoke-btn"
                  onClick={() => handleRevoke(k.id)}
                  disabled={revoking === k.id}
                  title="Revogar esta chave"
                >
                  {revoking === k.id ? <span className="spinner" /> : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                      </svg>
                      Revogar
                    </>
                  )}
                </button>
              </div>
            ))}

            {/* Revoked keys (collapsed section) */}
            {revokedKeys.length > 0 && (
              <details className="integ-revoked-section">
                <summary className="integ-revoked-summary">
                  {revokedKeys.length} chave{revokedKeys.length > 1 ? 's' : ''} revogada{revokedKeys.length > 1 ? 's' : ''}
                </summary>
                {revokedKeys.map((k) => (
                  <div key={k.id} className="integ-key-row integ-key-row--revoked">
                    <div className="integ-key-main">
                      <div className="integ-key-top">
                        <span className="integ-key-nome">{k.nome}</span>
                        <span className="integ-key-badge integ-key-badge--revoked">Revogada</span>
                      </div>
                      <code className="integ-key-prefix">{maskKey(k.key_prefix)}</code>
                      <div className="integ-key-meta">
                        <span>Criada {fmtDateTime(k.created_at)}</span>
                        {k.revoked_at && <span>· Revogada {fmtDateTime(k.revoked_at)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </details>
            )}
          </div>
        )}
      </div>

      {/* ── New Key Modal ── */}
      {newKeyModal && (
        <div className="modal-overlay" onClick={() => setNewKeyModal(null)}>
          <div className="modal-box integ-newkey-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="integ-newkey-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                  </svg>
                </div>
                <h3>Nova API Key gerada</h3>
              </div>
              <button className="modal-close" onClick={() => setNewKeyModal(null)}>×</button>
            </div>

            <div className="integ-newkey-warn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Copie esta chave agora. Por segurança, ela <strong>não será exibida novamente</strong>.
            </div>

            <div className="integ-fullkey-box">
              <code className="integ-fullkey">{newKeyModal.fullKey}</code>
              <CopyButton text={newKeyModal.fullKey} label="Copiar chave" />
            </div>

            <div className="integ-newkey-info">
              <span><strong>Nome:</strong> {newKeyModal.key.nome}</span>
              <span><strong>Criada em:</strong> {fmtDateTime(newKeyModal.key.created_at)}</span>
            </div>

            <button
              className="confirm-btn"
              style={{ marginTop: 16, width: '100%', background: 'var(--keypad-btn-bg)', color: 'var(--text)', boxShadow: 'none', border: '1px solid var(--border)' }}
              onClick={() => setNewKeyModal(null)}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [showPins, setShowPins] = useState(false);

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
  const [logsModal, setLogsModal] = useState<{ id: number; nome: string } | null>(null);

  // Column filters
  const [activeFilters, setActiveFilters] = useState<FilterDef[]>([]);

  // Custom fields
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<number, Record<number, string>>>({});
  const activeCustomFields = customFields.filter((f) => f.ativo).sort((a, b) => a.ordem - b.ordem);

  // Build column spec list (standard + custom fields)
  const allColSpecs: ColSpec[] = [
    ...DEFAULT_COL_SPECS,
    ...activeCustomFields.map((f): ColSpec => ({
      key: `custom_${f.id}`,
      label: f.nome,
      colType: (
        f.input_type === 'checkbox' ? 'boolean' :
        f.input_type === 'number'   ? 'number'  :
        (f.input_type === 'select' || f.input_type === 'radio') ? 'select' :
        f.input_type === 'date'     ? 'date'    : 'string'
      ) as ColType,
      tipo: 'custom',
      fieldId: f.id,
      options: f.options?.map((o) => ({ label: o.label, value: o.value })) ?? undefined,
    })),
  ];

  const ocultosCount = relDataAll.filter((r) => r.oculto).length;
  const relDataBase = mostrarOcultos ? relDataAll : relDataAll.filter((r) => !r.oculto);
  const relData = applyColFilters(relDataBase, activeFilters, customValues);

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
  const [configTab, setConfigTab] = useState<'escala' | 'senha' | 'colunas' | 'integracoes'>('escala');

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const [dash, usersRes] = await Promise.all([
        adminApi.getDashboard(dashDate),
        adminApi.listUsuarios(),
      ]);
      setDashData({ registros: dash.registros, stats: dash.stats });
      setUsuarios(usersRes.usuarios);
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
  useEffect(() => { adminApi.listCustomFields(true).then((r) => setCustomFields(r.fields)).catch(() => {}); }, []);

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

  const handleRelatorio = async (iniOverride?: string, fimOverride?: string) => {
    const ini = iniOverride ?? relInicio;
    const fim = fimOverride ?? relFim;
    setRelLoading(true);
    setRelSelected(new Set());
    setMostrarOcultos(false);
    try {
      const data = await adminApi.getRelatorio(ini || undefined, fim || undefined, true);
      setRelDataAll(data.registros);
      if (data.registros.length > 0) {
        const ids = data.registros.map((r) => r.id);
        const cvData = await adminApi.getCustomValues(ids);
        const map: Record<number, Record<number, string>> = {};
        for (const cv of cvData.values) {
          if (!map[cv.registro_id]) map[cv.registro_id] = {};
          map[cv.registro_id][cv.field_id] = cv.value ?? '';
        }
        setCustomValues(map);
      } else {
        setCustomValues({});
      }
    } catch { /* ignore */ } finally { setRelLoading(false); }
  };

  const handleCustomValueSave = async (registroId: number, fieldId: number, value: string) => {
    setCustomValues((prev) => ({
      ...prev,
      [registroId]: { ...(prev[registroId] ?? {}), [fieldId]: value },
    }));
    try { await adminApi.upsertCustomValue(registroId, fieldId, value || null); } catch { /* ignore */ }
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
    const original = relDataAll.find((r) => r.id === id);
    const applyUpdate = (prev: RegistroAdmin[]) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const u = { ...r, [field]: apiVal };
        u.completo = !!(u.hora_inicial && u.inicio_intervalo && u.fim_intervalo && u.hora_final);
        return u;
      });
    setRelDataAll(applyUpdate);
    try {
      await adminApi.updateRegistro(id, { [field]: apiVal });
    } catch (e) {
      if (original) setRelDataAll((prev) => prev.map((r) => (r.id !== id ? r : original)));
      throw e;
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
      id: 'relatorio', label: 'Relatórios',
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
              onClick={() => {
                setTab(t.id);
                if (t.id === 'relatorio') {
                  const d = localDateStr(0);
                  setRelInicio(d);
                  setRelFim(d);
                  handleRelatorio(d, d);
                }
              }}
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
                <button
                  className={`dash-pin-toggle${showPins ? ' dash-pin-toggle--visible' : ''}`}
                  onClick={() => setShowPins((v) => !v)}
                  title={showPins ? 'Ocultar PINs' : 'Mostrar PINs'}
                >
                  {showPins ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  )}
                  {showPins ? 'Ocultar PINs' : 'Mostrar PINs'}
                </button>
                <input type="date" value={dashDate}
                  onChange={(e) => setDashDate(e.target.value)}
                  className="text-input" style={{ width: 160 }} />
                <button className="search-btn" onClick={loadDashboard}>Atualizar</button>
              </div>
            </div>

            {dashLoading && <div className="admin-loading"><span className="spinner spinner--large" /></div>}

            {dashData && !dashLoading && (() => {
              const { stats, registros } = dashData;
              const activeUsers = usuarios.filter((u) => u.ativo);
              const ausentesCount = Math.max(0, activeUsers.length - stats.total);

              // Horas trabalhadas (registros completos)
              const workedMins = registros.reduce((acc, r) => {
                const wt = calcWorkTime(r);
                if (wt === '—') return acc;
                const [h, m] = wt.split(':').map(Number);
                return acc + h * 60 + m;
              }, 0);

              // Média de entrada
              const entryMins = registros.map((r) => timeToMin(r.hora_inicial)).filter((v): v is number => v !== null);
              const avgEntryMin = entryMins.length > 0
                ? Math.round(entryMins.reduce((a, b) => a + b, 0) / entryMins.length) : null;
              const avgEntryStr = avgEntryMin !== null ? minutesToHHMM(avgEntryMin) : '—';

              // Primeiro a chegar
              const sorted = [...registros].filter((r) => r.hora_inicial)
                .sort((a, b) => (timeToMin(a.hora_inicial)! - timeToMin(b.hora_inicial)!));
              const firstIn = sorted[0] ?? null;

              // Mais horas trabalhadas
              const byWork = [...registros]
                .map((r) => ({ r, min: (() => { const wt = calcWorkTime(r); if (wt === '—') return -1; const [h, m] = wt.split(':').map(Number); return h * 60 + m; })() }))
                .filter((x) => x.min >= 0)
                .sort((a, b) => b.min - a.min);
              const topWorker = byWork[0] ?? null;

              // Barra de presença
              const total = stats.total || 1;
              const barSegments = [
                { pct: Math.round((stats.presentes / total) * 100), color: 'var(--status-success)', label: 'Presentes' },
                { pct: Math.round((stats.emIntervalo / total) * 100), color: 'var(--status-warning)', label: 'Intervalo' },
                { pct: Math.round((stats.saiu / total) * 100), color: 'var(--status-danger)', label: 'Saíram' },
              ];

              return (
                <>
                  {/* ── Stat cards ── */}
                  <div className="stats-grid dash-stats-grid">
                    {([
                      { label: 'Total do Dia', value: stats.total, accent: '#4a6cf7',
                        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
                      { label: 'Presentes', value: stats.presentes, accent: '#3b82f6',
                        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
                      { label: 'Em Intervalo', value: stats.emIntervalo, accent: '#6366f1',
                        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
                      { label: 'Saíram', value: stats.saiu, accent: '#818cf8',
                        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> },
                      { label: 'Dia Completo', value: stats.completos, accent: '#2563eb',
                        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> },
                      { label: 'Ausentes', value: ausentesCount, accent: '#93c5fd',
                        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><line x1="4" y1="4" x2="20" y2="20"/></svg> },
                    ] as { label: string; value: number; accent: string; icon: React.ReactNode }[]).map((s) => (
                      <div key={s.label} className="stat-card dash-stat-card" style={{ '--sc-accent': s.accent } as React.CSSProperties}>
                        <div className="stat-card-top">
                          <span className="dash-stat-icon">{s.icon}</span>
                          <span className="stat-value">{s.value}</span>
                        </div>
                        <span className="stat-label">{s.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* ── Barra de presença ── */}
                  {stats.total > 0 && (
                    <div className="dash-presence-card">
                      <div className="dash-presence-title">Distribuição de Presença</div>
                      <div className="dash-presence-bar">
                        {barSegments.map((seg) => (
                          seg.pct > 0 && (
                            <div
                              key={seg.label}
                              className="dash-presence-segment"
                              style={{ width: `${seg.pct}%`, background: seg.color }}
                              title={`${seg.label}: ${seg.pct}%`}
                            />
                          )
                        ))}
                      </div>
                      <div className="dash-presence-legend">
                        {barSegments.map((seg) => (
                          <div key={seg.label} className="dash-legend-item">
                            <span className="dash-legend-dot" style={{ background: seg.color }} />
                            <span>{seg.label}</span>
                            <strong>{seg.pct}%</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Métricas ── */}
                  <div className="dash-metrics-row">
                    <div className="dash-metric-card">
                      <span className="dash-metric-svg-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      </span>
                      <div className="dash-metric-body">
                        <span className="dash-metric-label">Total Horas Trabalhadas</span>
                        <span className="dash-metric-value">{workedMins > 0 ? minToHuman(workedMins) : '—'}</span>
                      </div>
                    </div>
                    <div className="dash-metric-card">
                      <span className="dash-metric-svg-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12"/><line x1="12" y1="12" x2="15" y2="9"/></svg>
                      </span>
                      <div className="dash-metric-body">
                        <span className="dash-metric-label">Média de Entrada</span>
                        <span className="dash-metric-value">{avgEntryStr}</span>
                      </div>
                    </div>
                    <div className="dash-metric-card">
                      <span className="dash-metric-svg-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
                      </span>
                      <div className="dash-metric-body">
                        <span className="dash-metric-label">Primeiro a Chegar</span>
                        <span className="dash-metric-value">
                          {firstIn ? `${firstIn.nome.split(' ')[0]} · ${displayTime(firstIn.hora_inicial)}` : '—'}
                        </span>
                      </div>
                    </div>
                    <div className="dash-metric-card">
                      <span className="dash-metric-svg-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                      </span>
                      <div className="dash-metric-body">
                        <span className="dash-metric-label">Mais Horas no Dia</span>
                        <span className="dash-metric-value">
                          {topWorker ? `${topWorker.r.nome.split(' ')[0]} · ${calcWorkTime(topWorker.r)}` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Tabela ── */}
                  {registros.length === 0 ? (
                    <div className="admin-empty">Nenhum registro nesta data.</div>
                  ) : (
                    <div className="admin-table-wrap">
                      <div className="admin-table-actions">
                        <span className="history-count">{registros.length} {registros.length === 1 ? 'registro' : 'registros'}</span>
                        <ExportButtons registros={registros} prefix={`ponto_${dashDate}`} />
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
                          {registros.map((r) => (
                            <tr key={r.id} className={`dash-row--${r.hora_final ? 'saiu' : r.fim_intervalo ? 'voltou' : r.inicio_intervalo ? 'intervalo' : 'presente'}`}>
                              <td className="td-nome">{r.nome}</td>
                              <td>
                                <code className={`dash-pin${showPins ? '' : ' dash-pin--hidden'}`}>
                                  {showPins ? r.pin : '••••'}
                                </code>
                              </td>
                              {(['hora_inicial', 'inicio_intervalo', 'fim_intervalo', 'hora_final'] as const).map((f) => (
                                <td key={f}>
                                  {r[f]
                                    ? <span className="dash-time" title={localTimestamp(r[f])}>{displayTime(r[f])}</span>
                                    : <span className="dash-missing">—</span>}
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
              );
            })()}
          </div>
        )}

        {/* ── USUÁRIOS ── */}
        {tab === 'usuarios' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Funcionários</h2>
              <button
                className={`dash-pin-toggle${showPins ? ' dash-pin-toggle--visible' : ''}`}
                onClick={() => setShowPins((v) => !v)}
                title={showPins ? 'Ocultar PINs' : 'Mostrar PINs'}
              >
                {showPins ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                )}
                {showPins ? 'Ocultar PINs' : 'Mostrar PINs'}
              </button>
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
                        <td>
                          <code className={`dash-pin${showPins ? '' : ' dash-pin--hidden'}`}>
                            {showPins ? u.pin : '••••'}
                          </code>
                        </td>
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
            {logsModal && (
              <LogsModal
                registroId={logsModal.id}
                nomeFuncionario={logsModal.nome}
                onClose={() => setLogsModal(null)}
              />
            )}
            <div className="admin-section-header">
              <h2>Relatórios</h2>
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
                  onClick={() => handleRelatorio()} disabled={relLoading}>
                  {relLoading ? <span className="spinner" /> : 'Buscar'}
                </button>
              </div>

              <div className="rel-quick-filters">
                {[
                  { label: 'Hoje',            startOff: 0,  endOff: 0  },
                  { label: 'Ontem',           startOff: 1,  endOff: 1  },
                  { label: 'Anteontem',       startOff: 2,  endOff: 2  },
                  { label: 'Últimos 7 dias',  startOff: 6,  endOff: 0  },
                  { label: 'Últimos 30 dias', startOff: 29, endOff: 0  },
                ].map(({ label, startOff, endOff }) => {
                  const startStr = localDateStr(startOff);
                  const endStr   = localDateStr(endOff);
                  const active   = relInicio === startStr && relFim === endStr;
                  return (
                    <button
                      key={label}
                      className={`rel-quick-btn${active ? ' rel-quick-btn--active' : ''}`}
                      onClick={() => {
                        setRelInicio(startStr);
                        setRelFim(endStr);
                        handleRelatorio(startStr, endStr);
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <FilterPanel
              colSpecs={allColSpecs}
              activeFilters={activeFilters}
              onAdd={(f) => setActiveFilters((prev) => [...prev, f])}
              onRemove={(id) => setActiveFilters((prev) => prev.filter((f) => f.id !== id))}
              onClear={() => setActiveFilters([])}
            />

            {relData.length > 0 && (
              <>
                <div className="admin-table-actions">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span className="history-count">
                      {relData.length} registro{relData.length !== 1 ? 's' : ''}
                      {activeFilters.length > 0 && relData.length !== relDataBase.length && (
                        <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>
                          (de {relDataBase.length})
                        </span>
                      )}
                    </span>
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
                        <th>Data</th><th>Funcionário</th><th>Entrada</th><th>Iníc. Int.</th><th>Fim Int.</th><th>Saída</th><th>Trabalhado</th>
                        {activeCustomFields.map((f) => <th key={f.id} title={f.nome}>{f.nome}</th>)}
                        <th>Status</th><th title="Histórico">Log</th><th></th>
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
                          {activeCustomFields.map((f) => (
                            <td key={f.id}>
                              <CustomFieldInput
                                field={f}
                                value={customValues[r.id]?.[f.id] ?? f.valor_padrao ?? ''}
                                onSave={(v) => handleCustomValueSave(r.id, f.id, v)}
                                rowKey={r.id}
                              />
                            </td>
                          ))}
                          <td><StatusBadge reg={r} /></td>
                          <td>
                            <button
                              className="btn-log-history"
                              title="Ver histórico de alterações"
                              onClick={() => setLogsModal({ id: r.id, nome: r.nome })}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                              </svg>
                            </button>
                          </td>
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

            {!relLoading && relData.length === 0 && relDataBase.length > 0 && activeFilters.length > 0 && (
              <div className="admin-empty">
                Nenhum registro corresponde aos filtros ativos.{' '}
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: 'inherit' }}
                  onClick={() => setActiveFilters([])}
                >
                  Limpar filtros
                </button>
              </div>
            )}
            {!relLoading && relData.length === 0 && relDataBase.length === 0 && relInicio && (
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
              <button
                style={{ background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', color: configTab === 'colunas' ? 'var(--status-primary)' : 'var(--text-muted)', borderBottom: configTab === 'colunas' ? '2px solid var(--status-primary)' : '2px solid transparent', transition: 'all 0.2s' }}
                onClick={() => setConfigTab('colunas')}
              >
                Colunas Personalizadas
              </button>
              <button
                style={{ background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', color: configTab === 'integracoes' ? 'var(--status-primary)' : 'var(--text-muted)', borderBottom: configTab === 'integracoes' ? '2px solid var(--status-primary)' : '2px solid transparent', transition: 'all 0.2s' }}
                onClick={() => setConfigTab('integracoes')}
              >
                Integrações
              </button>
            </div>

            {configTab === 'escala' && (
              <div className="admin-card">
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
              <div className="admin-card">
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

            {configTab === 'colunas' && (
              <CustomFieldManager
                fields={customFields}
                onChange={setCustomFields}
              />
            )}

            {configTab === 'integracoes' && <IntegrationsTab />}
          </div>
        )}
      </main>
    </div>
  );
}
