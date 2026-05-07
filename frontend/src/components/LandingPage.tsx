import { useState } from 'react';
import '../landing.css';

const FAQ_ITEMS = [
  {
    q: 'Preciso instalar algum aplicativo?',
    a: 'Não. O tempu funciona 100% no navegador, em qualquer dispositivo — computador, tablet ou celular. Sem instalação, sem configuração complicada.',
  },
  {
    q: 'Como os funcionários batem o ponto?',
    a: 'Cada funcionário recebe um PIN de 4 a 6 dígitos. Basta acessar a URL da empresa e digitar o PIN para registrar entrada, saída para almoço, retorno e saída final. É instantâneo.',
  },
  {
    q: 'O contador consegue acessar os relatórios?',
    a: 'Sim. Há uma área exclusiva para contadores onde eles podem visualizar e exportar relatórios em Excel de todos os funcionários de cada cliente conectado, sem precisar de acesso à conta da empresa.',
  },
  {
    q: 'O sistema funciona para mais de uma empresa?',
    a: 'Sim. A plataforma é multi-empresa: cada empresa recebe seu próprio subdomínio isolado, seus próprios funcionários e seus próprios relatórios. Ideal para grupos ou contadores que atendem vários clientes.',
  },
  {
    q: 'Posso exportar os registros?',
    a: 'Sim. Relatórios completos podem ser exportados em Excel (.xlsx) diretamente do painel administrativo ou da área do contador, com filtros de período.',
  },
  {
    q: 'Tem período de teste grátis?',
    a: 'Sim. Você começa sem cartão de crédito e experimenta todos os recursos por 14 dias completamente grátis. Só assina se gostar.',
  },
];

