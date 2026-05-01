import { useState } from 'react';
import { adminApi } from '../services/adminApi';
import { PinDisplay } from './PinDisplay';
import { NumericKeypad } from './NumericKeypad';

interface AdminLoginProps {
  onSuccess: () => void;
  onBack: () => void;
}

const MIN_PIN = 4;
const MAX_PIN = 6;

export function AdminLogin({ onSuccess, onBack }: AdminLoginProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleDigit = (d: string) => {
    if (pin.length >= MAX_PIN) { triggerShake(); return; }
    setPin((p) => p + d);
    setError('');
  };

  const handleBackspace = () => {
    setPin((p) => p.slice(0, -1));
    setError('');
  };

  const handleConfirm = async () => {
    if (pin.length < MIN_PIN || loading) return;

    setLoading(true);
    setError('');
    try {
      const { token } = await adminApi.login(pin);
      adminApi.saveToken(token);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PIN incorreto');
      triggerShake();
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-wrap">
      <div className="admin-login-card">
        <button className="back-btn" onClick={onBack} style={{ marginBottom: 20 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5m0 0l7-7m-7 7l7 7" />
          </svg>
          Voltar
        </button>

        <div className="admin-login-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>

        <h1 className="admin-login-title">Área Administrativa</h1>
        <p className="admin-login-subtitle">Digite o PIN de acesso</p>

        <PinDisplay filled={pin.length} shake={shake} />

        {error && (
          <div className="error-banner" style={{ marginBottom: 8, marginTop: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <NumericKeypad
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          onConfirm={handleConfirm}
          disabled={loading}
          pinLength={pin.length}
          minLength={MIN_PIN}
        />
      </div>
    </div>
  );
}
