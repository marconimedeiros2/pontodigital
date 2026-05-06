import { Router, Request, Response } from 'express';
import { db } from '../database/db';
import { requireTenant } from '../middleware/tenant';
import type { Registro } from '../database/db';

const router = Router();

// ── Require an active tenant for every ponto route ────────────────────────────
router.use(requireTenant);

type TipoRegistro = 'hora_inicial' | 'inicio_intervalo' | 'fim_intervalo' | 'hora_final';

const STEP_ORDER: TipoRegistro[] = [
  'hora_inicial',
  'inicio_intervalo',
  'fim_intervalo',
  'hora_final',
];

const STEP_LABELS: Record<TipoRegistro, string> = {
  hora_inicial: 'Entrada',
  inicio_intervalo: 'Início do Intervalo',
  fim_intervalo: 'Fim do Intervalo',
  hora_final: 'Saída',
};

// Returns "YYYY-MM-DD HH:MM:SS" in local time
function getLocalDateTime(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return `${date} ${time}`;
}

function getNextStep(registro: Registro | undefined): TipoRegistro | null {
  for (const step of STEP_ORDER) {
    if (!registro || !registro[step]) return step;
  }
  return null;
}

function isComplete(registro: Registro): boolean {
  return STEP_ORDER.every((s) => registro[s] !== null);
}

function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4,6}$/.test(pin);
}

// POST /api/ponto/registrar
router.post('/registrar', async (req: Request, res: Response) => {
  const { pin } = req.body as { pin: unknown };
  const clientId = req.client!.id;

  if (!isValidPin(pin)) {
    return res.status(400).json({ error: 'PIN inválido. Use apenas números (4-6 dígitos).' });
  }

  try {
    const usuario = await db.findUsuario(clientId, pin);
    if (!usuario) {
      return res.status(404).json({ error: 'PIN não cadastrado. Solicite o cadastro ao administrador.' });
    }
    if (!usuario.ativo) {
      return res.status(403).json({ error: 'Acesso inativo. Entre em contato com o administrador.' });
    }

    const agora = getLocalDateTime();               // "YYYY-MM-DD HH:MM:SS"
    const dataHoje = agora.split(' ')[0];           // "YYYY-MM-DD"
    const horaDisplay = agora.split(' ')[1];        // "HH:MM:SS"

    // Find ongoing (incomplete) session linked to this user's UUID
    let registro = await db.findLatestIncomplete(clientId, usuario.id);
    const nextStep = getNextStep(registro);

    let updated: Registro;

    if (!registro) {
      // No ongoing session — start a new one with hora_inicial; snapshot current daily hours
      updated = await db.insertRecord(clientId, usuario.id, pin, dataHoje, {
        hora_inicial: agora,
        horas_diarias: usuario.horas_diarias ?? null,
        intervalo: usuario.intervalo ?? null,
      });
    } else {
      // Continue existing session — nextStep is always non-null here
      updated = await db.updateById(clientId, registro.id, { [nextStep!]: agora });
    }

    const tipo = nextStep ?? 'hora_inicial';
    const nextAfter = getNextStep(updated);

    return res.json({
      success: true,
      tipo,
      label: STEP_LABELS[tipo],
      horario: horaDisplay,
      data: dataHoje,
      proximaEtapa: nextAfter,
      proximaEtapaLabel: nextAfter ? STEP_LABELS[nextAfter] : null,
      cicloCompleto: nextAfter === null,
    });
  } catch (err) {
    console.error('[POST /registrar]', err);
    return res.status(500).json({ error: 'Erro interno ao registrar ponto.' });
  }
});

// GET /api/ponto/hoje/:pin — returns the current ongoing session (if any)
router.get('/hoje/:pin', async (req: Request, res: Response) => {
  const { pin } = req.params;
  const clientId = req.client!.id;

  if (!isValidPin(pin)) {
    return res.status(400).json({ error: 'PIN inválido.' });
  }

  try {
    const usuario = await db.findUsuario(clientId, pin);
    if (!usuario) return res.json({ registro: null, proximaEtapa: 'hora_inicial', proximaEtapaLabel: 'Entrada', cicloCompleto: false });

    const registro = await db.findLatestIncomplete(clientId, usuario.id);
    const nextStep = getNextStep(registro);

    return res.json({
      registro: registro ?? null,
      proximaEtapa: nextStep,
      proximaEtapaLabel: nextStep ? STEP_LABELS[nextStep] : null,
      cicloCompleto: false,
    });
  } catch (err) {
    console.error('[GET /hoje]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/ponto/historico/:pin
router.get('/historico/:pin', async (req: Request, res: Response) => {
  const { pin } = req.params;
  const clientId = req.client!.id;

  if (!isValidPin(pin)) {
    return res.status(400).json({ error: 'PIN inválido.' });
  }

  try {
    const u = await db.findUsuario(clientId, pin);
    if (!u) return res.json({ registros: [] });
    const registros = (await db.findByUsuarioId(clientId, u.id)).map((r) => ({
      ...r,
      completo: isComplete(r),
    }));

    return res.json({ registros });
  } catch (err) {
    console.error('[GET /historico]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/ponto/status
router.get('/status', (_req: Request, res: Response) => {
  return res.json({ ok: true, timestamp: new Date().toISOString() });
});

export default router;
