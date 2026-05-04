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
  const { pin, nome, horas_diarias, intervalo } = req.body as { pin?: string; nome?: string; horas_diarias?: number; intervalo?: number };

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

  const intMin = Number(intervalo ?? 60);
  if (isNaN(intMin) || intMin < 0 || intMin > 480) {
    return res.status(400).json({ error: 'Intervalo inválido (0–8h).' });
  }

  try {
    const existing = await db.findUsuario(pin);
    if (existing) {
      return res.status(409).json({ error: 'PIN já cadastrado.' });
    }

    const usuario = await db.createUsuario(pin, nome.trim(), minutos, intMin);
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

// PATCH /api/admin/usuarios/intervalo  (bulk update intervalo)
router.patch('/usuarios/intervalo', authMiddleware, async (req: Request, res: Response) => {
  const { pins, intervalo } = req.body as { pins?: string[]; intervalo?: number };

  if (!Array.isArray(pins) || pins.length === 0) {
    return res.status(400).json({ error: 'Lista de PINs obrigatória.' });
  }

  const minutos = Number(intervalo);
  if (isNaN(minutos) || minutos < 0 || minutos > 480) {
    return res.status(400).json({ error: 'Intervalo inválido (0–8h).' });
  }

  try {
    await db.bulkUpdateIntervalo(pins, minutos);
    return res.json({ ok: true, updated: pins.length });
  } catch (err) {
    console.error('[PATCH /usuarios/intervalo]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// PUT /api/admin/usuarios/:pin
router.put('/usuarios/:pin', authMiddleware, async (req: Request, res: Response) => {
  const { pin } = req.params;
  const { nome, ativo, novoPin, horas_diarias, intervalo } = req.body as { nome?: string; ativo?: boolean; novoPin?: string; horas_diarias?: number; intervalo?: number };

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

    const fields: Partial<Pick<import('../database/db').Usuario, 'nome' | 'ativo' | 'horas_diarias' | 'intervalo'>> = {};
    if (nome !== undefined) fields.nome = nome.trim();
    if (ativo !== undefined) fields.ativo = ativo;
    if (horas_diarias !== undefined) fields.horas_diarias = Number(horas_diarias);
    if (intervalo !== undefined) fields.intervalo = Number(intervalo);

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
  if ('extra' in req.body && typeof req.body.extra === 'boolean') {
    fields['extra'] = req.body.extra;
  }

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: 'Nenhum campo válido informado.' });
  }

  try {
    const atual = await db.findById(id);
    await db.updateById(id, fields as Parameters<typeof db.updateById>[1]);

    if (atual) {
      const atualMap = atual as unknown as Record<string, unknown>;
      await Promise.all(
        Object.entries(fields)
          .filter(([campo, novoValor]) => {
            const anterior = atualMap[campo];
            return String(anterior ?? '') !== String(novoValor ?? '');
          })
          .map(([campo, novoValor]) => {
            const anterior = atualMap[campo];
            return db.insertLog(
              id,
              campo,
              anterior != null ? String(anterior) : null,
              novoValor != null ? String(novoValor) : null
            );
          })
      );
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[PUT /registros/:id]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/admin/registros/:id/logs
router.get('/registros/:id/logs', authMiddleware, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido.' });
  }
  try {
    const logs = await db.getLogsByRegistroId(id);
    return res.json({ logs });
  } catch (err) {
    console.error('[GET /registros/:id/logs]', err);
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
      intervalo:         usuario.intervalo ?? null,
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
    const config = await db.getEscalaConfig();
    return res.json(config);
  } catch (err) {
    console.error('[GET /configuracoes/escala]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// PUT /api/admin/configuracoes/escala
router.put('/configuracoes/escala', authMiddleware, async (req: Request, res: Response) => {
  const { escala_padrao, intervalo_padrao } = req.body as { escala_padrao?: number; intervalo_padrao?: number };
  const escala = Number(escala_padrao);
  const intervalo = Number(intervalo_padrao);
  if (isNaN(escala) || escala < 60 || escala > 1440) {
    return res.status(400).json({ error: 'Escala inválida (1h–24h).' });
  }
  if (isNaN(intervalo) || intervalo < 0 || intervalo > 480) {
    return res.status(400).json({ error: 'Intervalo inválido (0–8h).' });
  }
  try {
    await db.setEscalaConfig(escala, intervalo);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[PUT /configuracoes/escala]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── Custom Fields ────────────────────────────────────────────────────────────

// GET /api/admin/custom-fields?all=true
router.get('/custom-fields', authMiddleware, async (req: Request, res: Response) => {
  const includeInactive = req.query.all === 'true';
  try {
    const fields = await db.listCustomFields(includeInactive);
    return res.json({ fields });
  } catch (err) {
    console.error('[GET /custom-fields]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// POST /api/admin/custom-fields
router.post('/custom-fields', authMiddleware, async (req: Request, res: Response) => {
  const { nome, tipo, input_type, options, required, ordem, ativo, valor_padrao } = req.body;
  if (!nome || typeof nome !== 'string' || !nome.trim()) {
    return res.status(400).json({ error: 'Nome é obrigatório.' });
  }
  try {
    // Calcula próxima ordem se não informada
    const existing = await db.listCustomFields(true);
    const nextOrdem = typeof ordem === 'number' ? ordem : (existing.length > 0 ? Math.max(...existing.map(f => f.ordem)) + 1 : 0);
    const field = await db.createCustomField({
      nome: nome.trim(),
      tipo: tipo ?? 'string',
      input_type: input_type ?? 'text',
      options: options ?? null,
      required: !!required,
      ordem: nextOrdem,
      ativo: ativo !== false,
      valor_padrao: valor_padrao ?? null,
    });
    return res.status(201).json({ field });
  } catch (err) {
    console.error('[POST /custom-fields]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// PATCH /api/admin/custom-fields/reorder  — antes de /:id para não conflitar
router.patch('/custom-fields/reorder', authMiddleware, async (req: Request, res: Response) => {
  const { orders } = req.body as { orders?: { id: number; ordem: number }[] };
  if (!Array.isArray(orders) || orders.length === 0) {
    return res.status(400).json({ error: 'orders é obrigatório.' });
  }
  try {
    await Promise.all(orders.map(({ id, ordem }) => db.updateCustomField(id, { ordem })));
    return res.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /custom-fields/reorder]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// PUT /api/admin/custom-fields/:id
router.put('/custom-fields/:id', authMiddleware, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });
  const { nome, tipo, input_type, options, required, ordem, ativo, valor_padrao } = req.body;
  const upd: Record<string, unknown> = {};
  if (nome !== undefined) upd.nome = String(nome).trim();
  if (tipo !== undefined) upd.tipo = tipo;
  if (input_type !== undefined) upd.input_type = input_type;
  if (options !== undefined) upd.options = options;
  if (required !== undefined) upd.required = !!required;
  if (ordem !== undefined) upd.ordem = Number(ordem);
  if (ativo !== undefined) upd.ativo = !!ativo;
  if (valor_padrao !== undefined) upd.valor_padrao = valor_padrao || null;
  try {
    const field = await db.updateCustomField(id, upd as Parameters<typeof db.updateCustomField>[1]);
    return res.json({ field });
  } catch (err) {
    console.error('[PUT /custom-fields/:id]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// DELETE /api/admin/custom-fields/:id  (soft delete — ativo = false)
router.delete('/custom-fields/:id', authMiddleware, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });
  try {
    await db.updateCustomField(id, { ativo: false });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /custom-fields/:id]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── Custom Field Values ───────────────────────────────────────────────────────

// GET /api/admin/custom-values?registroIds=1,2,3
router.get('/custom-values', authMiddleware, async (req: Request, res: Response) => {
  const raw = (req.query.registroIds as string) ?? '';
  const registroIds = raw.split(',').map(Number).filter(n => Number.isInteger(n) && n > 0);
  try {
    const values = await db.getCustomValues(registroIds);
    return res.json({ values });
  } catch (err) {
    console.error('[GET /custom-values]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// PUT /api/admin/custom-values  (upsert + log)
router.put('/custom-values', authMiddleware, async (req: Request, res: Response) => {
  const { registroId, fieldId, value } = req.body as { registroId?: unknown; fieldId?: unknown; value?: string | null };
  const rId = Number(registroId);
  const fId = Number(fieldId);
  if (!Number.isInteger(rId) || rId <= 0 || !Number.isInteger(fId) || fId <= 0) {
    return res.status(400).json({ error: 'registroId e fieldId são obrigatórios.' });
  }
  try {
    const [oldValue, field] = await Promise.all([
      db.findCustomFieldValue(rId, fId),
      db.getCustomFieldById(fId),
    ]);
    const newValue = value ?? null;
    await db.upsertCustomValue(rId, fId, newValue);
    if (String(oldValue ?? '') !== String(newValue ?? '')) {
      await db.insertLog(
        rId,
        field?.nome ?? `Campo ${fId}`,
        oldValue,
        newValue,
        'admin',
        'custom',
        fId
      );
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('[PUT /custom-values]', err);
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

// ── Integrations ───────────────────────────────────────────────────────────────

function generateApiKey(): { full: string; prefix: string; hash: string } {
  // Format: pd_live_<64 hex chars>  →  total 72 chars
  const raw = crypto.randomBytes(32).toString('hex');
  const full = `pd_live_${raw}`;
  const prefix = full.slice(0, 16); // "pd_live_" + first 8 hex chars (public identifier)
  const hash = crypto.createHash('sha256').update(full).digest('hex');
  return { full, prefix, hash };
}

// GET /api/admin/integrations/info
router.get('/integrations/info', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const [uuid, keys] = await Promise.all([db.getClientUuid(), db.listApiKeys()]);
    return res.json({ uuid, keys });
  } catch (err) {
    console.error('[GET /integrations/info]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// POST /api/admin/integrations/keys
router.post('/integrations/keys', authMiddleware, async (req: Request, res: Response) => {
  const { nome } = req.body as { nome?: string };
  if (!nome?.trim()) {
    return res.status(400).json({ error: 'Nome é obrigatório.' });
  }
  try {
    const { full, prefix, hash } = generateApiKey();
    const key = await db.createApiKey(nome.trim(), prefix, hash);
    // fullKey is shown to the user ONCE and never stored in plain text
    return res.status(201).json({ key, fullKey: full });
  } catch (err) {
    console.error('[POST /integrations/keys]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// DELETE /api/admin/integrations/keys/:id
router.delete('/integrations/keys/:id', authMiddleware, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido.' });
  }
  try {
    await db.revokeApiKey(id);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /integrations/keys/:id]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

export default router;
