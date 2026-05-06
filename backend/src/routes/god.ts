/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                     GOD MODE — BACKEND                      ║
 * ║  Super admin global. Todas as ações são logadas.            ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { supabase } from '../database/supabaseClient';
import type { GodUser } from '../types/express';

const router = Router();

// ── Session store: token → GodUser ────────────────────────────────────────────
const godSessions = new Map<string, GodUser>();

// ── Rate limiter ───────────────────────────────────────────────────────────────
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function checkRate(ip: string): boolean {
  const now = Date.now();
  let e = loginAttempts.get(ip);
  if (!e || now > e.resetAt) { e = { count: 0, resetAt: now + 60_000 }; loginAttempts.set(ip, e); }
  e.count++;
  return e.count <= 10;
}

// ── Password helpers (scrypt — muito mais seguro que SHA-256) ─────────────────
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':');
    const hashBuf = Buffer.from(hash, 'hex');
    const derived = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(hashBuf, derived);
  } catch { return false; }
}

function generateToken(): string { return crypto.randomBytes(32).toString('hex'); }
function getIp(req: Request): string {
  return String(req.headers['x-forwarded-for'] || req.ip || 'unknown').replace('::ffff:', '').split(',')[0].trim();
}

// ── Audit helper ───────────────────────────────────────────────────────────────
async function audit(
  god: GodUser,
  action: string,
  opts: { targetType?: string; targetId?: string; targetLabel?: string; metadata?: object; ip?: string } = {}
) {
  await supabase.from('god_audit_logs').insert({
    god_user_id: god.id,
    god_email: god.email,
    action,
    target_type: opts.targetType ?? null,
    target_id: opts.targetId ? String(opts.targetId) : null,
    target_label: opts.targetLabel ?? null,
    metadata: opts.metadata ?? null,
    ip: opts.ip ?? null,
  });
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

/** POST /api/god/auth/setup — bootstrap: cria o primeiro GOD user (só funciona se não houver nenhum) */
router.post('/auth/setup', async (req: Request, res: Response) => {
  const { email, nome, senha } = req.body as { email?: string; nome?: string; senha?: string };
  if (!email || !nome || !senha) return res.status(400).json({ error: 'email, nome e senha são obrigatórios.' });
  if (senha.length < 10) return res.status(400).json({ error: 'Senha deve ter ao menos 10 caracteres.' });

  const { count } = await supabase.from('god_users').select('*', { count: 'exact', head: true });
  if ((count ?? 0) > 0) return res.status(403).json({ error: 'Setup já realizado. Contate o GOD admin.' });

  const { data, error } = await supabase.from('god_users').insert({
    email: email.trim().toLowerCase(),
    nome: nome.trim(),
    password_hash: hashPassword(senha),
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  console.log(`[GOD] Primeiro GOD user criado: ${email}`);
  return res.status(201).json({ ok: true, id: (data as GodUser).id });
});

/** POST /api/god/auth/login */
router.post('/auth/login', async (req: Request, res: Response) => {
  const ip = getIp(req);
  if (!checkRate(ip)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 1 minuto.' });

  const { email, senha } = req.body as { email?: string; senha?: string };
  if (!email || !senha) return res.status(400).json({ error: 'Email e senha obrigatórios.' });

  const { data, error } = await supabase
    .from('god_users')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .eq('ativo', true)
    .single();

  if (error || !data) return res.status(401).json({ error: 'Credenciais inválidas.' });

  const god = data as GodUser & { password_hash: string };
  if (!verifyPassword(senha, god.password_hash)) return res.status(401).json({ error: 'Credenciais inválidas.' });

  const token = generateToken();
  const { password_hash: _ph, ...safeGod } = god;
  godSessions.set(token, safeGod as GodUser);

  await supabase.from('god_users').update({ last_login: new Date().toISOString() }).eq('id', god.id);
  await audit(safeGod as GodUser, 'auth.login', { ip });

  console.log(`[GOD] Login: ${email} (${ip})`);
  return res.json({ token, god: safeGod });
});

/** POST /api/god/auth/logout */
router.post('/auth/logout', godAuthMiddleware, async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '') ?? '';
  godSessions.delete(token);
  await audit(req.godUser!, 'auth.logout', { ip: getIp(req) });
  return res.json({ ok: true });
});

/** GET /api/god/auth/me */
router.get('/auth/me', godAuthMiddleware, (_req: Request, res: Response) => {
  return res.json({ god: _req.godUser });
});

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW — stats globais
// ─────────────────────────────────────────────────────────────────────────────
router.get('/overview', godAuthMiddleware, async (req: Request, res: Response) => {
  const [
    { count: totalClients },
    { count: totalUsers },
    { count: totalRegistros },
    { count: totalGodUsers },
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('ativo', true),
    supabase.from('registros').select('*', { count: 'exact', head: true }),
    supabase.from('god_users').select('*', { count: 'exact', head: true }).eq('ativo', true),
  ]);

  // Registros de hoje
  const today = new Date().toISOString().split('T')[0];
  const { count: registrosHoje } = await supabase
    .from('registros').select('*', { count: 'exact', head: true }).eq('data', today);

  await audit(req.godUser!, 'overview.view', { ip: getIp(req) });

  return res.json({
    totalClients: totalClients ?? 0,
    totalUsers: totalUsers ?? 0,
    totalRegistros: totalRegistros ?? 0,
    registrosHoje: registrosHoje ?? 0,
    totalGodUsers: totalGodUsers ?? 0,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/clients', godAuthMiddleware, async (req: Request, res: Response) => {
  const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  await audit(req.godUser!, 'client.list', { ip: getIp(req) });
  return res.json(data);
});

router.post('/clients', godAuthMiddleware, async (req: Request, res: Response) => {
  const { subdomain, nome } = req.body as { subdomain?: string; nome?: string };
  if (!subdomain || !nome) return res.status(400).json({ error: 'subdomain e nome são obrigatórios.' });
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(subdomain))
    return res.status(400).json({ error: 'Subdomínio inválido. Use apenas letras minúsculas, números e hífen.' });

  const { data, error } = await supabase.from('clients').insert({ subdomain, nome }).select().single();
  if (error) return res.status(400).json({ error: error.message });

  await audit(req.godUser!, 'client.create', { targetType: 'client', targetId: (data as { id: string }).id, targetLabel: nome, ip: getIp(req) });
  return res.status(201).json(data);
});

router.patch('/clients/:id', godAuthMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nome, ativo } = req.body as { nome?: string; ativo?: boolean };
  const updates: Record<string, unknown> = {};
  if (nome !== undefined) updates.nome = nome;
  if (ativo !== undefined) updates.ativo = ativo;
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nada para atualizar.' });

  const { data, error } = await supabase.from('clients').update(updates).eq('id', id).select().single();
  if (error) return res.status(400).json({ error: error.message });

  await audit(req.godUser!, 'client.update', { targetType: 'client', targetId: id, targetLabel: (data as { nome: string }).nome, metadata: updates, ip: getIp(req) });
  return res.json(data);
});

