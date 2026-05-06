import type { RegistroResponse, HojeResponse, HistoricoResponse } from '../types';
import { getSubdomain } from '../utils/tenant';

const BASE = '/api/ponto';

function tenantHeaders(): Record<string, string> {
  const sub = getSubdomain();
  return sub ? { 'X-Tenant': sub } : {};
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...tenantHeaders() },
    ...options,
  });
  
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error('Erro de conexão: o servidor pode estar offline.');
  }

  if (!res.ok) throw new Error(data?.error || 'Erro na requisição');
  return data as T;
}

export const api = {
  registrar: (pin: string) =>
    request<RegistroResponse>(`${BASE}/registrar`, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    }),

  getHoje: (pin: string) =>
    request<HojeResponse>(`${BASE}/hoje/${pin}`),

  getHistorico: (pin: string) =>
    request<HistoricoResponse>(`${BASE}/historico/${pin}`),
};
