/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                     GOD MODE — BACKEND                      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { supabase } from '../database/supabaseClient';
import type { GodUser } from '../types/express';

const router = Router();

// ── Sessions ───────────────────────────────────────────────────────────────────
const godSessions = new Map<string, GodUser>();

// ── Rate limit ─────────────────────────────────────────────────────────────────
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function checkRate(ip: string): boolean {
  const now = Date.now();
  let e = loginAttempts.get(ip);
  if (!e || now > e.resetAt) { e = { count: 0, resetAt: now + 60_000 }; loginAttempts.set(ip, e); }
  return ++e.count <= 10;
}

// ── Password (scrypt) ──────────────────────────────────────────────────────────
function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
function verifyPassword(pw: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), crypto.scryptSync(pw, salt, 64));
  } catch { return false; }
}

function generateToken() { return crypto.randomBytes(32).toString('hex'); }
function getIp(req: Request) {
  return String(req.headers['x-forwarded-for'] || req.ip || 'unknown').replace('::ffff:', '').split(',')[0].trim();
}

// ── Auth middleware ────────────────────────────────────────────────────────────
export function godAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const god = token ? godSessions.get(token) : undefined;
  if (!god) { res.status(401).json({ error: 'GOD: não autorizado.' }); return; }
  req.godUser = god;
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────
router.post('/auth/setup', async (req: Request, res: Response) => {
  const { email, nome, senha } = req.body as { email?: string; nome?: string; senha?: string };
  if (!email || !nome || !senha) return res.status(400).json({ error: 'email, nome e senha são obrigatórios.' });
  if (senha.length < 6) return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres.' });

  const { count } = await supabase.from('god_users').select('*', { count: 'exact', head: true });
  if ((count ?? 0) > 0) return res.status(403).json({ error: 'Setup já realizado.' });

  const { data, error } = await supabase.from('god_users')
    .insert({ email: email.trim().toLowerCase(), nome: nome.trim(), password_hash: hashPassword(senha) })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ ok: true, id: (data as GodUser).id });
});

router.post('/auth/login', async (req: Request, res: Response) => {
  const ip = getIp(req);
  if (!checkRate(ip)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 1 minuto.' });

  const { email, senha } = req.body as { email?: string; senha?: string };
  if (!email || !senha) return res.status(400).json({ error: 'Email e senha obrigatórios.' });

  const { data, error } = await supabase.from('god_users')
    .select('*').eq('email', email.trim().toLowerCase()).eq('ativo', true).single();
  if (error || !data) return res.status(401).json({ error: 'Credenciais inválidas.' });

  const god = data as GodUser & { password_hash: string };
  if (!verifyPassword(senha, god.password_hash)) return res.status(401).json({ error: 'Credenciais inválidas.' });

  const token = generateToken();
  const { password_hash: _ph, ...safeGod } = god;
  godSessions.set(token, safeGod as GodUser);
  await supabase.from('god_users').update({ last_login: new Date().toISOString() }).eq('id', god.id);
  console.log(`[GOD] Login: ${email} (${ip})`);
  return res.json({ token, god: safeGod });
});

router.post('/auth/logout', godAuthMiddleware, (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '') ?? '';
  godSessions.delete(token);
  return res.json({ ok: true });
});

