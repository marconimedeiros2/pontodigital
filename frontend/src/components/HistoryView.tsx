import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { Registro } from '../types';
import { STEP_LABELS } from '../types';

interface HistoryViewProps {
  onBack: () => void;
}

const STEP_KEYS = ['hora_inicial', 'inicio_intervalo', 'fim_intervalo', 'hora_final'] as const;

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Extracts "HH:MM" from "HH:MM:SS" or "YYYY-MM-DD HH:MM:SS"
function extractTime(val: string): string {
  const timePart = val.includes(' ') ? val.split(' ')[1] : val;
  return timePart.substring(0, 5);
}

// Returns "DD/MM" if the step date differs from the session date
function stepDateTag(val: string, sessionDate: string): string | null {
  if (!val.includes(' ')) return null;
  const stepDate = val.split(' ')[0];
  if (stepDate === sessionDate) return null;
  const [, m, d] = stepDate.split('-');
  return `${d}/${m}`;
}

function toMinutes(val: string): number {
  const timePart = val.includes(' ') ? val.split(' ')[1] : val;
  const [h, m] = timePart.split(':').map(Number);
  return h * 60 + m;
}

// For cross-midnight durations we also factor in the date difference
function toAbsoluteMinutes(val: string): number {
  if (!val.includes(' ')) return toMinutes(val);
  const [datePart, timePart] = val.split(' ');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, m] = timePart.split(':').map(Number);
  return new Date(y, mo - 1, d, h, m).getTime() / 60000;
}

function calcWorkTime(reg: Registro): string {
  if (!reg.hora_inicial || !reg.hora_final) return '-';
  const total = toAbsoluteMinutes(reg.hora_final) - toAbsoluteMinutes(reg.hora_inicial);
  const interval = reg.inicio_intervalo && reg.fim_intervalo
    ? toAbsoluteMinutes(reg.fim_intervalo) - toAbsoluteMinutes(reg.inicio_intervalo)
    : 0;
  const worked = total - interval;
  if (worked < 0) return '-';
  const h = Math.floor(worked / 60);
  const m = Math.round(worked % 60);
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export function HistoryView({ onBack }: HistoryViewProps) {
  const [pin, setPin] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchHistory = useCallback(async (p: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getHistorico(p);
      setRegistros(data.registros);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pin) fetchHistory(pin);
  }, [pin, fetchHistory]);

  const handleSearch = () => {
    if (/^\d{1,10}$/.test(pinInput)) {
      setPin(pinInput);
    } else {
      setError('PIN deve conter apenas números (1-10 dígitos)');
    }
  };

  const exportCSV = () => {
    const header = 'Data,Entrada,Início Intervalo,Fim Intervalo,Saída,Horas Trabalhadas\n';
    const rows = registros.map((r) =>
      [
        r.data,
        r.hora_inicial ? extractTime(r.hora_inicial) : '',
        r.inicio_intervalo ? extractTime(r.inicio_intervalo) : '',
        r.fim_intervalo ? extractTime(r.fim_intervalo) : '',
        r.hora_final ? extractTime(r.hora_final) : '',
        calcWorkTime(r),
      ].join(',')
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ponto_${pin}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="history-view">
      <div className="history-header">
        <button className="back-btn" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5m0 0l7-7m-7 7l7 7" />
          </svg>
          Voltar
        </button>
        <h2>Histórico de Pontos</h2>
      </div>

      <div className="history-search">
        <div className="search-row">
          <input
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={10}
            placeholder="Digite seu PIN"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="search-input"
          />
          <button className="search-btn" onClick={handleSearch}>
            Buscar
          </button>
        </div>
        {error && <p className="error-msg">{error}</p>}
      </div>

      {loading && (
        <div className="history-loading">
          <div className="spinner spinner--large" />
          <p>Carregando...</p>
        </div>
      )}

      {!loading && pin && registros.length === 0 && (
        <div className="history-empty">
          <span>📋</span>
          <p>Nenhum registro encontrado para este PIN.</p>
        </div>
      )}

      {!loading && registros.length > 0 && (
        <>
          <div className="history-actions">
            <span className="history-count">{registros.length} registros</span>
            <button className="export-btn" onClick={exportCSV}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Exportar CSV
            </button>
          </div>

          <div className="history-list">
            {registros.map((reg) => (
              <div key={reg.id} className={`history-card ${reg.completo ? 'history-card--complete' : 'history-card--incomplete'}`}>
                <div className="history-card-header">
                  <span className="history-date">{formatDate(reg.data)}</span>
                  <span className={`history-badge ${reg.completo ? 'badge--complete' : 'badge--incomplete'}`}>
                    {reg.completo ? '✓ Completo' : '⏳ Incompleto'}
                  </span>
                </div>

                <div className="history-times">
                  {STEP_KEYS.map((key) => {
                    const val = reg[key];
                    const tag = val ? stepDateTag(val, reg.data) : null;
                    return (
                      <div key={key} className={`history-time-item ${val ? 'filled' : 'empty'}`}>
                        <span className="time-label">{STEP_LABELS[key]}</span>
                        <span className="time-value">
                          {val ? extractTime(val) : '--:--'}
                          {tag && <small className="time-date-tag">{tag}</small>}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="history-worked">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>Trabalhado: <strong>{calcWorkTime(reg)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
