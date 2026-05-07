import crypto from 'crypto';
import { supabase } from './supabaseClient';

export interface Registro {
  id: number;
  usuario_id: string;
  client_id: string;
  pin: string;
  data: string;
  hora_inicial: string | null;
  inicio_intervalo: string | null;
  fim_intervalo: string | null;
  hora_final: string | null;
  horas_diarias: number | null;
  intervalo: number | null;
  oculto: boolean;
  extra: boolean | null;
  created_at: string;
}

export interface Usuario {
  id: string;
  client_id: string;
  pin: string;
  nome: string;
  ativo: boolean;
  horas_diarias: number;
  intervalo: number;
  role: 'usuario' | 'membro' | 'administrador';
  cargo: string | null;
  created_at: string;
}

export interface RegistroLog {
  id: number;
  registro_id: number;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  alterado_em: string;
  alterado_por: string;
  tipo: 'default' | 'custom';
  field_id: number | null;
}

export interface CustomField {
  id: number;
  client_id: string;
  nome: string;
  tipo: string;
  input_type: string;
  options: { label: string; value: string }[] | null;
  required: boolean;
  ordem: number;
  ativo: boolean;
  valor_padrao: string | null;
  created_at: string;
}

export interface CustomFieldValue {
  id: number;
  registro_id: number;
  field_id: number;
  value: string | null;
  updated_at: string;
}

export interface Contador {
  id: number;
  email: string;
  nome: string;
  password_hash: string;
  ativo: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface ContadorCliente {
  id: number;
  contador_id: number;
  nome_conexao: string;
  connection_type: 'uuid' | 'api_key';
  client_uuid: string;
  api_key_id: number | null;
  created_at: string;
  last_accessed_at: string | null;
}

export interface ApiKey {
  id: number;
  client_id: string;
  nome: string;
  key_prefix: string;
  key_hash: string;
  ativo: boolean;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function raise(error: { message: string } | null, context: string): never {
  throw new Error(`[${context}] ${error?.message ?? 'Erro desconhecido'}`);
}

export const db = {
  // ── Registros ──────────────────────────────────────────────────────────────

  async findLatestIncomplete(clientId: string, usuarioId: string): Promise<Registro | undefined> {
    const { data, error } = await supabase
      .from('registros')
      .select('*')
      .eq('client_id', clientId)
      .eq('usuario_id', usuarioId)
      .eq('oculto', false)
      .is('hora_final', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) raise(error, 'findLatestIncomplete');
    return data ?? undefined;
  },

  async hideRecord(clientId: string, id: number): Promise<boolean> {
    const { error, data } = await supabase
      .from('registros')
      .update({ oculto: true })
      .eq('id', id)
      .eq('client_id', clientId)
      .select('id')
      .maybeSingle();
    if (error) raise(error, 'hideRecord');
    return data !== null;
  },

  async insertRecord(
    clientId: string,
    usuarioId: string,
    pin: string,
    data: string,
    fields: Partial<Omit<Registro, 'id' | 'client_id' | 'usuario_id' | 'pin' | 'data' | 'created_at'>>
  ): Promise<Registro> {
    const { data: created, error } = await supabase
      .from('registros')
      .insert({ client_id: clientId, usuario_id: usuarioId, pin, data, ...fields })
      .select()
      .single();
    if (error) raise(error, 'insertRecord');
    return created as Registro;
  },

  async updateById(
    clientId: string,
    id: number,
    fields: Partial<Omit<Registro, 'id' | 'client_id' | 'usuario_id' | 'pin' | 'data' | 'created_at'>>
  ): Promise<Registro> {
    const { data: updated, error } = await supabase
      .from('registros')
      .update(fields)
      .eq('id', id)
      .eq('client_id', clientId)
      .select()
      .single();
    if (error) raise(error, 'updateById');
    return updated as Registro;
  },

  async findByUsuarioId(clientId: string, usuarioId: string, limit = 30): Promise<Registro[]> {
    const { data, error } = await supabase
      .from('registros')
      .select('*')
      .eq('client_id', clientId)
      .eq('usuario_id', usuarioId)
      .eq('oculto', false)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) raise(error, 'findByUsuarioId');
    return (data ?? []) as Registro[];
  },

