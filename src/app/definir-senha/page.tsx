import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Definir senha" };

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/erro?motivo=link");

  return (
    <AuthShell title="Defina sua senha" description={`Conta: ${user.email}`}>
      <PasswordForm />
    </AuthShell>
  );
}
