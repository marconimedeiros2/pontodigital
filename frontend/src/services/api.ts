import type { RegistroResponse, HojeResponse, HistoricoResponse } from '../types';

const BASE = '/api/ponto';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro na requisição');
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