router.get('/auth/me', godAuthMiddleware, (req: Request, res: Response) => {
  return res.json({ god: req.godUser });
});

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
router.get('/overview', godAuthMiddleware, async (req: Request, res: Response) => {
  const { client_id } = req.query as { client_id?: string };
  const today = new Date().toISOString().split('T')[0];

  let usersQ = supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('ativo', true);
  let regQ   = supabase.from('registros').select('*', { count: 'exact', head: true });
  let hojeQ  = supabase.from('registros').select('*', { count: 'exact', head: true }).eq('data', today);
  if (client_id) {
    usersQ = usersQ.eq('client_id', client_id);
    regQ   = regQ.eq('client_id', client_id);
    hojeQ  = hojeQ.eq('client_id', client_id);
  }

  const [
    { count: totalClients },
    { count: totalUsers },
    { count: totalRegistros },
    { count: totalGodUsers },
    { count: registrosHoje },
    { count: totalContadores },
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    usersQ, regQ,
    supabase.from('god_users').select('*', { count: 'exact', head: true }).eq('ativo', true),
    hojeQ,
    supabase.from('contadores').select('*', { count: 'exact', head: true }).eq('ativo', true),
  ]);
  return res.json({
    totalClients: totalClients ?? 0,
    totalUsers: totalUsers ?? 0,
    totalRegistros: totalRegistros ?? 0,
    registrosHoje: registrosHoje ?? 0,
    totalGodUsers: totalGodUsers ?? 0,
    totalContadores: totalContadores ?? 0,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/clients', godAuthMiddleware, async (_req: Request, res: Response) => {
  const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

router.post('/clients', godAuthMiddleware, async (req: Request, res: Response) => {
  const { subdomain, nome, adminPin, adminNome } = req.body as {
    subdomain?: string; nome?: string; adminPin?: string; adminNome?: string;
  };
  if (!subdomain || !nome) return res.status(400).json({ error: 'subdomain e nome são obrigatórios.' });
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(subdomain))
    return res.status(400).json({ error: 'Subdomínio inválido.' });
  if (!adminPin || !/^\d{4,6}$/.test(adminPin))
    return res.status(400).json({ error: 'PIN do administrador inválido (4–6 dígitos).' });
  if (!adminNome || adminNome.trim().length < 2)
    return res.status(400).json({ error: 'Nome do administrador é obrigatório.' });

  const { data, error } = await supabase.from('clients').insert({ subdomain, nome }).select().single();
  if (error) return res.status(400).json({ error: error.message });

  const newClient = data as { id: string };

  // Seed admin_config (legacy entry for compatibility)
  await supabase.from('admin_config').insert({
    client_id: newClient.id,
    password_hash: '',
    escala_padrao: 440,
    intervalo_padrao: 60,
  });

  // Create the first administrator in usuarios table
  await supabase.from('usuarios').insert({
    client_id: newClient.id,
    pin: adminPin,
    nome: adminNome.trim(),
    role: 'administrador',
    horas_diarias: 440,
    intervalo: 60,
  });

  return res.status(201).json(newClient);
});

router.patch('/clients/:id', godAuthMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nome, subdomain, ativo } = req.body as { nome?: string; subdomain?: string; ativo?: boolean };
  const updates: Record<string, unknown> = {};
  if (nome !== undefined) updates.nome = nome;
  if (ativo !== undefined) updates.ativo = ativo;
  if (subdomain !== undefined) {
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(subdomain))
      return res.status(400).json({ error: 'Subdomínio inválido.' });
    updates.subdomain = subdomain;
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nada para atualizar.' });

  const { data, error } = await supabase.from('clients').update(updates).eq('id', id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
});

router.delete('/clients/:id', godAuthMiddleware, async (req: Request, res: Response) => {
  const { error } = await supabase.from('clients').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  return res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// USERS — visão global
// ─────────────────────────────────────────────────────────────────────────────
router.get('/users', godAuthMiddleware, async (req: Request, res: Response) => {
  const { search, ativo, created_after, created_before, client_id } = req.query as Record<string, string>;
  let query = supabase.from('usuarios')
    .select('*, clients(id, subdomain, nome)')
    .order('nome');
  if (search) query = query.ilike('nome', `%${search}%`);
  if (ativo !== undefined && ativo !== '') query = query.eq('ativo', ativo === 'true');
  if (created_after) query = query.gte('created_at', created_after);
  if (created_before) query = query.lte('created_at', created_before + 'T23:59:59');
  if (client_id) query = query.eq('client_id', client_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// ─────────────────────────────────────────────────────────────────────────────
// RELATÓRIOS GLOBAIS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/registros', godAuthMiddleware, async (req: Request, res: Response) => {
  const {
    data_ini, data_fim, user_id, search, client_id,
    page = '1', per_page = '50', format,
  } = req.query as Record<string, string>;

  const limit = Math.min(parseInt(per_page) || 50, 200);
  const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

  // Busca registros + nome do usuário + cliente
  let query = supabase
    .from('registros')
    .select('*, usuarios(id, nome, pin), clients(id, subdomain, nome)', { count: 'exact' })
    .order('data', { ascending: false })
    .order('hora_inicial', { ascending: false });

  if (data_ini) query = query.gte('data', data_ini);
  if (data_fim) query = query.lte('data', data_fim);
  if (user_id) query = query.eq('usuario_id', user_id);
  if (client_id) query = query.eq('client_id', client_id);
  if (search) {
    // Filtra por nome via join — limitação: Supabase não suporta ilike em join direto
    // Resolvemos filtrando após a query quando search está presente
  }

  if (format !== 'csv') query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });

  type RegistroRow = {
    id: number; usuario_id: string; data: string;
    hora_inicial: string | null; inicio_intervalo: string | null;
    fim_intervalo: string | null; hora_final: string | null;
    horas_diarias: number | null; extra: boolean | null; oculto: boolean;
    usuarios: { id: string; nome: string; pin: string } | null;
  };

  let rows = (data ?? []) as RegistroRow[];

  // Filtro de nome pós-query
  if (search) {
    const term = search.toLowerCase();
    rows = rows.filter(r => r.usuarios?.nome?.toLowerCase().includes(term));
  }

  if (format === 'csv') {
    const header = 'Data,Usuario,PIN,Entrada,Ini.Intervalo,Fim.Intervalo,Saida,Horas,Extra\n';
    const lines = rows.map(r =>
      [
        r.data,
        r.usuarios?.nome ?? '',
        r.usuarios?.pin ?? '',
        r.hora_inicial ?? '',
        r.inicio_intervalo ?? '',
        r.fim_intervalo ?? '',
        r.hora_final ?? '',
        r.horas_diarias != null ? (r.horas_diarias / 60).toFixed(2) : '',
        r.extra ? 'Sim' : 'Não',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="registros-god.csv"');
    return res.send('﻿' + header + lines); // BOM para Excel
  }

  return res.json({ registros: rows, total: count ?? rows.length, page: parseInt(page), per_page: limit });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTADORES — CRUD completo
// ─────────────────────────────────────────────────────────────────────────────
router.get('/contadores', godAuthMiddleware, async (req: Request, res: Response) => {
  const { search, ativo } = req.query as Record<string, string>;
  let query = supabase.from('contadores').select('id, email, nome, ativo, created_at').order('nome');
  if (search) query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%`);
  if (ativo !== undefined && ativo !== '') query = query.eq('ativo', ativo === 'true');

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const contadores = (data ?? []) as { id: number; email: string; nome: string; ativo: boolean; created_at: string }[];
  if (contadores.length === 0) return res.json([]);

  // Busca as conexões de cada contador + resolve subdomain via admin_config → clients
  const contIds = contadores.map(c => c.id);
  const { data: connections } = await supabase
    .from('contador_clientes')
    .select('contador_id, nome_conexao, connection_type, client_uuid')
    .in('contador_id', contIds);

  type ConexaoRaw = { contador_id: number; nome_conexao: string; connection_type: string; client_uuid: string };
  const conns = (connections ?? []) as ConexaoRaw[];

  let connsByContador = new Map<number, { subdomain: string; nome: string; nome_conexao: string; connection_type: string }[]>();

  if (conns.length > 0) {
    const uuids = [...new Set(conns.map(c => c.client_uuid))];
    const { data: configs } = await supabase
      .from('admin_config').select('client_uuid, client_id').in('client_uuid', uuids);
    const uuidToClientId = new Map((configs ?? []).map((ac: { client_uuid: string; client_id: string }) => [ac.client_uuid, ac.client_id]));

    const clientIds = [...new Set([...uuidToClientId.values()])];
    const { data: clients } = await supabase
      .from('clients').select('id, subdomain, nome').in('id', clientIds);
    const clientMap = new Map((clients ?? []).map((c: { id: string; subdomain: string; nome: string }) => [c.id, c]));

    for (const conn of conns) {
      const clientId = uuidToClientId.get(conn.client_uuid);
      const clientInfo = clientId ? clientMap.get(clientId) : null;
      if (!clientInfo) continue;
      const arr = connsByContador.get(conn.contador_id) ?? [];
      arr.push({ subdomain: clientInfo.subdomain, nome: clientInfo.nome, nome_conexao: conn.nome_conexao, connection_type: conn.connection_type });
      connsByContador.set(conn.contador_id, arr);
    }
  }

  return res.json(contadores.map(c => ({ ...c, conexoes: connsByContador.get(c.id) ?? [] })));
});

router.post('/contadores', godAuthMiddleware, async (req: Request, res: Response) => {
  const { email, nome, senha } = req.body as { email?: string; nome?: string; senha?: string };
  if (!email || !nome || !senha) return res.status(400).json({ error: 'email, nome e senha são obrigatórios.' });

  // Usa o mesmo hash do sistema de contadores (SHA-256) para compatibilidade
  const password_hash = crypto.createHash('sha256').update(senha).digest('hex');
  const { data, error } = await supabase
    .from('contadores')
    .insert({ email: email.trim().toLowerCase(), nome: nome.trim(), password_hash, ativo: true })
    .select('id, email, nome, ativo, created_at')
    .single();
  if (error) return res.status(400).json({ error: error.message });
  return res.status(201).json(data);
});

router.patch('/contadores/:id', godAuthMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { email, nome, ativo, senha } = req.body as { email?: string; nome?: string; ativo?: boolean; senha?: string };
  const updates: Record<string, unknown> = {};
  if (email !== undefined) updates.email = email.trim().toLowerCase();
  if (nome !== undefined) updates.nome = nome.trim();
  if (ativo !== undefined) updates.ativo = ativo;
  if (senha) updates.password_hash = crypto.createHash('sha256').update(senha).digest('hex');
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nada para atualizar.' });

  const { data, error } = await supabase
    .from('contadores').update(updates).eq('id', id)
    .select('id, email, nome, ativo, created_at').single();
  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
});

router.delete('/contadores/:id', godAuthMiddleware, async (req: Request, res: Response) => {
  const { error } = await supabase.from('contadores').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  return res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS — senha global de admin
// ─────────────────────────────────────────────────────────────────────────────

router.get('/settings', godAuthMiddleware, async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('god_settings').select('global_admin_password_hash, updated_at').eq('id', 1).single();
  if (error) return res.status(500).json({ error: error.message });
  const row = data as { global_admin_password_hash: string; updated_at: string };
  return res.json({
    hasGlobalPassword: row.global_admin_password_hash.length > 0,
    updated_at: row.updated_at,
  });
});

router.put('/settings/senha-global', godAuthMiddleware, async (req: Request, res: Response) => {
  const { senha } = req.body as { senha?: string };
  if (!senha || senha.length < 4) {
    return res.status(400).json({ error: 'Senha deve ter ao menos 4 caracteres.' });
  }
  const hash = crypto.createHash('sha256').update(senha).digest('hex');
  const { error } = await supabase
    .from('god_settings')
    .update({ global_admin_password_hash: hash, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

router.delete('/settings/senha-global', godAuthMiddleware, async (_req: Request, res: Response) => {
  const { error } = await supabase
    .from('god_settings')
    .update({ global_admin_password_hash: '', updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN MEMBERS — administradores e membros (visão god)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/admin-members', godAuthMiddleware, async (req: Request, res: Response) => {
  const { client_id } = req.query as Record<string, string>;
  let query = supabase
    .from('usuarios')
    .select('id, pin, nome, cargo, role, ativo, created_at, client_id, clients(id, subdomain, nome)')
    .in('role', ['administrador', 'membro'])
    .order('nome', { ascending: true });
  if (client_id) query = query.eq('client_id', client_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? []);
});

router.post('/admin-members', godAuthMiddleware, async (req: Request, res: Response) => {
  const { client_id, pin, nome, cargo, role } = req.body as {
    client_id?: string; pin?: string; nome?: string; cargo?: string; role?: string;
  };
  if (!client_id) return res.status(400).json({ error: 'client_id é obrigatório.' });
  if (!pin || !/^\d{4,6}$/.test(pin)) return res.status(400).json({ error: 'PIN inválido (4–6 dígitos).' });
  if (!nome || nome.trim().length < 2) return res.status(400).json({ error: 'Nome inválido.' });
  const finalRole = ['administrador', 'membro'].includes(role ?? '') ? role : 'administrador';

  const { count } = await supabase.from('usuarios')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', client_id).eq('pin', pin);
  if ((count ?? 0) > 0) return res.status(409).json({ error: 'PIN já está em uso neste cliente.' });

  const { data, error } = await supabase.from('usuarios')
    .insert({ client_id, pin, nome: nome.trim(), role: finalRole, cargo: cargo?.trim() || null, horas_diarias: 440, intervalo: 60 })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  return res.status(201).json(data);
});

router.patch('/admin-members/:id', godAuthMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nome, cargo, role, ativo, novoPin } = req.body as {
    nome?: string; cargo?: string; role?: string; ativo?: boolean; novoPin?: string;
  };
  const updates: Record<string, unknown> = {};
  if (nome !== undefined) updates.nome = nome.trim();
  if (cargo !== undefined) updates.cargo = cargo.trim() || null;
  if (role !== undefined && ['administrador', 'membro'].includes(role)) updates.role = role;
  if (ativo !== undefined) updates.ativo = ativo;

  if (novoPin !== undefined) {
    if (!/^\d{4,6}$/.test(novoPin)) return res.status(400).json({ error: 'PIN inválido (4–6 dígitos).' });
    const { data: existing } = await supabase.from('usuarios').select('client_id, pin').eq('id', id).single();
    if (!existing) return res.status(404).json({ error: 'Membro não encontrado.' });
    if (novoPin !== (existing as { pin: string }).pin) {
      const { count } = await supabase.from('usuarios')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', (existing as { client_id: string }).client_id)
        .eq('pin', novoPin).neq('id', id);
      if ((count ?? 0) > 0) return res.status(409).json({ error: 'PIN já está em uso neste cliente.' });
      updates.pin = novoPin;
    }
  }

  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nada para atualizar.' });
  const { data, error } = await supabase.from('usuarios').update(updates).eq('id', id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
});

router.delete('/admin-members/:id', godAuthMiddleware, async (req: Request, res: Response) => {
  const { error } = await supabase.from('usuarios').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  return res.json({ ok: true });
});

export default router;
