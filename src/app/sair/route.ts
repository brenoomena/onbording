import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GROUPS_COOKIE } from "@/lib/theme";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const res = NextResponse.redirect(new URL("/login?aviso=saiu", request.url), { status: 303 });
  // Grupos do menu abertos/recolhidos valem só durante o acesso: ao sair, voltam ao padrão.
  res.cookies.delete(GROUPS_COOKIE);
  return res;
}
