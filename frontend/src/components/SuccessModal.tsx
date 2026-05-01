import { useEffect } from 'react';
import type { RegistroResponse } from '../types';

interface SuccessModalProps {
  result: RegistroResponse;
  onClose: () => void;
}

const STEP_BG: Record<string, string> = {
  hora_inicial: '#16a34a',
  inicio_intervalo: '#d97706',
  fim_intervalo: '#2563eb',
  hora_final: '#dc2626',
};

const STEP_EMOJI: Record<string, string> = {
  hora_inicial: '🟢',
  inicio_intervalo: '🟡',
  fim_intervalo: '🔵',
  hora_final: '🔴',
};

export function SuccessModal({ result, onClose }: SuccessModalProps) {
  useEffect(() => {
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const color = STEP_BG[result.tipo] || '#2563eb';
  const emoji = STEP_EMOJI[result.tipo] || '✅';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        style={{ '--step-color': color } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-icon">{emoji}</div>
        <div className="modal-checkmark">
          <svg viewBox="0 0 52 52">
            <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
            <path className="checkmark-path" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
          </svg>
        </div>
        <h2 className="modal-title">Ponto Registrado!</h2>
        <div className="modal-step" style={{ background: color }}>
          {result.label}
        </div>
        <p className="modal-time">{result.horario}</p>
        {result.proximaEtapaLabel && (
          <p className="modal-next">
            Próximo: <strong>{result.proximaEtapaLabel}</strong>
          </p>
        )}
        {result.cicloCompleto && (
          <p className="modal-complete">✨ Jornada completa hoje!</p>
        )}
        <button className="modal-close" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}
