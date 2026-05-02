import crypto from 'crypto';
import { supabase } from './supabaseClient';

export interface Registro {
  id: number;
  usuario_id: string;
  pin: string; // PIN usado no momento do registro (histórico)
  data: string;
  hora_inicial: string | null;
  inicio_intervalo: string | null;
  fim_intervalo: string | null;
  hora_final: string | null;
  horas_diarias: number | null;
  oculto: boolean;
  created_at: string;
}

export interface Usuario {
  id: string; // UUID — chave estável, não muda ao trocar PIN
  pin: string;
  nome: string;
  ativo: boolean;
  horas_diarias: number;
  intervalo: number;
  created_at: string;
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function raise(error: { message: string } | null, context: string): never {
  throw new Error(`[${context}] ${error?.message ?? 'Erro desconhecido'}`);
}

export const db = {
  // ── Registros ──────────────────────────────────────────────────────────────

  async findLatestIncomplete(usuarioId: string): Promise<Registro | undefined> {
    const { data: row, error } = await supabase
      .from('registros')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('oculto', false)
      .is('hora_final', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) raise(error, 'findLatestIncomplete');
    return row ?? undefined;
  },

  async hideRecord(id: number): Promise<boolean> {
    const { error, data } = await supabase
      .from('registros')
      .update({ oculto: true })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) raise(error, 'hideRecord');
    return data !== null;
  },

  async insertRecord(
    usuarioId: string,
    pin: string,
    data: string,
    fields: Partial<Omit<Registro, 'id' | 'usuario_id' | 'pin' | 'data' | 'created_at'>>
  ): Promise<Registro> {
    const { data: created, error } = await supabase
      .from('registros')
      .insert({ usuario_id: usuarioId, pin, data, ...fields })
      .select()
      .single();
    if (error) raise(error, 'insertRecord');
    return created as Registro;
  },

  async updateById(
    id: number,
    fields: Partial<Omit<Registro, 'id' | 'usuario_id' | 'pin' | 'data' | 'created_at'>>
  ): Promise<Registro> {
    const { data: updated, error } = await supabase
      .from('registros')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    if (error) raise(error, 'updateById');
    return updated as Registro;
  },

  async findByUsuarioId(usuarioId: string, limit = 30): Promise<Registro[]> {
    const { data, error } = await supabase
      .from('registros')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('oculto', false)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) raise(error, 'findByUsuarioId');
    return (data ?? []) as Registro[];
  },

  async findByDate(data: string): Promise<Registro[]> {
    const { data: rows, error } = await supabase
      .from('registros')
      .select('*')
      .eq('data', data)
      .eq('oculto', false)
      .order('created_at', { ascending: true });
    if (error) raise(error, 'findByDate');
    return (rows ?? []) as Registro[];
  },

  async findAll(limit = 200): Promise<Registro[]> {
    const { data, error } = await supabase
      .from('registros')
      .select('*')
      .eq('oculto', false)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) raise(error, 'findAll');
    return (data ?? []) as Registro[];
  },

  async findAllHidden(limit = 200): Promise<Registro[]> {
    const { data, error } = await supabase
      .from('registros')
      .select('*')
      .eq('oculto', true)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) raise(error, 'findAllHidden');
    return (data ?? []) as Registro[];
  },

  // ── Usuários ───────────────────────────────────────────────────────────────

  async listUsuarios(): Promise<Usuario[]> {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('nome', { ascending: true });
    if (error) raise(error, 'listUsuarios');
    return (data ?? []) as Usuario[];
  },

  async findUsuario(pin: string): Promise<Usuario | undefined> {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('pin', pin)
      .maybeSingle();
    if (error) raise(error, 'findUsuario');
    return data ?? undefined;
  },

  async createUsuario(pin: string, nome: string, horasDiarias = 440, intervalo = 60): Promise<Usuario> {
    const { data, error } = await supabase
      .from('usuarios')
      .insert({ pin, nome, ativo: true, horas_diarias: horasDiarias, intervalo })
      .select()
      .single();
    if (error) raise(error, 'createUsuario');
    return data as Usuario;
  },

  async bulkUpdateHorasDiarias(pins: string[], horasDiarias: number): Promise<void> {
    const { error } = await supabase
      .from('usuarios')
      .update({ horas_diarias: horasDiarias })
      .in('pin', pins);
    if (error) raise(error, 'bulkUpdateHorasDiarias');
  },

  async bulkUpdateIntervalo(pins: string[], intervalo: number): Promise<void> {
    const { error } = await supabase
      .from('usuarios')
      .update({ intervalo })
      .in('pin', pins);
    if (error) raise(error, 'bulkUpdateIntervalo');
  },

  async updateUsuario(
    id: string,
    fields: Partial<Pick<Usuario, 'pin' | 'nome' | 'ativo' | 'horas_diarias' | 'intervalo'>>
  ): Promise<Usuario> {
    const { data, error } = await supabase
      .from('usuarios')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    if (error) raise(error, 'updateUsuario');
    return data as Usuario;
  },

  async deleteUsuario(pin: string): Promise<boolean> {
    const { error, count } = await supabase
      .from('usuarios')
      .delete({ count: 'exact' })
      .eq('pin', pin);
    if (error) raise(error, 'deleteUsuario');
    return (count ?? 0) > 0;
  },

  // Troca PIN: só atualiza usuarios.pin — registros permanecem ligados pelo UUID
  async changeUserPin(
    oldPin: string,
    newPin: string,
    newNome?: string,
    newAtivo?: boolean
  ): Promise<Usuario> {
    const existing = await this.findUsuario(oldPin);
    if (!existing) throw new Error('Usuário não encontrado.');

    const fields: Partial<Pick<Usuario, 'pin' | 'nome' | 'ativo'>> = { pin: newPin };
    if (newNome !== undefined) fields.nome = newNome.trim();
    if (newAtivo !== undefined) fields.ativo = newAtivo;

    return this.updateUsuario(existing.id, fields);
  },

  // ── Admin auth ─────────────────────────────────────────────────────────────

  async checkPassword(password: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('admin_config')
      .select('password_hash')
      .eq('id', 1)
      .single();
    if (error) return false;
    return (data as { password_hash: string }).password_hash === hashPassword(password);
  },

  async changePassword(newPassword: string): Promise<void> {
    const { error } = await supabase
      .from('admin_config')
      .update({ password_hash: hashPassword(newPassword) })
      .eq('id', 1);
    if (error) raise(error, 'changePassword');
  },

  async getEscalaConfig(): Promise<{ escala_padrao: number; intervalo_padrao: number }> {
    const { data, error } = await supabase
      .from('admin_config')
      .select('escala_padrao, intervalo_padrao')
      .eq('id', 1)
      .single();
    if (error) return { escala_padrao: 440, intervalo_padrao: 60 };
    const row = data as { escala_padrao: number; intervalo_padrao: number };
    return { escala_padrao: row.escala_padrao ?? 440, intervalo_padrao: row.intervalo_padrao ?? 60 };
  },

  async setEscalaConfig(escala_padrao: number, intervalo_padrao: number): Promise<void> {
    const { error } = await supabase
      .from('admin_config')
      .update({ escala_padrao, intervalo_padrao })
      .eq('id', 1);
    if (error) raise(error, 'setEscalaConfig');
  },
};
