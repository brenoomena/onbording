"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import type { ActionState } from "@/lib/action-state";

const schema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
  next: z.string().optional(),
});

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/painel";
}

export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    next: String(formData.get("next") ?? "") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { error: "E-mail ou senha incorretos. Se esqueceu a senha, use o link abaixo." };
  }
  redirect(safeNext(parsed.data.next));
}

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
  if (error || !data.url) redirect("/auth/erro?motivo=google");
  redirect(data.url);
}
