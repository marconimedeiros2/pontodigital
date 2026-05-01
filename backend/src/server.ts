import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pontoRoutes from './routes/ponto';
import adminRoutes from './routes/admin';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

app.use('/api/ponto', pontoRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n🕐 Ponto Digital API rodando em http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});
