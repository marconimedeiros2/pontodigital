import * as XLSX from 'xlsx';
import type { RegistroAdmin } from '../services/adminApi';

function calcWorkTime(reg: RegistroAdmin): string {
  if (!reg.hora_inicial || !reg.hora_final) return '—';
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const total = toMin(reg.hora_final) - toMin(reg.hora_inicial);
  const interval =
    reg.inicio_intervalo && reg.fim_intervalo
      ? toMin(reg.fim_intervalo) - toMin(reg.inicio_intervalo)
      : 0;
  const worked = total - interval;
  if (worked < 0) return '—';
  return `${Math.floor(worked / 60)}h${String(worked % 60).padStart(2, '0')}`;
}

function formatDate(d: string): string {
  const [y, m, day] = d.split('-');
  return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('pt-BR');
}

function getStatus(reg: RegistroAdmin): string {
  if (reg.hora_final) return 'Saída';
  if (reg.inicio_intervalo && !reg.fim_intervalo) return 'Em Intervalo';
  if (reg.hora_inicial) return 'Presente';
  return 'Ausente';
}

export function exportToXlsx(registros: RegistroAdmin[], filename: string): void {
  const rows = registros.map((r) => ({
    'Data': formatDate(r.data),
    'Funcionário': r.nome,
    'PIN': r.pin,
    'Entrada': r.hora_inicial ?? '—',
    'Início Intervalo': r.inicio_intervalo ?? '—',
    'Fim Intervalo': r.fim_intervalo ?? '—',
    'Saída': r.hora_final ?? '—',
    'Horas Trabalhadas': calcWorkTime(r),
    'Status': getStatus(r),
    'Jornada Completa': r.completo ? 'Sim' : 'Não',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Larguras das colunas
  ws['!cols'] = [
    { wch: 12 }, // Data
    { wch: 24 }, // Funcionário
    { wch: 10 }, // PIN
    { wch: 10 }, // Entrada
    { wch: 18 }, // Início Intervalo
    { wch: 14 }, // Fim Intervalo
    { wch: 8  }, // Saída
    { wch: 18 }, // Horas Trabalhadas
    { wch: 14 }, // Status
    { wch: 18 }, // Jornada Completa
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registros');

  XLSX.writeFile(wb, `${filename}.xlsx`);
}
