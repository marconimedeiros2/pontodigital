import { useState } from 'react';
import { contadorApi } from '../services/contadorApi';

interface Props {
  onLogin: (nome: string) => void;
  onBack: () => void;
}

export function ContadorLogin({ onLogin, onBack }: Props) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSenha, setShowSenha] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !senha) return;
    setLoading(true);
    setError('');
    try {
      const { token, nome } = await contadorApi.login(email.trim(), senha);
      contadorApi.saveToken(token);
      contadorApi.saveNome(nome);
      onLogin(nome);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cnt-login-wrap">
      <div className="cnt-login-card">
        <button className="cnt-back-btn" onClick={onBack} title="Voltar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Voltar
        </button>

        <div className="cnt-login-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>

        <h1 className="cnt-login-title">Área do Contador</h1>
        <p className="cnt-login-sub">Acesse os registros dos seus clientes</p>

        <form className="cnt-login-form" onSubmit={handleSubmit}>
          <div className="cnt-field">
            <label className="cnt-label" htmlFor="cnt-email">E-mail</label>
            <input
              id="cnt-email"
              className="cnt-input"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="contador@exemplo.com"
              autoComplete="email"
              disabled={loading}
              required
            />
          </div>

          <div className="cnt-field">
            <label className="cnt-label" htmlFor="cnt-senha">Senha</label>
            <div className="cnt-input-wrap">
              <input
                id="cnt-senha"
                className="cnt-input"
                type={showSenha ? 'text' : 'password'}
                value={senha}
                onChange={(e) => { setSenha(e.target.value); setError(''); }}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
                required
              />
              <button
                type="button"
                className="cnt-eye-btn"
                onClick={() => setShowSenha((v) => !v)}
                tabIndex={-1}
              >
                {showSenha ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
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

          <button className="cnt-submit-btn" type="submit" disabled={loading || !email.trim() || !senha}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
