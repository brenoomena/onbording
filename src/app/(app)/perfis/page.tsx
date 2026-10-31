import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { plainText } from "@/components/markdown";
import Link from "next/link";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Field, IconLink, Input, PageHeader, RowActions } from "@/components/ui";
import { RichTextarea } from "@/components/rich-textarea";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createRole, deleteRole } from "./actions";

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
  await requireAdmin();
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
        icon={ShieldCheck}
        title="Perfis de acesso"
        description="O perfil define as permissões padrão de cada pessoa (ajustes individuais ficam no cadastro do colaborador). Somente administradores gerenciam perfis."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-3">
          {roles.map((r) => {
            const people = r.profiles[0]?.count ?? 0;
            const perms = r.key === "admin" ? totalPerms ?? 0 : r.role_permissions[0]?.count ?? 0;
            return (
              <div key={r.id} className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-brand/60">
                <Link href={`/perfis/${r.id}`} className="flex min-w-0 flex-1 items-start gap-3">
                  <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-icon">
                    <ShieldCheck size={19} />
                  </span>
                  <span className="grid min-w-0 gap-1">
                    <span className="flex flex-wrap items-center gap-2 font-semibold text-heading">
                      {r.name} {r.is_system && <Badge>Padrão</Badge>}
                    </span>
                    {r.description && <span className="text-[13px] text-muted">{plainText(r.description)}</span>}
                    <span className="text-[12.5px] tabular-nums text-muted">
                      {perms} de {totalPerms ?? 0} permissões · {people} {people === 1 ? "pessoa" : "pessoas"}
                    </span>
                  </span>
                </Link>
                <RowActions>
                  <IconLink href={`/perfis/${r.id}`} label="Editar perfil" icon={Pencil} />
                  {!r.is_system && people === 0 && (
                    <ActionButton
                      action={deleteRole}
                      hidden={{ id: r.id }}
                      label="Excluir perfil"
                      variant="danger"
                      icon={<Trash2 size={16} aria-hidden />}
                      iconOnly
                      confirm
                      confirmLabel="Excluir"
                      confirmText={`O perfil "${r.name}" será apagado definitivamente.`}
                    />
                  )}
                </RowActions>
              </div>
            );
          })}
        </div>
        <Card icon={Plus} title="Novo perfil" description="Depois de criar, escolha as permissões.">
          <ActionForm action={createRole}>
            <Field label="Nome" htmlFor="role-name">
              <Input id="role-name" name="name" required minLength={2} maxLength={60} placeholder="Ex.: Recursos Humanos" />
            </Field>
            <Field label="Descrição" htmlFor="role-desc">
              <RichTextarea id="role-desc" name="description" maxLength={600} />
            </Field>
            <div><SubmitButton>Criar perfil</SubmitButton></div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
