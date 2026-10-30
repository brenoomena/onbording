"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import type { ActionState } from "@/lib/action-state";

export async function requestReset(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) return { error: "Informe um e-mail válido." };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${publicEnv.siteUrl}/auth/confirm?next=/definir-senha`,
  });
  // Mesma resposta exista ou não a conta, para não revelar quem está cadastrado.
  return { ok: "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha em alguns minutos." };
}
