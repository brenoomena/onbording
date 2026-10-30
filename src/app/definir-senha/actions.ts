"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { passwordSchema } from "@/lib/validation";
import { fromZod, type ActionState } from "@/lib/action-state";

export async function setPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = passwordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "A nova senha precisa ser diferente da anterior."
          : error.code === "weak_password"
            ? "Senha fraca. Use letras, números e pelo menos 10 caracteres."
            : "Não foi possível salvar a senha. Abra o link do e-mail novamente.",
    };
  }
  redirect("/painel");
}
