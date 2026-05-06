import { createBrowserClient } from "@supabase/ssr";
import type { Lead, MessageTemplate, Interaction } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Cria cliente Supabase para usar no navegador
 */
export function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Queries para tabela de leads
 */
export const leadsQueries = {
  /**
   * Busca todos os leads do usuário
   */
  async getAll(supabase: ReturnType<typeof createSupabaseClient>) {
    if (!supabase) return [];
    const { data } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    return (data as Lead[] | null) ?? [];
  },

  /**
   * Busca um lead específico
   */
  async getById(supabase: ReturnType<typeof createSupabaseClient>, id: string) {
    if (!supabase) return null;
    const { data } = await supabase.from("leads").select("*").eq("id", id).single();
    return (data as Lead | null) ?? null;
  },

  /**
   * Cria um novo lead
   */
  async create(
    supabase: ReturnType<typeof createSupabaseClient>,
    lead: Omit<Lead, "id" | "created_at" | "updated_at">,
  ) {
    if (!supabase) return null;
    const { data } = await supabase
      .from("leads")
      .insert(lead)
      .select()
      .single();
    return (data as Lead | null) ?? null;
  },

  /**
   * Atualiza um lead
   */
  async update(
    supabase: ReturnType<typeof createSupabaseClient>,
    id: string,
    updates: Partial<Lead>,
  ) {
    if (!supabase) return null;
    const { data } = await supabase
      .from("leads")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    return (data as Lead | null) ?? null;
  },

  /**
   * Deleta um lead
   */
  async delete(supabase: ReturnType<typeof createSupabaseClient>, id: string) {
    if (!supabase) return false;
    const { error } = await supabase.from("leads").delete().eq("id", id);
    return !error;
  },
};

/**
 * Queries para tabela de templates de mensagem
 */
export const templateQueries = {
  /**
   * Busca todos os templates do usuário
   */
  async getAll(supabase: ReturnType<typeof createSupabaseClient>) {
    if (!supabase) return [];
    const { data } = await supabase
      .from("message_templates")
      .select("*")
      .order("created_at", { ascending: true });
    return (data as MessageTemplate[] | null) ?? [];
  },

  /**
   * Cria um novo template
   */
  async create(
    supabase: ReturnType<typeof createSupabaseClient>,
    template: Omit<MessageTemplate, "id" | "created_at">,
  ) {
    if (!supabase) return null;
    const { data } = await supabase
      .from("message_templates")
      .insert(template)
      .select()
      .single();
    return (data as MessageTemplate | null) ?? null;
  },

  /**
   * Deleta um template
   */
  async delete(supabase: ReturnType<typeof createSupabaseClient>, id: string) {
    if (!supabase) return false;
    const { error } = await supabase.from("message_templates").delete().eq("id", id);
    return !error;
  },
};

/**
 * Queries para tabela de interações
 */
export const interactionQueries = {
  /**
   * Busca todas as interações de um lead
   */
  async getByLeadId(supabase: ReturnType<typeof createSupabaseClient>, leadId: string) {
    if (!supabase) return [];
    const { data } = await supabase
      .from("interactions")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    return (data as Interaction[] | null) ?? [];
  },

  /**
   * Busca todas as interações do usuário
   */
  async getAll(supabase: ReturnType<typeof createSupabaseClient>) {
    if (!supabase) return [];
    const { data } = await supabase
      .from("interactions")
      .select("*")
      .order("created_at", { ascending: false });
    return (data as Interaction[] | null) ?? [];
  },

  /**
   * Cria uma nova interação
   */
  async create(
    supabase: ReturnType<typeof createSupabaseClient>,
    interaction: Omit<Interaction, "id" | "created_at">,
  ) {
    if (!supabase) return null;
    const { data } = await supabase
      .from("interactions")
      .insert(interaction)
      .select()
      .single();
    return (data as Interaction | null) ?? null;
  },

  /**
   * Deleta uma interação
   */
  async delete(supabase: ReturnType<typeof createSupabaseClient>, id: string) {
    if (!supabase) return false;
    const { error } = await supabase.from("interactions").delete().eq("id", id);
    return !error;
  },
};
