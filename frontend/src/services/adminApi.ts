import { getSubdomain } from '../utils/tenant';

const BASE = '/api/admin';

function getToken(): string | null {
  return sessionStorage.getItem('admin_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const sub = getSubdomain();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(sub   ? { 'X-Tenant': sub }                  : {}),
  };
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    // 401 numa requisição autenticada = sessão expirada → recarregar
    // 401 no login (sem token) = senha errada → mostrar erro normalmente
    if (res.status === 401 && getToken()) {
      sessionStorage.removeItem('admin_token');
      window.location.reload();
    }
    throw new Error(data.error || 'Erro na requisição');
  }
  return data as T;
}

export interface RegistroAdmin {
  id: number;
  pin: string;
  nome: string;
  data: string;
  hora_inicial: string | null;
  inicio_intervalo: string | null;
  fim_intervalo: string | null;
  hora_final: string | null;
  completo: boolean;
  oculto?: boolean;
  extra?: boolean;
}

export interface DashboardStats {
  total: number;
  presentes: number;
  emIntervalo: number;
  saiu: number;
  completos: number;
}

export interface Usuario {
  pin: string;
  nome: string;
  ativo: boolean;
  horas_diarias: number;
  intervalo: number;
  role: 'usuario' | 'membro' | 'administrador';
  cargo: string | null;
  created_at: string;
}

export interface Membro {
  id: string;
  pin: string;
  nome: string;
  cargo: string | null;
  role: 'administrador' | 'membro';
  ativo: boolean;
  created_at: string;
}

export interface RegistroLog {
  id: number;
  registro_id: number;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  alterado_em: string;
  alterado_por: string;
  tipo: 'default' | 'custom';
  field_id: number | null;
}

export interface CustomField {
  id: number;
  nome: string;
  tipo: string;
  input_type: string;
  options: { label: string; value: string }[] | null;
  required: boolean;
  ordem: number;
  ativo: boolean;
  valor_padrao: string | null;
  created_at: string;
}

export interface CustomFieldValue {
  registro_id: number;
  field_id: number;
  value: string | null;
}

