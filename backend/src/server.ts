import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import pontoRoutes from './routes/ponto';
import adminRoutes from './routes/admin';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || true,
  credentials: true,
}));

app.use(express.json());

// Log API requests
app.use('/api', (req, _res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// ROTAS DA API (mantém antes de tudo)
app.use('/api/ponto', pontoRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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