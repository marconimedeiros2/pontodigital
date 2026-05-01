export type TipoRegistro = 'hora_inicial' | 'inicio_intervalo' | 'fim_intervalo' | 'hora_final';

export type View = 'home' | 'history' | 'admin';

export interface Registro {
  id: number;
  pin: string;
  data: string;
  hora_inicial: string | null;
  inicio_intervalo: string | null;
  fim_intervalo: string | null;
  hora_final: string | null;
  completo?: boolean;
}

export interface RegistroResponse {
  success: boolean;
  tipo: TipoRegistro;
  label: string;
  horario: string;
  data: string;
  proximaEtapa: TipoRegistro | null;
  proximaEtapaLabel: string | null;
  cicloCompleto: boolean;
  error?: string;
}

export interface HojeResponse {
  registro: Registro | null;
  proximaEtapa: TipoRegistro | null;
  proximaEtapaLabel: string | null;
  cicloCompleto: boolean;
}

export interface HistoricoResponse {
  registros: Registro[];
}

export const STEP_ORDER: TipoRegistro[] = [
  'hora_inicial',
  'inicio_intervalo',
  'fim_intervalo',
  'hora_final',
];

export const STEP_LABELS: Record<TipoRegistro, string> = {
  hora_inicial: 'Entrada',
  inicio_intervalo: 'Início do Intervalo',
  fim_intervalo: 'Fim do Intervalo',
  hora_final: 'Saída',
};

export const STEP_ICONS: Record<TipoRegistro, string> = {
  hora_inicial: '🟢',
  inicio_intervalo: '🟡',
  fim_intervalo: '🔵',
  hora_final: '🔴',
};
