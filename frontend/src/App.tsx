import { useState, useEffect, useCallback } from 'react';
import { Clock } from './components/Clock';
import { PinDisplay } from './components/PinDisplay';
import { NumericKeypad } from './components/NumericKeypad';
// import { ProgressSteps } from './components/ProgressSteps';
import { SuccessModal } from './components/SuccessModal';
import { HistoryView } from './components/HistoryView';
import { AdminDashboard } from './components/AdminDashboard';
import { PinStatusDrawer } from './components/PinStatusDrawer';
import { ContadorLogin } from './components/ContadorLogin';
import { ContadorDashboard } from './components/ContadorDashboard';
import GodApp from './components/GodApp';
import { getSubdomain } from './utils/tenant';
import { api } from './services/api';
import { adminApi } from './services/adminApi';
import { contadorApi } from './services/contadorApi';
import type { View, TipoRegistro, Registro, RegistroResponse, HojeResponse } from './types';
import { STEP_LABELS } from './types';

function ContadorApp() {
  const [nome, setNome] = useState(() => contadorApi.getNome());
  const [loggedIn, setLoggedIn] = useState(() => contadorApi.hasToken());
  if (!loggedIn) {
    return (
      <ContadorLogin
        onLogin={(n) => { setNome(n); setLoggedIn(true); }}
      />
    );
  }
  return (
    <ContadorDashboard
      nome={nome}
      onLogout={() => { contadorApi.clearSession(); setLoggedIn(false); }}
    />
  );
}

export default function App() {
  // Subdomínio "god" → painel GOD
  if (getSubdomain() === 'god') return <GodApp />;
  // Subdomínio "contador" → área do contador
  if (getSubdomain() === 'contador') return <ContadorApp />;
  const [view, setView] = useState<View>(() => {
    if (adminApi.hasToken()) return 'admin';
    if (contadorApi.hasToken()) return 'contador';
    return 'home';
  });
  const [contadorNome, setContadorNome] = useState(() => contadorApi.getNome());
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<RegistroResponse | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  // const [registro, setRegistro] = useState<Registro | null>(null);
  const [proximaEtapa, setProximaEtapa] = useState<TipoRegistro | null>(null);

  // Status drawer
  const [showStatus, setShowStatus] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusHoje, setStatusHoje] = useState<HojeResponse | null>(null);
  const [statusHistorico, setStatusHistorico] = useState<Registro[]>([]);
  const [statusPin, setStatusPin] = useState('');
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (view !== 'home' || loading) return;
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      else if (e.key === 'Backspace') handleBackspace();
      else if (e.key === 'Enter') handleConfirm();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleDigit = (d: string) => {
    if (pin.length >= 6) { triggerShake(); return; }
    setPin((p) => p + d);
    setError('');
  };

  const handleBackspace = () => {
    setPin((p) => p.slice(0, -1));
    setError('');
  };

  const handleConfirm = useCallback(async () => {
    if (pin.length < 4 || loading) return;
    setLoading(true);
    setError('');

    try {
      // Tenta login de admin/membro primeiro — silencioso se falhar
      try {
        const { token, role, nome } = await adminApi.login(pin);
        adminApi.saveToken(token);
        adminApi.saveRole(role);
        adminApi.saveNome(nome);
        setPin('');
        setView('admin');
        return;
      } catch {
        // Não é o PIN de admin/membro, segue para registro de ponto
      }

      // Registro de ponto normal
      try {
        const result = await api.registrar(pin);
        if (result.error) { setError(result.error); triggerShake(); setPin(''); return; }
        setSuccess(result);
        // setRegistro(null);
        setProximaEtapa(result.proximaEtapa);
        setPin('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao conectar com o servidor');
        triggerShake();
        setPin('');
      }
    } finally {
      setLoading(false);
    }
  }, [pin, loading]);

  const handleSuccessClose = () => {
    setSuccess(null);
    // setRegistro(null);
    setProximaEtapa(null);
  };

  const handleShowStatus = async () => {
    if (pin.length < 4) return;
    setStatusPin(pin);
    setStatusError('');
    setStatusHoje(null);
    setStatusHistorico([]);
    setShowStatus(true);
    setStatusLoading(true);
    try {
      const [hoje, hist] = await Promise.all([
        api.getHoje(pin),
        api.getHistorico(pin),
      ]);
      setStatusHoje(hoje);
      setStatusHistorico(hist.registros.slice(0, 10));
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : 'Erro ao carregar dados');
    } finally {
      setStatusLoading(false);
    }
  };

  if (view === 'admin') {
    return (
      <div className="app" data-theme={darkMode ? 'dark' : 'light'}>
        <AdminDashboard onLogout={() => { adminApi.clearToken(); setView('home'); }} />
      </div>
    );
  }

  if (view === 'contador') {
    if (!contadorApi.hasToken()) {
      return (
        <ContadorLogin
          onLogin={(nome) => { setContadorNome(nome); setView('contador'); }}
          onBack={() => setView('home')}
        />
      );
    }
    return (
      <ContadorDashboard
        nome={contadorNome}
        onLogout={() => { contadorApi.clearSession(); setView('home'); }}
      />
    );
  }

  if (view === 'history') {
    return (
      <div className="app">
        <HistoryView onBack={() => setView('home')} />
      </div>
    );
  }

  return (
    <div className="app">
      {success && <SuccessModal result={success} onClose={handleSuccessClose} />}
      {showStatus && (
        <PinStatusDrawer
          pin={statusPin}
          loading={statusLoading}
          hoje={statusHoje}
          historico={statusHistorico}
          error={statusError}
          onClose={() => setShowStatus(false)}
        />
      )}

      <header className="app-header">
        <div className="header-brand">
          <img src="/favicon.png" width="28" height="28" alt="tempu" style={{borderRadius: '6px'}} />
          <span>tempu</span>
        </div>
        <div className="header-actions">
          <button
            className="icon-btn"
            onClick={() => setView('contador')}
            title="Área do Contador"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>
          <button
            className="icon-btn"
            onClick={() => setDarkMode((d) => !d)}
            title={darkMode ? 'Modo claro' : 'Modo escuro'}
          >
            {darkMode ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <main className="app-main">
        <Clock />

        {proximaEtapa && (
          <div className="next-step-hint">
            Próximo registro: <strong>{STEP_LABELS[proximaEtapa]}</strong>
          </div>
        )}

        <div className="card">
          <PinDisplay filled={pin.length} shake={shake} />
          {error && (
            <div className="error-banner">
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
            minLength={4}
          />
          {pin.length >= 4 && (
            <button className="status-peek-btn" onClick={handleShowStatus}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Ver jornada e histórico
            </button>
          )}
        </div>

      </main>

      <footer className="app-footer">
        <p>Registros são salvos automaticamente</p>
      </footer>
    </div>
  );
}
