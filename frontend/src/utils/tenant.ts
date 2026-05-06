const BASE_DOMAIN = import.meta.env.VITE_BASE_DOMAIN || 'flowbase.tech';

/**
 * Extrai o subdomínio do hostname atual do browser.
 * "zico.flowbase.tech" → "zico"
 * "flowbase.tech"      → null
 * "localhost"          → null (mas verifica path /god e ?__tenant= para dev)
 */
export function getSubdomain(): string | null {
  const host = window.location.hostname.toLowerCase();

  // Dev local: suporte via path (/god) ou query param (?__tenant=god)
  if (host === 'localhost' || host === '127.0.0.1') {
    const params = new URLSearchParams(window.location.search);
    const qTenant = params.get('__tenant');
    if (qTenant) return qTenant;

    const pathSeg = window.location.pathname.split('/')[1];
    if (pathSeg === 'god') return 'god';

    return null;
  }

  if (!host.endsWith(`.${BASE_DOMAIN}`)) return null;

  const sub = host.slice(0, host.length - BASE_DOMAIN.length - 1);
  if (!sub || sub.includes('.')) return null;

  return sub;
}

/**
 * Retorna true quando o app está rodando num subdomínio de tenant.
 */
export function isTenantContext(): boolean {
  return getSubdomain() !== null;
}

/**
 * Busca o contexto do cliente ativo no backend.
 * Retorna null se estiver no domínio raiz.
 */
export async function fetchTenantContext(): Promise<{
  subdomain: string | null;
  client: Record<string, unknown> | null;
}> {
  const res = await fetch('/api/tenant');
  return res.json();
}
