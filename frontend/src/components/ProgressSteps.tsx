import type { TipoRegistro, Registro } from '../types';
import { STEP_ORDER, STEP_LABELS } from '../types';

interface ProgressStepsProps {
  registro: Registro | null;
  proximaEtapa: TipoRegistro | null;
}

export function ProgressSteps({ registro, proximaEtapa }: ProgressStepsProps) {
  const getStepValue = (step: TipoRegistro): string | null => {
    if (!registro) return null;
    return registro[step];
  };

  const getStepStatus = (step: TipoRegistro): 'done' | 'active' | 'pending' => {
    const value = getStepValue(step);
    if (value) return 'done';
    if (step === proximaEtapa) return 'active';
    return 'pending';
  };

  return (
    <div className="progress-steps">
      {STEP_ORDER.map((step, index) => {
        const status = getStepStatus(step);
        const value = getStepValue(step);

        return (
          <div key={step} className={`step step--${status}`}>
            <div className="step-indicator">
              <div className="step-circle">
                {status === 'done' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              {index < STEP_ORDER.length - 1 && (
                <div className={`step-line ${status === 'done' ? 'step-line--done' : ''}`} />
              )}
            </div>
            <div className="step-info">
              <span className="step-label">{STEP_LABELS[step]}</span>
              {value && <span className="step-time">{value}</span>}
              {status === 'active' && !value && (
                <span className="step-next">Próximo</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
