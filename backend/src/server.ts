import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import pontoRoutes from './routes/ponto';
import adminRoutes from './routes/admin';
import contadorRoutes from './routes/contador';
import { tenantMiddleware } from './middleware/tenant';
import godRoutes from './routes/god';

const app = express();
const PORT = process.env.PORT || 3001;

// Necessário para que req.hostname reflita o Host original quando atrás de nginx/proxy
app.set('trust proxy', true);

// CORS — aceita qualquer subdomínio de flowbase.tech
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'flowbase.tech';
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // same-origin / server-to-server
    const allowed =
      origin === `https://${BASE_DOMAIN}` ||
      origin === `http://${BASE_DOMAIN}` ||
      /^https?:\/\/[a-z0-9-]+\.flowbase\.tech(:\d+)?$/.test(origin) ||
      origin.includes('localhost');
    callback(null, allowed);
  },
  credentials: true,
}));

app.use(express.json());

// ── Multi-tenant: detecta subdomínio e injeta req.client em todas as rotas ──
app.use(tenantMiddleware);

// Log API requests
app.use('/api', (req, _res, next) => {
  const tenant = req.subdomain ? `[tenant:${req.subdomain}]` : '[root]';
  console.log(`[API] ${tenant} ${req.method} ${req.path}`);
  next();
});

// ROTAS DA API (mantém antes de tudo)
app.use('/api/ponto', pontoRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contador', contadorRoutes);
app.use('/api/god', godRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Diagnóstico de tenant — útil para o frontend saber qual cliente está ativo
app.get('/api/tenant', (req, res) => {
  res.json({
    subdomain: req.subdomain ?? null,
    client: req.client ?? null,
  });
});


// ==========================
// SERVIR FRONTEND (IMPORTANTE)
// ==========================

// Caminho do build do React (ajuste se necessário)
const frontendPath = path.join(__dirname, '../../frontend/dist');

// Servir arquivos estáticos
app.use(express.static(frontendPath));

// Qualquer rota que não seja API → React
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});


// START
app.listen(PORT, () => {
  console.log(`\n🕐 Ponto Digital rodando em http://localhost:${PORT}`);
});