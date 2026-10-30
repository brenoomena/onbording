import { createClient } from "@supabase/supabase-js";
import { publicEnv, serviceRoleKey } from "@/lib/env";

/**
 * Cliente com a chave service_role: ignora RLS.
 * Use apenas no servidor e apenas para operações do módulo de login
 * (convidar, reenviar convite), sempre depois de conferir a permissão
 * do usuário com o cliente normal.
 */
export function createAdminClient() {
  return createClient(publicEnv.supabaseUrl, serviceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