router.delete('/clients/:id', godAuthMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data: client } = await supabase.from('clients').select('nome,subdomain').eq('id', id).single();
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });

  await audit(req.godUser!, 'client.delete', {
    targetType: 'client', targetId: id,
    targetLabel: (client as { nome: string } | null)?.nome ?? id,
    ip: getIp(req),
  });
  return res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// USERS — visão global de todos os usuários
// ─────────────────────────────────────────────────────────────────────────────
router.get('/users', godAuthMiddleware, async (req: Request, res: Response) => {
  const { search, ativo } = req.query as { search?: string; ativo?: string };
  let query = supabase.from('usuarios').select('*').order('nome');
  if (search) query = query.ilike('nome', `%${search}%`);
  if (ativo !== undefined) query = query.eq('ativo', ativo === 'true');

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  await audit(req.godUser!, 'user.list', { ip: getIp(req) });
  return res.json(data);
});

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────────────────────────────────────
router.get('/audit', godAuthMiddleware, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const offset = Number(req.query.offset ?? 0);

  const { data, error, count } = await supabase
    .from('god_audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ logs: data, total: count ?? 0 });
});

// ─────────────────────────────────────────────────────────────────────────────
// IMPERSONATION — token temporário para entrar como cliente
// ─────────────────────────────────────────────────────────────────────────────
// Armazena tokens de impersonação: token → { clientId, godUserId, expiresAt }
const impersonationTokens = new Map<string, { clientId: string; godId: string; expiresAt: number }>();

router.post('/impersonate/:clientId', godAuthMiddleware, async (req: Request, res: Response) => {
  const { clientId } = req.params;
  const { data: client, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
  if (error || !client) return res.status(404).json({ error: 'Cliente não encontrado.' });

  const token = generateToken();
  impersonationTokens.set(token, {
    clientId,
    godId: req.godUser!.id,
    expiresAt: Date.now() + 30 * 60_000, // 30 minutos
  });

  await audit(req.godUser!, 'impersonation.start', {
    targetType: 'client', targetId: clientId,
    targetLabel: (client as { nome: string }).nome, ip: getIp(req),
  });

  console.log(`[GOD] ${req.godUser!.email} iniciou impersonação do cliente ${(client as { subdomain: string }).subdomain}`);
  return res.json({ token, client, expiresInMinutes: 30 });
});

// Valida token de impersonação (chamado pelo middleware de admin)
export function validateImpersonationToken(token: string): string | null {
  const entry = impersonationTokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { impersonationTokens.delete(token); return null; }
  return entry.clientId;
}

export default router;
