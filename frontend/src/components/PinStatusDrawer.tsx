import { useEffect } from 'react';
import type { HojeResponse, Registro } from '../types';
import { STEP_ORDER, STEP_LABELS } from '../types';

const STEP_KEYS = ['hora_inicial', 'inicio_intervalo', 'fim_intervalo', 'hora_final'] as const;

function extractTime(val: string): string {
  const timePart = val.includes(' ') ? val.split(' ')[1] : val;
  const [h, m] = timePart.split(':').map(Number);
  const local = ((h - 3) + 24) % 24;
  return `${String(local).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDate(d: string): string {
  const [y, m, day] = d.split('-');
  return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: '2-digit',
  });
}

function toAbsMin(val: string): number {
  if (!val.includes(' ')) {
    const [h, m] = val.split(':').map(Number);
    return h * 60 + m;
  }
  const [dp, tp] = val.split(' ');
  const [y, mo, d] = dp.split('-').map(Number);
  const [h, m] = tp.split(':').map(Number);
  return new Date(y, mo - 1, d, h, m).getTime() / 60000;
}

function calcWork(reg: Registro): string {
  if (!reg.hora_inicial || !reg.hora_final) return '—';
  const total = toAbsMin(reg.hora_final) - toAbsMin(reg.hora_inicial);
  const intv = reg.inicio_intervalo && reg.fim_intervalo
    ? toAbsMin(reg.fim_intervalo) - toAbsMin(reg.inicio_intervalo) : 0;
  const w = total - intv;
  if (w < 0) return '—';
  return `${Math.floor(w / 60)}h${String(Math.round(w % 60)).padStart(2, '0')}`;
}

const STEP_COLORS: Record<string, string> = {
  hora_inicial:      '#16a34a',
  inicio_intervalo:  '#d97706',
  fim_intervalo:     '#2563eb',
  hora_final:        '#dc2626',
};

interface Props {
  pin: string;
  loading: boolean;
  hoje: HojeResponse | null;
  historico: Registro[];
  error: string;
  onClose: () => void;
}

export function PinStatusDrawer({ pin, loading, hoje, historico, error, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const reg = hoje?.registro ?? null;
  const proxima = hoje?.proximaEtapa ?? null;

  return (
    <div className="psd-overlay" onClick={onClose}>
      <div className="psd-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="psd-handle" />

        <div className="psd-header">
          <div>
            <p className="psd-label">PIN</p>
            <code className="psd-pin">{pin}</code>
          </div>
          <button className="psd-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {loading && (
          <div className="psd-loading">
            <span className="spinner spinner--large" />
            <p>Carregando...</p>
          </div>
        )}

        {!loading && error && (
          <div className="error-banner" style={{ margin: '16px 0' }}>{error}</div>
        )}

        {!loading && hoje && (
          <>
            {/* ── Jornada atual ── */}
            <section className="psd-section">
              <h3 className="psd-section-title">Jornada de Hoje</h3>
              <div className="psd-steps">
                {STEP_ORDER.map((key) => {
                  const val = reg ? reg[key] : null;
                  const isCurrent = proxima === key;
                  const done = !!val;
                  return (
                    <div key={key} className={`psd-step ${done ? 'psd-step--done' : isCurrent ? 'psd-step--current' : 'psd-step--pending'}`}>
                      <div className="psd-step-dot" style={{ background: done ? STEP_COLORS[key] : undefined }} />
                      <div className="psd-step-body">
                        <span className="psd-step-label">{STEP_LABELS[key]}</span>
                        <span className="psd-step-time">{val ? extractTime(val) : isCurrent ? 'Pendente' : '—'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {hoje.cicloCompleto && (
                <p className="psd-complete">✨ Jornada completa!</p>
              )}
            </section>

            {/* ── Histórico últimos 10 dias ── */}
            <section className="psd-section">
              <h3 className="psd-section-title">Últimos {historico.length} registros</h3>
              {historico.length === 0 ? (
                <p className="psd-empty">Nenhum registro encontrado.</p>
              ) : (
                <div className="psd-history">
                  {historico.map((r) => (
                    <div key={r.id} className={`psd-record ${r.completo ? 'psd-record--complete' : ''}`}>
                      <div className="psd-record-top">
                        <span className="psd-record-date">{formatDate(r.data)}</span>
                        <span className="psd-record-work">{calcWork(r)}</span>
                      </div>
                      <div className="psd-record-times">
                        {STEP_KEYS.map((key) => (
                          <div key={key} className={`psd-rtime ${r[key] ? 'psd-rtime--filled' : ''}`}>
                            <span className="psd-rtime-label">{STEP_LABELS[key].split(' ')[0]}</span>
                            <span className="psd-rtime-val">{r[key] ? extractTime(r[key]!) : '--:--'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