export interface ApiKey {
  id: number;
  nome: string;
  key_prefix: string;
  ativo: boolean;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export const adminApi = {
  login: (senha: string) =>
    request<{ token: string; role: 'administrador' | 'membro' | 'legacy'; nome: string }>(`${BASE}/login`, {
      method: 'POST',
      body: JSON.stringify({ senha }),
    }),

  logout: () =>
    request<{ ok: boolean }>(`${BASE}/logout`, { method: 'POST' }),

  changePassword: (senhaAtual: string, novaSenha: string) =>
    request<{ ok: boolean }>(`${BASE}/senha`, {
      method: 'POST',
      body: JSON.stringify({ senhaAtual, novaSenha }),
    }),

  getDashboard: (data?: string) =>
    request<{ data: string; registros: RegistroAdmin[]; stats: DashboardStats }>(
      `${BASE}/dashboard${data ? `?data=${data}` : ''}`
    ),

  getRelatorio: (inicio?: string, fim?: string, incluirOcultos = false) => {
    const params = new URLSearchParams();
    if (inicio) params.set('inicio', inicio);
    if (fim) params.set('fim', fim);
    if (incluirOcultos) params.set('incluirOcultos', 'true');
    return request<{ registros: RegistroAdmin[]; ocultosCount: number }>(`${BASE}/relatorio?${params}`);
  },

  listUsuarios: () =>
    request<{ usuarios: Usuario[] }>(`${BASE}/usuarios`),

  createUsuario: (pin: string, nome: string, horas_diarias: number, intervalo: number) =>
    request<{ usuario: Usuario }>(`${BASE}/usuarios`, {
      method: 'POST',
      body: JSON.stringify({ pin, nome, horas_diarias, intervalo }),
    }),

  updateUsuario: (pin: string, data: Partial<{ nome: string; ativo: boolean; novoPin: string; horas_diarias: number; intervalo: number }>) =>
    request<{ usuario: Usuario }>(`${BASE}/usuarios/${pin}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  bulkUpdateJornada: (pins: string[], horas_diarias: number) =>
    request<{ ok: boolean; updated: number }>(`${BASE}/usuarios/jornada`, {
      method: 'PATCH',
      body: JSON.stringify({ pins, horas_diarias }),
    }),

  bulkUpdateIntervalo: (pins: string[], intervalo: number) =>
    request<{ ok: boolean; updated: number }>(`${BASE}/usuarios/intervalo`, {
      method: 'PATCH',
      body: JSON.stringify({ pins, intervalo }),
    }),

  deleteUsuario: (pin: string) =>
    request<{ ok: boolean }>(`${BASE}/usuarios/${pin}`, { method: 'DELETE' }),

  updateRegistro: (
    id: number,
    fields: Partial<Pick<RegistroAdmin, 'hora_inicial' | 'inicio_intervalo' | 'fim_intervalo' | 'hora_final'> & { oculto: boolean; extra: boolean }>
  ) =>
    request<{ ok: boolean }>(`${BASE}/registros/${id}`, {
      method: 'PUT',
      body: JSON.stringify(fields),
    }),

  restoreRegistro: (id: number) =>
    request<{ ok: boolean }>(`${BASE}/registros/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ oculto: false }),
    }),

  createRegistro: (
    pin: string,
    data: string,
    fields: Partial<Pick<RegistroAdmin, 'hora_inicial' | 'inicio_intervalo' | 'fim_intervalo' | 'hora_final'>>
  ) =>
    request<{ ok: boolean; id: number }>(`${BASE}/registros`, {
      method: 'POST',
      body: JSON.stringify({ pin, data, ...fields }),
    }),

  hideRegistro: (id: number) =>
    request<{ ok: boolean }>(`${BASE}/registros/${id}`, { method: 'DELETE' }),

  getEscala: () =>
    request<{ escala_padrao: number; intervalo_padrao: number }>(`${BASE}/configuracoes/escala`),

  setEscala: (escala_padrao: number, intervalo_padrao: number) =>
    request<{ ok: boolean }>(`${BASE}/configuracoes/escala`, {
      method: 'PUT',
      body: JSON.stringify({ escala_padrao, intervalo_padrao }),
    }),

  getLogs: (registroId: number) =>
    request<{ logs: RegistroLog[] }>(`${BASE}/registros/${registroId}/logs`),

  // ── Custom Fields ──────────────────────────────────────────────────────────
  listCustomFields: (all = false) =>
    request<{ fields: CustomField[] }>(`${BASE}/custom-fields${all ? '?all=true' : ''}`),

  createCustomField: (data: Omit<CustomField, 'id' | 'created_at'>) =>
    request<{ field: CustomField }>(`${BASE}/custom-fields`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCustomField: (id: number, data: Partial<Omit<CustomField, 'id' | 'created_at'>>) =>
    request<{ field: CustomField }>(`${BASE}/custom-fields/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCustomField: (id: number) =>
    request<{ ok: boolean }>(`${BASE}/custom-fields/${id}`, { method: 'DELETE' }),

  reorderCustomFields: (orders: { id: number; ordem: number }[]) =>
    request<{ ok: boolean }>(`${BASE}/custom-fields/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ orders }),
    }),

  // ── Custom Field Values ────────────────────────────────────────────────────
  getCustomValues: (registroIds: number[]) =>
    request<{ values: CustomFieldValue[] }>(
      `${BASE}/custom-values?registroIds=${registroIds.join(',')}`
    ),

  upsertCustomValue: (registroId: number, fieldId: number, value: string | null) =>
    request<{ ok: boolean }>(`${BASE}/custom-values`, {
      method: 'PUT',
      body: JSON.stringify({ registroId, fieldId, value }),
    }),

  // ── Integrations ────────────────────────────────────────────────────────────
  getIntegrations: () =>
    request<{ uuid: string; keys: ApiKey[] }>(`${BASE}/integrations/info`),

  createApiKey: (nome: string) =>
    request<{ key: ApiKey; fullKey: string }>(`${BASE}/integrations/keys`, {
      method: 'POST',
      body: JSON.stringify({ nome }),
    }),

  revokeApiKey: (id: number) =>
    request<{ ok: boolean }>(`${BASE}/integrations/keys/${id}`, { method: 'DELETE' }),

  // ── Membros ────────────────────────────────────────────────────────────────
  listMembros: () =>
    request<{ membros: Membro[] }>(`${BASE}/membros`),

  createMembro: (pin: string, nome: string, role: 'administrador' | 'membro', cargo?: string) =>
    request<{ membro: Membro }>(`${BASE}/membros`, {
      method: 'POST',
      body: JSON.stringify({ pin, nome, role, cargo }),
    }),

  updateMembro: (pin: string, data: Partial<{ nome: string; cargo: string; role: 'administrador' | 'membro'; ativo: boolean; novoPin: string }>) =>
    request<{ membro: Membro }>(`${BASE}/membros/${pin}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteMembro: (pin: string) =>
    request<{ ok: boolean }>(`${BASE}/membros/${pin}`, { method: 'DELETE' }),

  saveToken: (token: string) => sessionStorage.setItem('admin_token', token),
  saveRole:  (role: string)  => sessionStorage.setItem('admin_role', role),
  saveNome:  (nome: string)  => sessionStorage.setItem('admin_nome', nome),
  clearToken: () => {
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_role');
    sessionStorage.removeItem('admin_nome');
  },
  hasToken: () => !!sessionStorage.getItem('admin_token'),
  getRole: (): 'administrador' | 'membro' | 'legacy' =>
    (sessionStorage.getItem('admin_role') as 'administrador' | 'membro' | 'legacy') || 'legacy',
  getNome: () => sessionStorage.getItem('admin_nome') || '',
};
