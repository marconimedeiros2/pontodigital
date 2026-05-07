const BASE_DOMAIN = import.meta.env.VITE_BASE_DOMAIN || 'flowbase.tech';

/**
 * Extrai o subdomínio do hostname atual do browser.
 * "zico.flowbase.tech" → "zico"
 * "flowbase.tech"      → null
 * "localhost"          → null (mas verifica ?__tenant= e sessionStorage para dev)
 */
export function getSubdomain(): string | null {
  const host = window.location.hostname.toLowerCase();

  // Dev local: suporte via query param (?__tenant=) ou sessionStorage
  if (host === 'localhost' || host === '127.0.0.1') {
    // 1. Prioridade máxima: query param ?__tenant=xxx
    const params = new URLSearchParams(window.location.search);
    const qTenant = params.get('__tenant');
    if (qTenant !== null) {
      if (qTenant === '') {
        // ?__tenant= vazio → força landing page (remove tenant da sessão)
        sessionStorage.removeItem('__dev_tenant');
        return null;
      }
      // Persiste na sessão para não precisar repetir na URL
      sessionStorage.setItem('__dev_tenant', qTenant);
      return qTenant;
    }

    // 2. Tenant persistido na sessão (set por ?__tenant= anterior)
    const storedTenant = sessionStorage.getItem('__dev_tenant');
    if (storedTenant) return storedTenant;

    // 3. Fallback: tenant padrão do .env (VITE_DEFAULT_TENANT=zico)
    const defaultTenant = import.meta.env.VITE_DEFAULT_TENANT as string | undefined;
    if (defaultTenant) return defaultTenant;

    return null;
  }

  if (!host.endsWith(`.${BASE_DOMAIN}`)) return null;

  const sub = host.slice(0, host.length - BASE_DOMAIN.length - 1);
  if (!sub || sub.includes('.')) return null;

  return sub;
}

/**
 * Força o tenant ativo no dev (localhost).
 * Útil para o painel god trocar de tenant sem alterar a URL.
 */
export function setDevTenant(subdomain: string | null): void {
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') return;
  if (subdomain) {
    sessionStorage.setItem('__dev_tenant', subdomain);
  } else {
    sessionStorage.removeItem('__dev_tenant');
  }
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
