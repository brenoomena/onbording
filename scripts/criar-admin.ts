/**
 * Cria o primeiro administrador da plataforma.
 *
 * Uso:
 *   npm run admin:criar -- email@implantta.com.br "Nome Completo"
 *
 * Requer NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e
 * NEXT_PUBLIC_SITE_URL no ambiente (ex.: arquivo .env.local carregado
 * com `node --env-file=.env.local`, ou exportadas no terminal).
 * Envia um convite por e-mail para a pessoa definir a senha.
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const [emailArg, ...nameParts] = process.argv.slice(2);
  const email = (emailArg ?? "").trim().toLowerCase();
  const fullName = nameParts.join(" ").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || fullName.length < 3) {
    console.error('Uso: npm run admin:criar -- email@empresa.com.br "Nome Completo"');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  if (!url || !key) {
    console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: role, error: roleError } = await supabase.from("roles").select("id").eq("key", "admin").single();
  if (roleError || !role) {
    console.error("Perfil 'admin' não encontrado. Aplique as migrações antes (supabase db push).");
    process.exit(1);
  }

  let userId: string | undefined;
  const invite = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${site}/auth/confirm?next=/definir-senha`,
    data: { full_name: fullName },
  });
  if (invite.data.user) {
    userId = invite.data.user.id;
    console.log(`Convite enviado para ${email}.`);
  } else {
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      userId = data?.users.find((u) => u.email?.toLowerCase() === email)?.id;
      if (!data || data.users.length < 200) break;
    }
    if (!userId) {
      console.error(`Não foi possível convidar ${email}: ${invite.error?.message}`);
      process.exit(1);
    }
    console.log(`${email} já tinha login; vinculando como administrador.`);
  }

  const { error } = await supabase.from("profiles").upsert(
    { id: userId, email, full_name: fullName, role_id: role.id, status: "ativo" },
    { onConflict: "id" },
  );
  if (error) {
    console.error(`Erro ao criar o cadastro: ${error.message}`);
    process.exit(1);
  }
  console.log(`${fullName} agora é administrador(a) da plataforma.`);
}

main();
