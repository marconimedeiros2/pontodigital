const BASE = '/api/contador';

function getToken(): string | null {
  return sessionStorage.getItem('contador_token');
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
  if (!res.ok) {
    if (res.status === 401) {
      sessionStorage.removeItem('contador_token');
      sessionStorage.removeItem('contador_nome');
      window.location.reload();
    }
    throw new Error(data.error || 'Erro na requisição');
  }
  return data as T;
}

export interface ContadorCliente {
  id: number;
  nome: string;
  client_uuid: string;
  connection_type: 'uuid' | 'api_key';
  created_at: string;
  last_accessed_at: string | null;
}

export interface RegistroContador {
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

export const contadorApi = {
  login: (email: string, senha: string) =>
    request<{ token: string; nome: string }>(`${BASE}/login`, {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    }),

  logout: () =>
    request<{ ok: boolean }>(`${BASE}/logout`, { method: 'POST' }),

  connect: (chave: string, nome: string) =>
    request<{ cliente: ContadorCliente }>(`${BASE}/connect`, {
      method: 'POST',
      body: JSON.stringify({ chave, nome }),
    }),

  listClientes: () =>
    request<{ clientes: ContadorCliente[] }>(`${BASE}/clientes`),

  deleteCliente: (id: number) =>
    request<{ ok: boolean }>(`${BASE}/clientes/${id}`, { method: 'DELETE' }),

  getRelatorio: (clienteId: number, inicio?: string, fim?: string) => {
    const params = new URLSearchParams({ clienteId: String(clienteId) });
    if (inicio) params.set('inicio', inicio);
    if (fim) params.set('fim', fim);
    return request<{ registros: RegistroContador[] }>(`${BASE}/relatorio?${params}`);
  },

  saveToken: (token: string) => sessionStorage.setItem('contador_token', token),
  saveNome: (nome: string) => sessionStorage.setItem('contador_nome', nome),
  clearSession: () => {
    sessionStorage.removeItem('contador_token');
    sessionStorage.removeItem('contador_nome');
  },
  hasToken: () => !!sessionStorage.getItem('contador_token'),
  getNome: () => sessionStorage.getItem('contador_nome') ?? '',
};
