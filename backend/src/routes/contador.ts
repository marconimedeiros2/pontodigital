import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../database/db';

const router = Router();

// ── Session store ──────────────────────────────────────────────────────────────
// token → contador_id
const sessions = new Map<string, number>();

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ── Rate limiter (in-memory, per IP) ──────────────────────────────────────────
interface RateEntry { count: number; resetAt: number }
const loginAttempts = new Map<string, RateEntry>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  let entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    loginAttempts.set(ip, entry);
  }
  entry.count += 1;
  return entry.count <= MAX_ATTEMPTS;
}

function clearRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

// ── Auth middleware ────────────────────────────────────────────────────────────
export function contadorAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const contadorId = token ? sessions.get(token) : undefined;
  if (!token || contadorId === undefined) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  (req as Request & { contadorId: number }).contadorId = contadorId;
  next();
}

function getContadorId(req: Request): number {
  return (req as Request & { contadorId: number }).contadorId;
}

// ── POST /api/contador/login ───────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  const { email, senha } = req.body as { email?: string; senha?: string };

  if (!email?.trim() || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  const ip = (req.ip ?? 'unknown').replace('::ffff:', '');

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Muitas tentativas. Aguarde 1 minuto.' });
  }

  try {
    const contador = await db.findContador(email.trim().toLowerCase());

    const hash = crypto.createHash('sha256').update(senha).digest('hex');

    if (!contador || !contador.ativo || contador.password_hash !== hash) {
      return res.status(401).json({ error: 'Email ou senha incorretos.' });
    }

    clearRateLimit(ip);

    const token = generateToken();
    sessions.set(token, contador.id);

    // Fire-and-forget side effects
    db.updateContadorLogin(contador.id).catch(() => {});
    db.logContadorAccess(contador.id, contador.email, null, 'login').catch(() => {});

    return res.json({ token, nome: contador.nome });
  } catch (err) {
    console.error('[POST /contador/login]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── POST /api/contador/logout ──────────────────────────────────────────────────
router.post('/logout', contadorAuthMiddleware, async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '') ?? '';
  const contadorId = getContadorId(req);
  sessions.delete(token);
  db.findContadorById(contadorId)
    .then((c) => c && db.logContadorAccess(c.id, c.email, null, 'logout'))
    .catch(() => {});
  return res.json({ ok: true });
});

// ── POST /api/contador/connect ─────────────────────────────────────────────────
router.post('/connect', contadorAuthMiddleware, async (req: Request, res: Response) => {
  const contadorId = getContadorId(req);
  const { chave, nome } = req.body as { chave?: string; nome?: string };

  if (!chave?.trim()) {
    return res.status(400).json({ error: 'Chave é obrigatória.' });
  }

  try {
    let clientUuid: string;
    let apiKeyId: number | null = null;
    let connectionType: 'uuid' | 'api_key';

    if (chave.trim().startsWith('pd_live_')) {
      // Validate API Key globally (we don't know the client_id yet)
      const apiKey = await db.validateApiKeyGlobal(chave.trim());
      if (!apiKey) {
        return res.status(400).json({ error: 'Chave de API inválida ou revogada.' });
      }
      clientUuid = apiKey.client_id;   // derive client from the key
      apiKeyId = apiKey.id;
      connectionType = 'api_key';
    } else {
      // The chave is admin_config.client_uuid (shared by the admin on the integrations page)
      // Resolve it to the actual client_id for tenant queries
      const resolvedClientId = await db.findClientByAdminUuid(chave.trim());
      if (!resolvedClientId) {
        return res.status(400).json({ error: 'UUID do cliente não encontrado.' });
      }
      clientUuid = resolvedClientId;
      connectionType = 'uuid';
    }

    const nomeFinal = nome?.trim() || 'Cliente';
    const cliente = await db.upsertContadorCliente(
      contadorId, clientUuid, connectionType, apiKeyId, nomeFinal
    );

    db.findContadorById(contadorId)
      .then((c) => c && db.logContadorAccess(c.id, c.email, clientUuid, 'connect'))
      .catch(() => {});

    return res.json({ cliente });
  } catch (err) {
    console.error('[POST /contador/connect]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── GET /api/contador/clientes ────────────────────────────────────────────────
router.get('/clientes', contadorAuthMiddleware, async (req: Request, res: Response) => {
  const contadorId = getContadorId(req);
  try {
    const clientes = await db.listContadorClientes(contadorId);
    return res.json({ clientes });
  } catch (err) {
    console.error('[GET /contador/clientes]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── PATCH /api/contador/clientes/:id ─────────────────────────────────────────
router.patch('/clientes/:id', contadorAuthMiddleware, async (req: Request, res: Response) => {
  const contadorId = getContadorId(req);
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido.' });
  }
  const { nome } = req.body as { nome?: string };
  if (!nome?.trim()) {
    return res.status(400).json({ error: 'Nome é obrigatório.' });
  }
  try {
    const cliente = await db.renameContadorCliente(contadorId, id, nome.trim());
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado.' });
    return res.json({ cliente });
  } catch (err) {
    console.error('[PATCH /contador/clientes/:id]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── DELETE /api/contador/clientes/:id ────────────────────────────────────────
router.delete('/clientes/:id', contadorAuthMiddleware, async (req: Request, res: Response) => {
  const contadorId = getContadorId(req);
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido.' });
  }
  try {
    await db.deleteContadorCliente(contadorId, id);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /contador/clientes/:id]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── GET /api/contador/relatorio ───────────────────────────────────────────────
router.get('/relatorio', contadorAuthMiddleware, async (req: Request, res: Response) => {
  const contadorId = getContadorId(req);
  const { clienteId, inicio, fim } = req.query as {
    clienteId?: string; inicio?: string; fim?: string;
  };

  if (!clienteId) {
    return res.status(400).json({ error: 'clienteId é obrigatório.' });
  }

  try {
    // Verify ownership
    const cliente = await db.getContadorCliente(contadorId, Number(clienteId));
    if (!cliente) {
      return res.status(403).json({ error: 'Acesso não autorizado.' });
    }

    db.updateContadorClienteAccess(cliente.id).catch(() => {});

    // cliente.client_uuid holds the tenant's client_id
    const tenantId = cliente.client_uuid;
    const [registros, usuarios] = await Promise.all([
      db.findAll(tenantId, 2000),
      db.listUsuarios(tenantId),
    ]);

    const usuariosMap = Object.fromEntries(usuarios.map((u) => [u.id, u]));

    const inRange = (data: string) => {
      if (inicio && data < inicio) return false;
      if (fim && data > fim) return false;
      return true;
    };

    const enriched = registros
      .filter((r) => !r.oculto && inRange(r.data))
      .map((r) => ({
        id: r.id,
        pin: r.pin,
        nome: usuariosMap[r.usuario_id]?.nome ?? `PIN ${r.pin}`,
        data: r.data,
        hora_inicial: r.hora_inicial,
        inicio_intervalo: r.inicio_intervalo,
        fim_intervalo: r.fim_intervalo,
        hora_final: r.hora_final,
        completo:
          r.hora_inicial !== null &&
          r.inicio_intervalo !== null &&
          r.fim_intervalo !== null &&
          r.hora_final !== null,
      }));

    db.findContadorById(contadorId)
      .then((c) => c && db.logContadorAccess(c.id, c.email, cliente.client_uuid, 'view_relatorio'))
      .catch(() => {});

    return res.json({ registros: enriched });
  } catch (err) {
    console.error('[GET /contador/relatorio]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

export default router;