  async findByDate(clientId: string, data: string): Promise<Registro[]> {
    const { data: rows, error } = await supabase
      .from('registros')
      .select('*')
      .eq('client_id', clientId)
      .eq('data', data)
      .eq('oculto', false)
      .order('created_at', { ascending: true });
    if (error) raise(error, 'findByDate');
    return (rows ?? []) as Registro[];
  },

  async findAll(clientId: string, limit = 200): Promise<Registro[]> {
    const { data, error } = await supabase
      .from('registros')
      .select('*')
      .eq('client_id', clientId)
      .eq('oculto', false)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) raise(error, 'findAll');
    return (data ?? []) as Registro[];
  },

  async findAllHidden(clientId: string, limit = 200): Promise<Registro[]> {
    const { data, error } = await supabase
      .from('registros')
      .select('*')
      .eq('client_id', clientId)
      .eq('oculto', true)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) raise(error, 'findAllHidden');
    return (data ?? []) as Registro[];
  },

  async findById(clientId: string, id: number): Promise<Registro | undefined> {
    const { data, error } = await supabase
      .from('registros')
      .select('*')
      .eq('id', id)
      .eq('client_id', clientId)
      .maybeSingle();
    if (error) raise(error, 'findById');
    return data ?? undefined;
  },

  async insertLog(
    registroId: number,
    campo: string,
    valorAnterior: string | null,
    valorNovo: string | null,
    alteradoPor = 'admin',
    tipo: 'default' | 'custom' = 'default',
    fieldId?: number
  ): Promise<void> {
    const { error } = await supabase.from('registro_logs').insert({
      registro_id: registroId,
      campo,
      valor_anterior: valorAnterior,
      valor_novo: valorNovo,
      alterado_por: alteradoPor,
      tipo,
      field_id: fieldId ?? null,
    });
    if (error) raise(error, 'insertLog');
  },

  async getLogsByRegistroId(registroId: number): Promise<RegistroLog[]> {
    const { data, error } = await supabase
      .from('registro_logs')
      .select('*')
      .eq('registro_id', registroId)
      .order('alterado_em', { ascending: false });
    if (error) raise(error, 'getLogsByRegistroId');
    return (data ?? []) as RegistroLog[];
  },

  // ── Usuários ───────────────────────────────────────────────────────────────

  async listUsuarios(clientId: string): Promise<Usuario[]> {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('client_id', clientId)
      .eq('role', 'usuario')
      .order('nome', { ascending: true });
    if (error) raise(error, 'listUsuarios');
    return (data ?? []) as Usuario[];
  },

  async findUsuario(clientId: string, pin: string): Promise<Usuario | undefined> {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('client_id', clientId)
      .eq('pin', pin)
      .maybeSingle();
    if (error) raise(error, 'findUsuario');
    return data ?? undefined;
  },

  async createUsuario(
    clientId: string, pin: string, nome: string,
    horasDiarias = 440, intervalo = 60,
    role: 'usuario' | 'membro' | 'administrador' = 'usuario',
    cargo: string | null = null
  ): Promise<Usuario> {
    const { data, error } = await supabase
      .from('usuarios')
      .insert({ client_id: clientId, pin, nome, ativo: true, horas_diarias: horasDiarias, intervalo, role, cargo })
      .select()
      .single();
    if (error) raise(error, 'createUsuario');
    return data as Usuario;
  },

  async findUsuariosByRoles(clientId: string, roles: string[]): Promise<Usuario[]> {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('client_id', clientId)
      .in('role', roles)
      .order('nome', { ascending: true });
    if (error) raise(error, 'findUsuariosByRoles');
    return (data ?? []) as Usuario[];
  },

  async bulkUpdateHorasDiarias(clientId: string, pins: string[], horasDiarias: number): Promise<void> {
    const { error } = await supabase
      .from('usuarios')
      .update({ horas_diarias: horasDiarias })
      .eq('client_id', clientId)
      .in('pin', pins);
    if (error) raise(error, 'bulkUpdateHorasDiarias');
  },

  async bulkUpdateIntervalo(clientId: string, pins: string[], intervalo: number): Promise<void> {
    const { error } = await supabase
      .from('usuarios')
      .update({ intervalo })
      .eq('client_id', clientId)
      .in('pin', pins);
    if (error) raise(error, 'bulkUpdateIntervalo');
  },

  async updateUsuario(
    clientId: string,
    id: string,
    fields: Partial<Pick<Usuario, 'pin' | 'nome' | 'ativo' | 'horas_diarias' | 'intervalo'>>
  ): Promise<Usuario> {
    const { data, error } = await supabase
      .from('usuarios')
      .update(fields)
      .eq('id', id)
      .eq('client_id', clientId)
      .select()
      .single();
    if (error) raise(error, 'updateUsuario');
    return data as Usuario;
  },

  async deleteUsuario(clientId: string, pin: string): Promise<boolean> {
    const { error, count } = await supabase
      .from('usuarios')
      .delete({ count: 'exact' })
      .eq('client_id', clientId)
      .eq('pin', pin);
    if (error) raise(error, 'deleteUsuario');
    return (count ?? 0) > 0;
  },

  async changeUserPin(
    clientId: string,
    oldPin: string,
    newPin: string,
    newNome?: string,
    newAtivo?: boolean
  ): Promise<Usuario> {
    const existing = await this.findUsuario(clientId, oldPin);
    if (!existing) throw new Error('Usuário não encontrado.');
    const fields: Partial<Pick<Usuario, 'pin' | 'nome' | 'ativo'>> = { pin: newPin };
    if (newNome !== undefined) fields.nome = newNome.trim();
    if (newAtivo !== undefined) fields.ativo = newAtivo;
    return this.updateUsuario(clientId, existing.id, fields);
  },

  // ── Admin auth + config ────────────────────────────────────────────────────

  async checkPassword(clientId: string, password: string): Promise<boolean> {
    const hash = hashPassword(password);

    // Verifica senha específica do tenant
    const { data: tenantData } = await supabase
      .from('admin_config')
      .select('password_hash')
      .eq('client_id', clientId)
      .maybeSingle();
    if (tenantData && (tenantData as { password_hash: string }).password_hash === hash) {
      return true;
    }

    // Fallback: senha global configurada no GOD cockpit
    const { data: godData } = await supabase
      .from('god_settings')
      .select('global_admin_password_hash')
      .eq('id', 1)
      .maybeSingle();
    const globalHash = (godData as { global_admin_password_hash: string } | null)
      ?.global_admin_password_hash ?? '';
    return globalHash.length > 0 && globalHash === hash;
  },

  async changePassword(clientId: string, newPassword: string): Promise<void> {
    const { error } = await supabase
      .from('admin_config')
      .update({ password_hash: hashPassword(newPassword) })
      .eq('client_id', clientId);
    if (error) raise(error, 'changePassword');
  },

  async getEscalaConfig(clientId: string): Promise<{ escala_padrao: number; intervalo_padrao: number }> {
    const { data, error } = await supabase
      .from('admin_config')
      .select('escala_padrao, intervalo_padrao')
      .eq('client_id', clientId)
      .maybeSingle();
    if (error || !data) return { escala_padrao: 440, intervalo_padrao: 60 };
    const row = data as { escala_padrao: number; intervalo_padrao: number };
    return { escala_padrao: row.escala_padrao ?? 440, intervalo_padrao: row.intervalo_padrao ?? 60 };
  },

  async setEscalaConfig(clientId: string, escala_padrao: number, intervalo_padrao: number): Promise<void> {
    const { error } = await supabase
      .from('admin_config')
      .update({ escala_padrao, intervalo_padrao })
      .eq('client_id', clientId);
    if (error) raise(error, 'setEscalaConfig');
  },

  async getClientUuid(clientId: string): Promise<string> {
    const { data, error } = await supabase
      .from('admin_config')
      .select('client_uuid')
      .eq('client_id', clientId)
      .single();
    if (error) raise(error, 'getClientUuid');
    return (data as { client_uuid: string }).client_uuid;
  },

  // ── Custom Fields ──────────────────────────────────────────────────────────

  async getCustomFieldById(clientId: string, id: number): Promise<CustomField | undefined> {
    const { data } = await supabase
      .from('custom_fields')
      .select('*')
      .eq('id', id)
      .eq('client_id', clientId)
      .maybeSingle();
    return (data as CustomField | null) ?? undefined;
  },

  async findCustomFieldValue(registroId: number, fieldId: number): Promise<string | null> {
    const { data } = await supabase
      .from('custom_field_values')
      .select('value')
      .eq('registro_id', registroId)
      .eq('field_id', fieldId)
      .maybeSingle();
    return (data as { value: string | null } | null)?.value ?? null;
  },

  async listCustomFields(clientId: string, includeInactive = false): Promise<CustomField[]> {
    let query = supabase
      .from('custom_fields')
      .select('*')
      .eq('client_id', clientId)
      .order('ordem', { ascending: true });
    if (!includeInactive) query = query.eq('ativo', true);
    const { data, error } = await query;
    if (error) raise(error, 'listCustomFields');
    return (data ?? []) as CustomField[];
  },

  async createCustomField(clientId: string, fields: Omit<CustomField, 'id' | 'client_id' | 'created_at'>): Promise<CustomField> {
    const { data, error } = await supabase
      .from('custom_fields')
      .insert({ ...fields, client_id: clientId })
      .select()
      .single();
    if (error) raise(error, 'createCustomField');
    return data as CustomField;
  },

  async updateCustomField(
    clientId: string,
    id: number,
    fields: Partial<Omit<CustomField, 'id' | 'client_id' | 'created_at'>>
  ): Promise<CustomField> {
    const { data, error } = await supabase
      .from('custom_fields')
      .update(fields)
      .eq('id', id)
      .eq('client_id', clientId)
      .select()
      .single();
    if (error) raise(error, 'updateCustomField');
    return data as CustomField;
  },

  async deleteCustomField(clientId: string, id: number): Promise<void> {
    await supabase.from('custom_field_values').delete().eq('field_id', id);
    const { error } = await supabase
      .from('custom_fields')
      .delete()
      .eq('id', id)
      .eq('client_id', clientId);
    if (error) raise(error, 'deleteCustomField');
  },

  // ── Custom Field Values ────────────────────────────────────────────────────

  async getCustomValues(registroIds: number[]): Promise<CustomFieldValue[]> {
    if (registroIds.length === 0) return [];
    const { data, error } = await supabase
      .from('custom_field_values')
      .select('*')
      .in('registro_id', registroIds);
    if (error) raise(error, 'getCustomValues');
    return (data ?? []) as CustomFieldValue[];
  },

  async upsertCustomValue(registroId: number, fieldId: number, value: string | null): Promise<void> {
    const { error } = await supabase
      .from('custom_field_values')
      .upsert(
        { registro_id: registroId, field_id: fieldId, value, updated_at: new Date().toISOString() },
        { onConflict: 'registro_id,field_id' }
      );
    if (error) raise(error, 'upsertCustomValue');
  },

  // ── API Keys ───────────────────────────────────────────────────────────────

  async listApiKeys(clientId: string): Promise<ApiKey[]> {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, client_id, nome, key_prefix, ativo, created_at, last_used_at, revoked_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) raise(error, 'listApiKeys');
    return (data ?? []) as ApiKey[];
  },

  async createApiKey(clientId: string, nome: string, keyPrefix: string, keyHash: string): Promise<ApiKey> {
    const { data, error } = await supabase
      .from('api_keys')
      .insert({ client_id: clientId, nome, key_prefix: keyPrefix, key_hash: keyHash })
      .select('id, client_id, nome, key_prefix, ativo, created_at, last_used_at, revoked_at')
      .single();
    if (error) raise(error, 'createApiKey');
    return data as ApiKey;
  },

  async revokeApiKey(clientId: string, id: number): Promise<void> {
    const { error } = await supabase
      .from('api_keys')
      .update({ ativo: false, revoked_at: new Date().toISOString() })
      .eq('id', id)
      .eq('client_id', clientId);
    if (error) raise(error, 'revokeApiKey');
  },

  async validateApiKey(clientId: string, key: string): Promise<ApiKey | null> {
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const { data } = await supabase
      .from('api_keys')
      .select('*')
      .eq('client_id', clientId)
      .eq('key_hash', hash)
      .eq('ativo', true)
      .is('revoked_at', null)
      .maybeSingle();
    if (data) {
      supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', (data as ApiKey).id).then(() => {});
    }
    return (data as ApiKey | null);
  },

  // ── Global helpers (sem filtro de client_id) ──────────────────────────────

  /** Valida uma API key sem saber o client_id previamente (uso pelo contador). */
  async validateApiKeyGlobal(key: string): Promise<ApiKey | null> {
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const { data } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', hash)
      .eq('ativo', true)
      .is('revoked_at', null)
      .maybeSingle();
    if (data) {
      supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', (data as ApiKey).id).then(() => {});
    }
    return (data as ApiKey | null);
  },

  /**
   * Recebe o client_uuid que o admin compartilha (admin_config.client_uuid)
   * e retorna o client_id (clients.id) correspondente, ou null se não encontrado.
   * Usado pelo contador para conectar via UUID.
   */
  async findClientByAdminUuid(adminUuid: string): Promise<string | null> {
    const { data } = await supabase
      .from('admin_config')
      .select('client_id')
      .eq('client_uuid', adminUuid)
      .maybeSingle();
    return (data as { client_id: string } | null)?.client_id ?? null;
  },

  // ── Contador (global — não filtra por client_id) ───────────────────────────

  async findContador(email: string): Promise<Contador | undefined> {
    const { data, error } = await supabase.from('contadores').select('*').eq('email', email).maybeSingle();
    if (error) raise(error, 'findContador');
    return data ?? undefined;
  },

  async findContadorById(id: number): Promise<Contador | undefined> {
    const { data, error } = await supabase.from('contadores').select('*').eq('id', id).maybeSingle();
    if (error) raise(error, 'findContadorById');
    return data ?? undefined;
  },

  async updateContadorLogin(id: number): Promise<void> {
    await supabase.from('contadores').update({ last_login_at: new Date().toISOString() }).eq('id', id);
  },

  async logContadorAccess(contadorId: number, email: string, clientUuid: string | null, action: string): Promise<void> {
    await supabase.from('contador_access_logs').insert({ contador_id: contadorId, contador_email: email, client_uuid: clientUuid, action });
  },

  async upsertContadorCliente(
    contadorId: number, clientUuid: string, connectionType: 'uuid' | 'api_key',
    apiKeyId: number | null, nomeConexao: string
  ): Promise<ContadorCliente> {
    const { data, error } = await supabase
      .from('contador_clientes')
      .upsert(
        { contador_id: contadorId, client_uuid: clientUuid, connection_type: connectionType, api_key_id: apiKeyId, nome_conexao: nomeConexao, last_accessed_at: new Date().toISOString() },
        { onConflict: 'contador_id,client_uuid' }
      )
      .select().single();
    if (error) raise(error, 'upsertContadorCliente');
    return data as ContadorCliente;
  },

  async listContadorClientes(contadorId: number): Promise<ContadorCliente[]> {
    const { data, error } = await supabase
      .from('contador_clientes').select('*').eq('contador_id', contadorId)
      .order('last_accessed_at', { ascending: false, nullsFirst: false });
    if (error) raise(error, 'listContadorClientes');
    return (data ?? []) as ContadorCliente[];
  },

  async getContadorCliente(contadorId: number, id: number): Promise<ContadorCliente | undefined> {
    const { data, error } = await supabase
      .from('contador_clientes').select('*').eq('id', id).eq('contador_id', contadorId).maybeSingle();
    if (error) raise(error, 'getContadorCliente');
    return data ?? undefined;
  },

  async deleteContadorCliente(contadorId: number, id: number): Promise<void> {
    const { error } = await supabase.from('contador_clientes').delete().eq('id', id).eq('contador_id', contadorId);
    if (error) raise(error, 'deleteContadorCliente');
  },

  async updateContadorClienteAccess(id: number): Promise<void> {
    await supabase.from('contador_clientes').update({ last_accessed_at: new Date().toISOString() }).eq('id', id);
  },

  async renameContadorCliente(contadorId: number, id: number, nome: string): Promise<ContadorCliente | undefined> {
    const { data, error } = await supabase
      .from('contador_clientes')
      .update({ nome_conexao: nome })
      .eq('id', id)
      .eq('contador_id', contadorId)
      .select().maybeSingle();
    if (error) raise(error, 'renameContadorCliente');
    return data ?? undefined;
  },
};
