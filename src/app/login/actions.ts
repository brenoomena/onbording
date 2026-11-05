"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/access";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Entrada única da plataforma: conta Google com o e-mail cadastrado. */
export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const next = safeNext(String(formData.get("next") ?? "") || undefined);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: publicEnv.googleDomain ? { hd: publicEnv.googleDomain, prompt: "select_account" } : { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/login?erro=google");
  redirect(data.url);
}
