-- ================================================================
-- Tabela de clientes (multi-tenant por subdomínio)
-- Execute no Supabase SQL Editor
-- ================================================================

CREATE TABLE IF NOT EXISTS clients (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subdomain   TEXT        UNIQUE NOT NULL,          -- ex: "zico"
  nome        TEXT        NOT NULL,                 -- ex: "Empresa do Zico"
  ativo       BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para lookup rápido pelo subdomínio
CREATE INDEX IF NOT EXISTS idx_clients_subdomain ON clients (subdomain);

-- Row-Level Security (opcional mas recomendado)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Política: apenas service_role pode ler/escrever (o backend usa anon key)
-- Se quiser leitura pelo backend anon key, libere:
CREATE POLICY "backend_read_clients"
  ON clients FOR SELECT
  USING (true);  -- ajuste conforme sua política de segurança

-- ================================================================
-- Inserir o primeiro cliente (zico)
-- ================================================================
INSERT INTO clients (subdomain, nome)
VALUES ('zico', 'Empresa Zico')
ON CONFLICT (subdomain) DO NOTHING;
