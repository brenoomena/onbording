import { NextResponse, type NextRequest } from "next/server";
import { decideAccess, deniedFromProviderError, safeNext } from "@/lib/access";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { GROUPS_COOKIE } from "@/lib/theme";

/**
 * Volta do login com Google. Só libera quem tem cadastro de colaborador
 * ativo com o mesmo e-mail; qualquer outra conta é desconectada e, se foi
 * criada agora sem cadastro, removida do login.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const deny = (reason: string) => NextResponse.redirect(`${origin}/login?erro=${reason}`);

  const providerError = searchParams.get("error") ?? searchParams.get("error_code");
  if (providerError) return deny(deniedFromProviderError(providerError, searchParams.get("error_description")));

  const code = searchParams.get("code");
  if (!code) return deny("google");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return deny(error ? deniedFromProviderError(error.code ?? null, error.message) : "google");

  // Cadastro lido pela própria sessão (RLS: cada um lê o próprio cadastro).
  const { data: profile } = await supabase.from("profiles").select("status").eq("id", data.user.id).maybeSingle();
  const access = decideAccess(data.user.email, profile, publicEnv.googleDomain);
  if (!access.ok) {
    await supabase.auth.signOut();
    // Conta criada pelo Google sem cadastro na plataforma: não fica guardada.
    if (!profile) {
      try {
        await createAdminClient().auth.admin.deleteUser(data.user.id);
      } catch {
        // Sem a chave de serviço, a conta fica sem acesso de qualquer forma.
      }
    }
    return deny(access.reason);
  }

  const res = NextResponse.redirect(`${origin}${safeNext(searchParams.get("next"))}`);
  // Cada novo acesso começa com o menu no padrão (Estrutura e Administração recolhidos).
  res.cookies.delete(GROUPS_COOKIE);
  return res;
}
