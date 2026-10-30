"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Cliente do navegador, com a sessão do usuário. Usado para enviar arquivos e registrar o tempo de estudo. */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
