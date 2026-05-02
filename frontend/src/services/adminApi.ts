const BASE = '/api/admin';

function getToken(): string | null {
  return sessionStorage.getItem('admin_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro na requisição');
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
  created_at: string;
}

export const adminApi = {
  login: (senha: string) =>
    request<{ token: string }>(`${BASE}/login`, {
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
    fields: Partial<Pick<RegistroAdmin, 'hora_inicial' | 'inicio_intervalo' | 'fim_intervalo' | 'hora_final'> & { oculto: boolean }>
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

  saveToken: (token: string) => sessionStorage.setItem('admin_token', token),
  clearToken: () => sessionStorage.removeItem('admin_token'),
  hasToken: () => !!sessionStorage.getItem('admin_token'),
};
