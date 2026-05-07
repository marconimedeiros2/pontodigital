import { Request, Response, NextFunction } from 'express';
import { supabase } from '../database/supabaseClient';

// Domínio base configurável via .env (ex: "flowbase.tech")
const BASE_DOMAIN = (process.env.BASE_DOMAIN || 'flowbase.tech').toLowerCase();

// Apenas letras, números e hífen — sem injeção de SQL ou path traversal
const SUBDOMAIN_RE = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$|^[a-z0-9]$/i;

/**
 * Extrai o subdomínio de um hostname.
 * "zico.flowbase.tech" → "zico"
 * "flowbase.tech"      → null  (domínio raiz)
 * "localhost"          → null  (desenvolvimento local)
 */
function extractSubdomain(hostname: string): string | null {
  const host = hostname.toLowerCase().split(':')[0]; // remove porta se presente

  if (host === 'localhost' || host === '127.0.0.1') return null;

  if (!host.endsWith(`.${BASE_DOMAIN}`)) {
    // Host não pertence ao domínio configurado
    return null;
  }

  const sub = host.slice(0, host.length - BASE_DOMAIN.length - 1); // remove ".flowbase.tech"
  if (!sub || sub.includes('.')) return null; // sub-sub-domínios não suportados

  return sub;
}

/**
 * Middleware multi-tenant por subdomínio.
 *
 * - Injeta req.subdomain (string | null)
 * - Injeta req.client    (TenantClient | null)
 *
 * Comportamento:
 *   Sem subdomínio → req.client = null, continua (domínio raiz / admin)
 *   Com subdomínio válido e cliente encontrado → injeta req.client, continua
 *   Com subdomínio mas cliente não encontrado  → 404
 *   Subdomínio com caracteres inválidos        → 400
 */
export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Resolve hostname: X-Forwarded-Host (nginx) > req.hostname > Host header
  const forwardedHost = (req.headers['x-forwarded-host'] as string | undefined)
    ?.split(',')[0]?.trim();
  const rawHost = forwardedHost ?? req.hostname ?? (req.headers.host as string) ?? '';
  const bareHost = rawHost.split(':')[0].toLowerCase();

  // Em dev (localhost), o frontend envia X-Tenant com o subdomain escolhido.
  // Em produção usamos apenas o hostname real — X-Tenant é ignorado por segurança.
  const isLocalDev = bareHost === 'localhost' || bareHost === '127.0.0.1';
  const xTenant = isLocalDev
    ? (req.headers['x-tenant'] as string | undefined)?.trim().toLowerCase()
    : undefined;

  // Se veio X-Tenant em dev, monta hostname sintético para reusar extractSubdomain
  const hostname = xTenant ? `${xTenant}.${BASE_DOMAIN}` : rawHost;
  const sub = extractSubdomain(hostname);

  req.subdomain = sub;
  req.client = null;

  // Sem subdomínio → domínio raiz (admin / marketing), segue normal
  if (!sub) return next();

  // Subdomínios reservados — não são tenants, não buscam no banco
  if (sub === 'god' || sub === 'contador') return next();

  // Validação de segurança: bloqueia subdomínios com caracteres perigosos
  if (!SUBDOMAIN_RE.test(sub)) {
    res.status(400).json({ error: 'Subdomínio inválido.' });
    return;
  }

  // Busca o cliente no banco
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('subdomain', sub)
    .eq('ativo', true)
    .single();

  if (error || !data) {
    res.status(404).json({ error: `Cliente "${sub}" não encontrado.` });
    return;
  }

  req.client = data;
  next();
}

/**
 * Middleware de guarda — use em rotas que EXIGEM um tenant ativo.
 * Retorna 401 se acessado sem subdomínio (domínio raiz).
 *
 * Uso: router.use(requireTenant)
 */
export function requireTenant(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.client) {
    res.status(401).json({ error: 'Acesso negado: tenant não identificado.' });
    return;
  }
  next();
}
