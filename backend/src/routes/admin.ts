import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../database/db';

const router = Router();

const sessions = new Set<string>();

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function isValidToken(token: string): boolean {
  return sessions.has(token);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !isValidToken(token)) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  next();
}

// POST /api/admin/login
router.post('/login', async (req: Request, res: Response) => {
  const { senha } = req.body as { senha?: string };

  if (!senha || typeof senha !== 'string') {
    return res.status(400).json({ error: 'Senha obrigatória.' });
  }

  try {
    const ok = await db.checkPassword(senha);
    if (!ok) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    const token = generateToken();
    sessions.add(token);
    return res.json({ token });
  } catch (err) {
    console.error('[POST /login]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// POST /api/admin/logout
router.post('/logout', authMiddleware, (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '') ?? '';
  sessions.delete(token as string);
  return res.json({ ok: true });
});

// POST /api/admin/senha
router.post('/senha', authMiddleware, async (req: Request, res: Response) => {
  const { senhaAtual, novaSenha } = req.body as { senhaAtual?: string; novaSenha?: string };

  if (!senhaAtual || !novaSenha) {
    return res.status(400).json({ error: 'senhaAtual e novaSenha são obrigatórios.' });
  }

  if (novaSenha.length < 4) {
    return res.status(400).json({ error: 'Nova senha deve ter ao menos 4 caracteres.' });
  }

  try {
    const ok = await db.checkPassword(senhaAtual);
    if (!ok) {
      return res.status(401).json({ error: 'Senha atual incorreta.' });
    }

    await db.changePassword(novaSenha);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[POST /senha]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/admin/dashboard?data=YYYY-MM-DD
router.get('/dashboard', authMiddleware, async (req: Request, res: Response) => {
  const data = (req.query.data as string) || getTodayDate();

  try {
    const [registros, usuarios] = await Promise.all([
      db.findByDate(data),
      db.listUsuarios(),
    ]);

    const usuariosMap = Object.fromEntries(usuarios.map((u) => [u.id, u]));

    const enriched = registros.map((r) => ({
      ...r,
      nome: usuariosMap[r.usuario_id]?.nome ?? `PIN ${r.pin}`,
      completo:
        r.hora_inicial !== null &&
        r.inicio_intervalo !== null &&
        r.fim_intervalo !== null &&
        r.hora_final !== null,
    }));

    const stats = {
      total: enriched.length,
      presentes: enriched.filter((r) => r.hora_inicial !== null).length,
      emIntervalo: enriched.filter(
        (r) => r.inicio_intervalo !== null && r.fim_intervalo === null
      ).length,
      saiu: enriched.filter((r) => r.hora_final !== null).length,
      completos: enriched.filter((r) => r.completo).length,
    };

    return res.json({ data, registros: enriched, stats });
  } catch (err) {
    console.error('[GET /dashboard]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/admin/relatorio?inicio=YYYY-MM-DD&fim=YYYY-MM-DD&incluirOcultos=true
router.get('/relatorio', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { inicio, fim, incluirOcultos } = req.query as {
      inicio?: string; fim?: string; incluirOcultos?: string;
    };
    const mostrarOcultos = incluirOcultos === 'true';

    const [todosVisiveis, todosOcultos, usuarios] = await Promise.all([
      db.findAll(500),
      db.findAllHidden(500),
      db.listUsuarios(),
    ]);

    const usuariosMap = Object.fromEntries(usuarios.map((u) => [u.id, u]));

    const inRange = (data: string) => {
      if (inicio && data < inicio) return false;
      if (fim && data > fim) return false;
      return true;
    };

    const enrich = (r: (typeof todosVisiveis)[0], oculto = false) => ({
      ...r,
      oculto,
      nome: usuariosMap[r.usuario_id]?.nome ?? `PIN ${r.pin}`,
      completo: r.hora_inicial !== null && r.inicio_intervalo !== null &&
                r.fim_intervalo !== null && r.hora_final !== null,
    });

    const visiveis  = todosVisiveis.filter((r) => inRange(r.data)).map((r) => enrich(r, false));
    const ocultos   = todosOcultos.filter((r) => inRange(r.data)).map((r) => enrich(r, true));
    const registros = mostrarOcultos ? [...visiveis, ...ocultos] : visiveis;

    return res.json({ registros, ocultosCount: ocultos.length });
  } catch (err) {
    console.error('[GET /relatorio]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/admin/usuarios
router.get('/usuarios', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const usuarios = await db.listUsuarios();
    return res.json({ usuarios });
  } catch (err) {
    console.error('[GET /usuarios]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// POST /api/admin/usuarios
router.post('/usuarios', authMiddleware, async (req: Request, res: Response) => {
  const { pin, nome, horas_diarias } = req.body as { pin?: string; nome?: string; horas_diarias?: number };

  if (!pin || !/^\d{4,6}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN inválido (4-6 dígitos numéricos).' });
  }

  if (!nome || nome.trim().length < 2) {
    return res.status(400).json({ error: 'Nome inválido (mínimo 2 caracteres).' });
  }

  const minutos = Number(horas_diarias ?? 440);
  if (isNaN(minutos) || minutos < 60 || minutos > 1440) {
    return res.status(400).json({ error: 'Jornada inválida (1h–24h).' });
  }

  try {
    const existing = await db.findUsuario(pin);
    if (existing) {
      return res.status(409).json({ error: 'PIN já cadastrado.' });
    }

    const usuario = await db.createUsuario(pin, nome.trim(), minutos);
    return res.status(201).json({ usuario });
  } catch (err) {
    console.error('[POST /usuarios]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// PATCH /api/admin/usuarios/jornada  (bulk update horas_diarias)
router.patch('/usuarios/jornada', authMiddleware, async (req: Request, res: Response) => {
  const { pins, horas_diarias } = req.body as { pins?: string[]; horas_diarias?: number };

  if (!Array.isArray(pins) || pins.length === 0) {
    return res.status(400).json({ error: 'Lista de PINs obrigatória.' });
  }

  const minutos = Number(horas_diarias);
  if (isNaN(minutos) || minutos < 60 || minutos > 1440) {
    return res.status(400).json({ error: 'Jornada inválida (1h–24h).' });
  }

  try {
    await db.bulkUpdateHorasDiarias(pins, minutos);
    return res.json({ ok: true, updated: pins.length });
  } catch (err) {
    console.error('[PATCH /usuarios/jornada]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// PUT /api/admin/usuarios/:pin
router.put('/usuarios/:pin', authMiddleware, async (req: Request, res: Response) => {
  const { pin } = req.params;
  const { nome, ativo, novoPin, horas_diarias } = req.body as { nome?: string; ativo?: boolean; novoPin?: string; horas_diarias?: number };

  try {
    const existing = await db.findUsuario(pin);
    if (!existing) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (novoPin !== undefined) {
      if (!/^\d{4,6}$/.test(novoPin)) {
        return res.status(400).json({ error: 'Novo PIN inválido (4-6 dígitos numéricos).' });
      }
      if (novoPin !== pin) {
        const conflict = await db.findUsuario(novoPin);
        if (conflict) {
          return res.status(409).json({ error: 'Novo PIN já está em uso por outro funcionário.' });
        }
      }
      const updated = await db.changeUserPin(pin, novoPin, nome?.trim(), ativo);
      return res.json({ usuario: updated });
    }

    const fields: Partial<Pick<import('../database/db').Usuario, 'nome' | 'ativo' | 'horas_diarias'>> = {};
    if (nome !== undefined) fields.nome = nome.trim();
    if (ativo !== undefined) fields.ativo = ativo;
    if (horas_diarias !== undefined) fields.horas_diarias = Number(horas_diarias);

    const updated = await db.updateUsuario(existing.id, fields);
    return res.json({ usuario: updated });
  } catch (err) {
    console.error('[PUT /usuarios/:pin]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// PUT /api/admin/registros/:id  (editar campos de data/hora)
router.put('/registros/:id', authMiddleware, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido.' });
  }

  const timeFields = ['hora_inicial', 'inicio_intervalo', 'fim_intervalo', 'hora_final'] as const;
  const fields: Record<string, string | null | boolean> = {};
  for (const f of timeFields) {
    if (f in req.body) fields[f] = req.body[f] ?? null;
  }
  if ('oculto' in req.body && typeof req.body.oculto === 'boolean') {
    fields['oculto'] = req.body.oculto;
  }

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: 'Nenhum campo válido informado.' });
  }

  try {
    await db.updateById(id, fields as Parameters<typeof db.updateById>[1]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[PUT /registros/:id]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// POST /api/admin/registros  (criar novo registro)
router.post('/registros', authMiddleware, async (req: Request, res: Response) => {
  const { pin, data, hora_inicial, inicio_intervalo, fim_intervalo, hora_final } = req.body as {
    pin?: string; data?: string;
    hora_inicial?: string; inicio_intervalo?: string; fim_intervalo?: string; hora_final?: string;
  };

  if (!pin || typeof pin !== 'string') {
    return res.status(400).json({ error: 'PIN é obrigatório.' });
  }
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res.status(400).json({ error: 'Data inválida (YYYY-MM-DD).' });
  }

  try {
    const usuario = await db.findUsuario(pin);
    if (!usuario) return res.status(404).json({ error: 'Funcionário não encontrado.' });

    const registro = await db.insertRecord(usuario.id, pin, data, {
      hora_inicial:      hora_inicial      || null,
      inicio_intervalo:  inicio_intervalo  || null,
      fim_intervalo:     fim_intervalo     || null,
      hora_final:        hora_final        || null,
      horas_diarias:     usuario.horas_diarias ?? null,
    });

    return res.status(201).json({ ok: true, id: registro.id });
  } catch (err) {
    console.error('[POST /registros]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// DELETE /api/admin/registros/:id  (soft delete — marca como oculto)
router.delete('/registros/:id', authMiddleware, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido.' });
  }
  try {
    const hidden = await db.hideRecord(id);
    if (!hidden) return res.status(404).json({ error: 'Registro não encontrado.' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /registros/:id]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// DELETE /api/admin/usuarios/:pin
router.delete('/usuarios/:pin', authMiddleware, async (req: Request, res: Response) => {
  const { pin } = req.params;

  try {
    const deleted = await db.deleteUsuario(pin);
    if (!deleted) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /usuarios/:pin]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/admin/configuracoes/escala
router.get('/configuracoes/escala', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const escala_padrao = await db.getEscalaPadrao();
    return res.json({ escala_padrao });
  } catch (err) {
    console.error('[GET /configuracoes/escala]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// PUT /api/admin/configuracoes/escala
router.put('/configuracoes/escala', authMiddleware, async (req: Request, res: Response) => {
  const { escala_padrao } = req.body as { escala_padrao?: number };
  const minutos = Number(escala_padrao);
  if (isNaN(minutos) || minutos < 60 || minutos > 1440) {
    return res.status(400).json({ error: 'Escala inválida (1h–24h).' });
  }
  try {
    await db.setEscalaPadrao(minutos);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[PUT /configuracoes/escala]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

function getTodayDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default router;
