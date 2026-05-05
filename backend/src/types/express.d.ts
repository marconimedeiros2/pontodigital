import 'express';

export interface TenantClient {
  id: string;
  subdomain: string;
  nome: string;
  ativo: boolean;
  created_at: string;
  [key: string]: unknown; // campos extras do banco
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Cliente detectado pelo subdomínio. null = domínio raiz (sem tenant). */
    client: TenantClient | null;
    /** Subdomínio extraído da requisição (ex: "zico"). */
    subdomain: string | null;
  }
}
