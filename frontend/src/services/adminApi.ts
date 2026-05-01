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

  getRelatorio: (inicio?: string, fim?: string) => {
    const params = new URLSearchParams();
    if (inicio) params.set('inicio', inicio);
    if (fim) params.set('fim', fim);
    return request<{ registros: RegistroAdmin[] }>(`${BASE}/relatorio?${params}`);
  },

  listUsuarios: () =>
    request<{ usuarios: Usuario[] }>(`${BASE}/usuarios`),

  createUsuario: (pin: string, nome: string) =>
    request<{ usuario: Usuario }>(`${BASE}/usuarios`, {
      method: 'POST',
      body: JSON.stringify({ pin, nome }),
    }),

  updateUsuario: (pin: string, data: Partial<{ nome: string; ativo: boolean; novoPin: string }>) =>
    request<{ usuario: Usuario }>(`${BASE}/usuarios/${pin}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteUsuario: (pin: string) =>
    request<{ ok: boolean }>(`${BASE}/usuarios/${pin}`, { method: 'DELETE' }),

  saveToken: (token: string) => sessionStorage.setItem('admin_token', token),
  clearToken: () => sessionStorage.removeItem('admin_token'),
  hasToken: () => !!sessionStorage.getItem('admin_token'),
};
