import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { createRole } from "./actions";

export const metadata: Metadata = { title: "Perfis de acesso" };

interface RoleRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
  profiles: { count: number }[];
  role_permissions: { count: number }[];
}

export default async function PerfisPage() {
  await requirePermission(P.perfisGerenciar);
  const supabase = await createClient();
  const [{ data }, { count: totalPerms }] = await Promise.all([
    supabase.from("roles").select("id, key, name, description, is_system, profiles(count), role_permissions(count)").order("is_system", { ascending: false }).order("name"),
    supabase.from("permissions").select("key", { count: "exact", head: true }),
  ]);
  const roles = (data ?? []) as RoleRow[];

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Perfis de acesso"
        description="Cada colaborador tem um perfil. O perfil define quais menus e ações ele vê. O Administrador tem sempre acesso total."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-3">
          {roles.map((r) => {
            const people = r.profiles[0]?.count ?? 0;
            const perms = r.key === "admin" ? totalPerms ?? 0 : r.role_permissions[0]?.count ?? 0;
            return (
              <Link key={r.id} href={`/perfis/${r.id}`} className="grid gap-1 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-brand">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {r.name} {r.is_system && <Badge>Padrão</Badge>}
                </p>
                {r.description && <p className="text-[13px] text-muted">{r.description}</p>}
                <p className="text-[12.5px] tabular-nums text-muted">
                  {perms} de {totalPerms ?? 0} permissões · {people} {people === 1 ? "pessoa" : "pessoas"}
                </p>
              </Link>
            );
          })}
        </div>
        <Card title="Novo perfil" description="Depois de criar, escolha as permissões.">
          <ActionForm action={createRole}>
            <Field label="Nome" htmlFor="role-name">
              <Input id="role-name" name="name" required minLength={2} maxLength={60} placeholder="Ex.: Recursos Humanos" />
            </Field>
            <Field label="Descrição" htmlFor="role-desc">
              <Textarea id="role-desc" name="description" maxLength={300} />
            </Field>
            <div><SubmitButton>Criar perfil</SubmitButton></div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
