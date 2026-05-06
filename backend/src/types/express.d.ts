import 'express';

export interface TenantClient {
  id: string;
  subdomain: string;
  nome: string;
  ativo: boolean;
  created_at: string;
  [key: string]: unknown;
}

export interface GodUser {
  id: string;
  email: string;
  nome: string;
  ativo: boolean;
  last_login: string | null;
  created_at: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    client: TenantClient | null;
    subdomain: string | null;
    godUser: GodUser | null;
  }
}
