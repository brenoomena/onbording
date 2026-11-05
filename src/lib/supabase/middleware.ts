import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/certificado", "/recuperar-senha", "/definir-senha", "/auth/confirm", "/auth/callback", "/auth/erro"];

/**
 * Marca as Server Actions disparadas de dentro de uma janela de rota
 * interceptada (ver/editar sobre a lista): só nesse caso o navegador manda o
 * cabeçalho Next-Url junto com a ação. Usado por lib/revalidate.ts.
 */
export const MODAL_HEADER = "x-em-janela";
function markModalAction(request: NextRequest) {
  request.headers.delete(MODAL_HEADER);
  if (request.headers.get("next-action") && request.headers.has("next-url")) request.headers.set(MODAL_HEADER, "1");
}

export async function updateSession(request: NextRequest) {
  markModalAction(request);
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getUser() valida o token no servidor do Supabase; não troque por getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = path && path !== "/" ? `?next=${encodeURIComponent(path)}` : "";
    return NextResponse.redirect(login);
  }

  if (user && path === "/login") {
    const home = request.nextUrl.clone();
    home.pathname = "/painel";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}
