import * as XLSX from 'xlsx';
import type { RegistroAdmin } from '../services/adminApi';

function calcWorkTime(reg: RegistroAdmin): string {
  const { hora_inicial: entrada, inicio_intervalo: inicInt, fim_intervalo: fimInt, hora_final: saida } = reg;

  if (!entrada || !saida) return '—';

  const parseTime = (timeStr: string) => {
    const time = timeStr.includes(' ') ? timeStr.split(' ')[1] : timeStr;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const minEntrada = parseTime(entrada);
  let minSaida = parseTime(saida);

  // Trata virada de dia (ex: entrou 13:00 e saiu 00:10)
  if (minSaida < minEntrada) {
    minSaida += 24 * 60;
  }

  let totalInterval = 0;
  if (inicInt || fimInt) {
    // Se algum campo do intervalo estiver vazio mas o outro não, não calcula
    if (!inicInt || !fimInt) return '—';
    const minInic = parseTime(inicInt);
    let minFim = parseTime(fimInt);
    
    // Trata virada de dia no intervalo
    if (minFim < minInic) {
      minFim += 24 * 60;
    }
    totalInterval = minFim - minInic;
  }

  const worked = (minSaida - minEntrada) - totalInterval;

  if (worked < 0) return '—';

  const h = Math.floor(worked / 60);
  const m = worked % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
    'Extra': r.extra ? 'Sim' : 'Não',
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
