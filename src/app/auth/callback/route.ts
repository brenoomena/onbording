import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";

/** Retorno do login com Google. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/painel";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/painel";

  if (!code) return NextResponse.redirect(`${origin}/auth/erro?motivo=google`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${origin}/auth/erro?motivo=google`);

  const domain = publicEnv.googleDomain;
  if (domain && !(data.user.email ?? "").toLowerCase().endsWith(`@${domain}`)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/auth/erro?motivo=dominio`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