const TESTIMONIALS = [
  {
    stars: '★★★★★',
    text: 'Antes eu usava planilha e ficava um caos na hora de fechar a folha. Com o tempu o meu contador recebe tudo organizado e eu não preciso fazer nada. É impressionante como algo tão simples resolve tanto.',
    name: 'Carlos M.',
    role: 'Proprietário – Padaria São João',
    color: '#1d4ed8',
    initials: 'CM',
  },
  {
    stars: '★★★★★',
    text: 'Atendo 12 empresas diferentes e o tempu me poupa horas todo mês. Os relatórios saem prontos, no formato certo, sem precisar pedir nada para os clientes. Recomendo para qualquer escritório contábil.',
    name: 'Fernanda R.',
    role: 'Contadora – FR Contabilidade',
    color: '#7c3aed',
    initials: 'FR',
  },
  {
    stars: '★★★★★',
    text: 'Minha equipe aderiu imediatamente porque é muito fácil. Qualquer funcionário, mesmo sem experiência com tecnologia, bate o ponto em dois toques. Zero reclamação desde que implantamos.',
    name: 'Marcos T.',
    role: 'Gerente – Auto Peças Rápido',
    color: '#059669',
    initials: 'MT',
  },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lp-faq-item">
      <button className={`lp-faq-question${open ? ' open' : ''}`} onClick={() => setOpen(!open)}>
        {q}
        <svg className={`lp-faq-chevron${open ? ' open' : ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div className={`lp-faq-answer${open ? ' open' : ''}`}>{a}</div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="lp">
      {/* ── NAV ── */}
      <nav className="lp-nav">
        <a className="lp-nav-brand" href="#">
          <span className="lp-nav-brand-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </span>
          tempu
        </a>
        <div className="lp-nav-links">
          <button className="lp-nav-link" onClick={() => scrollTo('como-funciona')}>Como funciona</button>
          <button className="lp-nav-link" onClick={() => scrollTo('beneficios')}>Benefícios</button>
          <button className="lp-nav-link" onClick={() => scrollTo('contador')}>Para contadores</button>
          <button className="lp-nav-link" onClick={() => scrollTo('precos')}>Preços</button>
          <button className="lp-nav-link" onClick={() => scrollTo('faq')}>FAQ</button>
        </div>
        <button className="lp-nav-cta" onClick={() => scrollTo('precos')}>Começar grátis</button>
      </nav>

      {/* ── HERO ── */}
      <section style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 60%, #eff6ff 100%)' }}>
        <div className="lp-hero">
          <div className="lp-hero-content">
            <div className="lp-hero-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Ponto digital simples, sem papelada
            </div>
            <h1 className="lp-hero-headline">
              Controle de ponto<br />que <span>cabe na rotina</span><br />de qualquer empresa
            </h1>
            <p className="lp-hero-sub">
              Seus funcionários batem o ponto em segundos pelo celular ou computador. Você e seu contador acessam relatórios prontos, sem planilhas, sem burocracia.
            </p>
            <div className="lp-hero-actions">
              <button className="lp-btn-primary" onClick={() => scrollTo('precos')}>
                Testar grátis por 14 dias
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
              <button className="lp-btn-secondary" onClick={() => scrollTo('como-funciona')}>
                Ver como funciona
              </button>
            </div>
          </div>

          <div className="lp-hero-visual">
            {/* Dashboard mockup */}
            <div className="lp-mockup-dashboard">
              <div className="lp-mockup-bar">
                <div className="lp-mockup-bar-dots">
                  <div className="lp-mockup-bar-dot" />
                  <div className="lp-mockup-bar-dot" />
                  <div className="lp-mockup-bar-dot" />
                </div>
                <span className="lp-mockup-bar-title">tempu — painel administrativo</span>
              </div>
              <div className="lp-mockup-body">
                <div className="lp-mockup-stats">
                  <div className="lp-mockup-stat">
                    <div className="lp-mockup-stat-label">Funcionários</div>
                    <div className="lp-mockup-stat-val">12</div>
                  </div>
                  <div className="lp-mockup-stat">
                    <div className="lp-mockup-stat-label">Presentes hoje</div>
                    <div className="lp-mockup-stat-val green">9</div>
                  </div>
                  <div className="lp-mockup-stat">
                    <div className="lp-mockup-stat-label">Atrasos</div>
                    <div className="lp-mockup-stat-val orange">2</div>
                  </div>
                </div>
                {[
                  { name: 'Ana Souza', time: '08:03', status: 'ok', label: 'Presente' },
                  { name: 'Bruno Lima', time: '08:47', status: 'warn', label: 'Atraso' },
                  { name: 'Carla Dias', time: '08:01', status: 'ok', label: 'Presente' },
                  { name: 'Diego Santos', time: '—', status: 'blue', label: 'Folga' },
                ].map((r) => (
                  <div key={r.name} className="lp-mockup-row">
                    <span className="lp-mockup-row-name">{r.name}</span>
                    <span className="lp-mockup-row-time">{r.time}</span>
                    <span className={`lp-mockup-badge ${r.status}`}>{r.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Phone mockup */}
            <div className="lp-mockup-phone">
              <div className="lp-mockup-phone-time">08:47</div>
              <div className="lp-mockup-phone-grid">
                {['1','2','3','4','5','6','7','8','9','*','0','#'].map((k) => (
                  <div key={k} className="lp-mockup-phone-key">{k}</div>
                ))}
                <div className="lp-mockup-phone-btn">REGISTRAR</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF BAR ── */}
      <div className="lp-proof-bar">
        <div className="lp-proof-inner">
          {[
            { icon: '🏢', text: 'Funciona para qualquer segmento' },
            { icon: '📱', text: 'Sem app, abre no navegador' },
            { icon: '📊', text: 'Relatório exportável em Excel' },
            { icon: '🔐', text: 'Acesso por PIN, sem senha esquecida' },
            { icon: '⚡', text: 'Registro em menos de 5 segundos' },
          ].map((item, i) => (
            <span key={i} style={{ display: 'contents' }}>
              {i > 0 && <div className="lp-proof-divider" />}
              <div className="lp-proof-item">
                <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                {item.text}
              </div>
            </span>
          ))}
        </div>
      </div>

      {/* ── PROBLEM AGITATION ── */}
      <section className="lp-section lp-problem">
        <div className="lp-section-inner">
          <div className="lp-center">
            <div className="lp-section-tag">O problema</div>
            <h2 className="lp-section-title">Chega de controle de ponto <span>manual e caótico</span></h2>
            <p className="lp-section-sub">Se você ainda usa planilha, papel ou grupo de WhatsApp para controlar a jornada dos funcionários, sabe bem o tamanho da dor de cabeça.</p>
          </div>
          <div className="lp-problem-compare">
            <div className="lp-problem-side lp-problem-side--before">
              <div className="lp-problem-side-title">❌ Sem o tempu</div>
              {[
                'Funcionário manda "cheguei" no WhatsApp e você anota manualmente',
                'Planilhas bagunçadas, fórmulas erradas, dados perdidos',
                'Horas de trabalho extra no fechamento mensal',
                'Contador pede os dados com antecedência e você não tem tudo pronto',
                'Disputas sobre horários sem comprovação real',
                'Funcionários esquecem de registrar e o histórico fica incompleto',
              ].map((t, i) => (
                <div key={i} className="lp-problem-item">
                  <span className="lp-problem-item-icon" style={{ color: '#dc2626' }}>✕</span>
                  <span style={{ color: '#7f1d1d' }}>{t}</span>
                </div>
              ))}
            </div>
            <div className="lp-problem-side lp-problem-side--after">
              <div className="lp-problem-side-title">✓ Com o tempu</div>
              {[
                'Cada funcionário bate o ponto direto no sistema com seu PIN',
                'Tudo registrado com data, hora e tipo automáticos',
                'Fechamento mensal em minutos, com relatório pronto',
                'Contador acessa os dados diretamente, sem intermediários',
                'Histórico completo e auditável de cada colaborador',
                'Alertas e visão em tempo real de quem está presente',
              ].map((t, i) => (
                <div key={i} className="lp-problem-item">
                  <span className="lp-problem-item-icon" style={{ color: '#16a34a' }}>✓</span>
                  <span style={{ color: '#14532d' }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SOLUTION OVERVIEW ── */}
      <section className="lp-section lp-solution" id="como-funciona">
        <div className="lp-section-inner">
          <div className="lp-center">
            <div className="lp-section-tag">A solução</div>
            <h2 className="lp-section-title">Um sistema <span>completo e simples</span> para toda a cadeia</h2>
            <p className="lp-section-sub">O tempu conecta sua empresa, seus funcionários e seu contador em uma única plataforma. Cada parte acessa só o que precisa.</p>
          </div>
          <div className="lp-flow">
            {[
              {
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <path d="M3 9h18" />
                    <path d="M9 21V9" />
                  </svg>
                ),
                title: 'Empresa cadastra',
                sub: 'Cria sua conta, cadastra funcionários e distribui PINs',
              },
              {
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                ),
                title: 'Funcionário registra',
                sub: 'Digita o PIN e o ponto é registrado em segundos',
              },
              {
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                ),
                title: 'Gestor acompanha',
                sub: 'Painel em tempo real com presença, atrasos e histórico',
              },
              {
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                ),
                title: 'Contador exporta',
                sub: 'Acessa relatórios de todos os clientes e exporta em Excel',
              },
            ].map((step, i, arr) => (
              <span key={i} style={{ display: 'contents' }}>
                <div className="lp-flow-step">
                  <div className="lp-flow-icon">{step.icon}</div>
                  <div className="lp-flow-step-title">{step.title}</div>
                  <div className="lp-flow-step-sub">{step.sub}</div>
                </div>
                {i < arr.length - 1 && <div className="lp-flow-arrow">→</div>}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section className="lp-section lp-benefits" id="beneficios">
        <div className="lp-section-inner">
          <div className="lp-center">
            <div className="lp-section-tag">Benefícios</div>
            <h2 className="lp-section-title">Tudo que você precisa, <span>nada do que não precisa</span></h2>
            <p className="lp-section-sub">Desenvolvido para pequenas e médias empresas que querem controle real sem complicação.</p>
          </div>
          <div className="lp-benefits-grid">
            {[
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                ),
                title: 'Registro em segundos',
                text: 'O funcionário digita o PIN e o registro é feito instantaneamente com hora exata. Sem filas, sem papel, sem aplicativo instalado.',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ),
                title: 'Multi-usuário e multi-empresa',
                text: 'Gerencie vários funcionários e múltiplas empresas. Cada empresa tem seu próprio espaço isolado com URL personalizada.',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18" />
                    <path d="M9 21V9" />
                  </svg>
                ),
                title: 'Painel em tempo real',
                text: 'Veja quem está presente, quem está em pausa e quem ainda não chegou — tudo atualizado em tempo real no painel administrativo.',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                  </svg>
                ),
                title: 'Relatórios prontos para a contabilidade',
                text: 'Exporte relatórios de frequência e jornada em Excel com um clique, no formato que seu contador precisa para fechar a folha.',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                ),
                title: 'Área exclusiva para o contador',
                text: 'Seu contador acessa diretamente pelo próprio login, visualiza os dados de todos os clientes e exporta sem precisar te chamar.',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                ),
                title: 'Histórico completo e auditável',
                text: 'Todo registro fica salvo com data, hora e tipo exatos. Consulte o histórico de qualquer funcionário a qualquer momento.',
              },
            ].map((b, i) => (
              <div key={i} className="lp-benefit-card">
                <div className="lp-benefit-icon">{b.icon}</div>
                <h3 className="lp-benefit-title">{b.title}</h3>
                <p className="lp-benefit-text">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="lp-section lp-how" id="passos">
        <div className="lp-section-inner">
          <div className="lp-center">
            <div className="lp-section-tag">Passo a passo</div>
            <h2 className="lp-section-title">Comece a usar em <span>menos de 10 minutos</span></h2>
            <p className="lp-section-sub">Não precisa de treinamento, não precisa de suporte técnico. A configuração é tão simples que você faz sozinho agora.</p>
          </div>
          <div className="lp-steps">
            {[
              { n: '1', title: 'Crie sua conta', sub: 'Cadastro rápido, sem cartão de crédito. Sua empresa ganha um subdomínio exclusivo.' },
              { n: '2', title: 'Cadastre os funcionários', sub: 'Adicione nome e PIN de cada colaborador no painel administrativo.' },
              { n: '3', title: 'Compartilhe a URL', sub: 'Envie o endereço do sistema para sua equipe. Abre em qualquer navegador.' },
              { n: '4', title: 'Pronto, é só usar', sub: 'Os registros aparecem no painel em tempo real. Exporte quando quiser.' },
            ].map((s) => (
              <div key={s.n} className="lp-step">
                <div className="lp-step-number">{s.n}</div>
                <div className="lp-step-title">{s.title}</div>
                <div className="lp-step-sub">{s.sub}</div>
              </div>
            ))}
          </div>
          <div className="lp-section-cta">
            <button className="lp-btn-primary" onClick={() => scrollTo('precos')}>
              Criar minha conta agora
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="lp-section lp-features" id="contador">
        <div className="lp-section-inner">
          <div className="lp-center" style={{ marginBottom: '8px' }}>
            <div className="lp-section-tag">Funcionalidades</div>
            <h2 className="lp-section-title">Cada perfil tem <span>o que precisa</span></h2>
          </div>

          {/* Feature 1: Admin dashboard */}
          <div className="lp-feature-row">
            <div className="lp-feature-content">
              <div className="lp-feature-tag">Para gestores</div>
              <h3 className="lp-feature-title">Visão completa da equipe em tempo real</h3>
              <p className="lp-feature-text">
                Acompanhe quem chegou, quem está em pausa e quem está atrasado sem precisar perguntar para ninguém. O painel mostra tudo ao vivo.
              </p>
              <ul className="lp-feature-list">
                <li>Registro de entrada, saída, almoço e retorno</li>
                <li>Histórico por funcionário com filtro de período</li>
                <li>Exportação de relatório em Excel</li>
                <li>Gerenciamento de PINs e cadastros</li>
              </ul>
            </div>
            <div className="lp-feature-visual">
              <div className="lp-mini-table-header">
                <span className="lp-mini-table-col">Funcionário</span>
                <span className="lp-mini-table-col">Entrada</span>
                <span className="lp-mini-table-col">Almoço</span>
                <span className="lp-mini-table-col">Retorno</span>
                <span className="lp-mini-table-col">Status</span>
              </div>
              {[
                { n: 'Ana Souza', e: '08:03', a: '12:01', r: '13:02', s: 'ok', l: 'OK' },
                { n: 'Bruno Lima', e: '08:47', a: '12:15', r: '—', s: 'warn', l: 'Pausa' },
                { n: 'Carla Dias', e: '08:00', a: '—', r: '—', s: 'ok', l: 'Trabalhando' },
                { n: 'Diego Santos', e: '09:10', a: '12:00', r: '13:00', s: 'ok', l: 'OK' },
              ].map((r) => (
                <div key={r.n} className="lp-mini-table-row">
                  <span style={{ fontWeight: 600 }}>{r.n}</span>
                  <span>{r.e}</span>
                  <span>{r.a}</span>
                  <span>{r.r}</span>
                  <span className={`lp-mini-badge ${r.s}`}>{r.l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Feature 2: PIN keypad */}
          <div className="lp-feature-row reverse">
            <div className="lp-feature-content">
              <div className="lp-feature-tag">Para funcionários</div>
              <h3 className="lp-feature-title">Bater o ponto nunca foi tão rápido</h3>
              <p className="lp-feature-text">
                Nada de aplicativo, nada de senha complicada. O funcionário acessa a URL da empresa, digita o PIN de 4 a 6 dígitos e o registro é feito. Simples assim.
              </p>
              <ul className="lp-feature-list">
                <li>Funciona em qualquer navegador, celular ou PC</li>
                <li>PIN pessoal de 4 a 6 dígitos, fácil de memorizar</li>
                <li>Confirmação visual imediata do registro</li>
                <li>Pode consultar o próprio histórico pelo PIN</li>
              </ul>
            </div>
            <div className="lp-feature-visual" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '240px' }}>
              <div style={{ background: 'white', borderRadius: '16px', padding: '24px', width: '200px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
                <div style={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', marginBottom: '12px' }}>09:47</div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: i <= 3 ? '#1d4ed8' : '#e2e8f0', border: '2px solid #1d4ed8' }} />
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {[1,2,3,4,5,6,7,8,9,'✕',0,'✓'].map((k, i) => (
                    <div key={i} style={{
                      padding: '10px',
                      textAlign: 'center',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      background: k === '✓' ? '#1d4ed8' : k === '✕' ? '#f1f5f9' : '#f8fafc',
                      color: k === '✓' ? 'white' : '#334155',
                      border: '1px solid #e2e8f0',
                    }}>{k}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Feature 3: Contador area */}
          <div className="lp-feature-row">
            <div className="lp-feature-content">
              <div className="lp-feature-tag">Para contadores</div>
              <h3 className="lp-feature-title">Área exclusiva para escritórios contábeis</h3>
              <p className="lp-feature-text">
                O contador acessa um painel próprio onde conecta quantas empresas quiser, visualiza relatórios de cada uma e exporta em Excel — sem precisar incomodar o cliente.
              </p>
              <ul className="lp-feature-list">
                <li>Login separado em contador.tempu.com.br</li>
                <li>Conecta múltiplos clientes com um código único</li>
                <li>Relatório mensal completo por empresa</li>
                <li>Exportação em .xlsx pronto para a folha de pagamento</li>
              </ul>
            </div>
            <div className="lp-feature-visual" style={{ flexDirection: 'column', gap: '8px' }}>
              <div style={{ background: '#1e40af', borderRadius: '10px 10px 0 0', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.15)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: '0.8rem' }}>tempu — ÁREA DO CONTADOR</span>
              </div>
              <div style={{ background: 'white', borderRadius: '0 0 10px 10px', padding: '14px', border: '1px solid #e2e8f0', borderTop: 'none', flex: 1 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Clientes conectados</div>
                {['Padaria São João', 'Auto Peças Rápido', 'Escritório Silva & Filhos'].map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', background: i === 0 ? '#eff6ff' : 'transparent', marginBottom: '4px', borderLeft: i === 0 ? '3px solid #1d4ed8' : '3px solid transparent' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>{c}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.68rem', background: '#dcfce7', color: '#16a34a', padding: '2px 6px', borderRadius: '10px', fontWeight: 700 }}>Ativo</span>
                  </div>
                ))}
                <button style={{ width: '100%', marginTop: '8px', padding: '8px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                  Exportar relatório Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="lp-section lp-testimonials">
        <div className="lp-section-inner">
          <div className="lp-center">
            <div className="lp-section-tag">Depoimentos</div>
            <h2 className="lp-section-title">Quem usa <span>não volta para planilha</span></h2>
            <p className="lp-section-sub">Empresas de vários segmentos já simplificaram o controle de ponto com o tempu.</p>
          </div>
          <div className="lp-testimonials-grid">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="lp-testimonial-card">
                <div className="lp-testimonial-stars">{t.stars}</div>
                <p className="lp-testimonial-text">"{t.text}"</p>
                <div className="lp-testimonial-author">
                  <div className="lp-testimonial-avatar" style={{ background: t.color }}>
                    {t.initials}
                  </div>
                  <div>
                    <div className="lp-testimonial-name">{t.name}</div>
                    <div className="lp-testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="lp-section lp-faq" id="faq">
        <div className="lp-section-inner">
          <div className="lp-center">
            <div className="lp-section-tag">Dúvidas frequentes</div>
            <h2 className="lp-section-title">Respondendo as principais <span>dúvidas</span></h2>
            <p className="lp-section-sub">Alguma dúvida que não está aqui? Entre em contato, respondemos rapidamente.</p>
          </div>
          <div className="lp-faq-list">
            {FAQ_ITEMS.map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="lp-section lp-pricing" id="precos">
        <div className="lp-section-inner">
          <div className="lp-center">
            <div className="lp-section-tag">Preço</div>
            <h2 className="lp-section-title">Um plano simples, <span>tudo incluso</span></h2>
            <p className="lp-section-sub">Sem surpresas, sem planos confusos. Um preço justo para ter tudo que sua empresa precisa.</p>
          </div>
          <div className="lp-pricing-card">
            <div className="lp-pricing-label">Plano Completo</div>
            <div className="lp-pricing-price">
              <span>R$</span>49
            </div>
            <div className="lp-pricing-period">por mês · cancele quando quiser</div>
            <ul className="lp-pricing-features">
              {[
                'Funcionários ilimitados',
                'Relatórios e exportação em Excel',
                'Área do contador incluída',
                'Painel em tempo real',
                'Histórico completo e auditável',
                'Suporte por e-mail',
                '14 dias grátis, sem cartão',
              ].map((f, i) => (
                <li key={i}>
                  <svg className="lp-pricing-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <button className="lp-btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '1.05rem', padding: '16px' }}>
              Começar grátis agora
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
            <p className="lp-pricing-guarantee">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              14 dias grátis · Sem cartão de crédito · Cancele quando quiser
            </p>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="lp-final">
        <h2 className="lp-final-title">Sua equipe pode bater o ponto<br />ainda hoje</h2>
        <p className="lp-final-sub">
          Configuração em menos de 10 minutos. Seu contador agradece, sua equipe adere e você nunca mais perde hora nem dado de ninguém.
        </p>
        <button className="lp-btn-white" onClick={() => scrollTo('precos')}>
          Começar grátis — sem cartão
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
        <p className="lp-final-note">14 dias grátis · Cancele quando quiser · Suporte incluído</p>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-footer-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          tempu
        </div>
        <p className="lp-footer-copy">© {new Date().getFullYear()} tempu · Controle de ponto digital · tempu.com.br</p>
      </footer>
    </div>
  );
}
