import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, ActionForm, SubmitButton, PageNotice, FormBar } from "@/components/forms";
import { Alert, Badge, Card, Field, Input, PageHeader } from "@/components/ui";
import { RichTextarea } from "@/components/rich-textarea";
import { requirePermission } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Permission } from "@/lib/types";
import { deleteRole, saveRole } from "../actions";

export const metadata: Metadata = { title: "Perfil de acesso" };

export default async function PerfilPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> }) {
  const me = await requirePermission(P.perfisGerenciar);
  const { id } = await params;
  const { aviso } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: role }, { data: perms }, { data: links }, { count: people }] = await Promise.all([
    supabase.from("roles").select("id, key, name, description, is_system").eq("id", id).maybeSingle(),
    supabase.from("permissions").select("key, module, name, description, sort_order").order("sort_order"),
    supabase.from("role_permissions").select("permission_key").eq("role_id", id),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role_id", id),
  ]);
  if (!role) notFound();

  const isAdminRole = role.key === "admin";
  const isOwnRole = me.profile.role_id === role.id;
  const locked = isAdminRole || (isOwnRole && me.profile.role.key !== "admin");
  const granted = new Set((links ?? []).map((l) => l.permission_key as string));
  const modules = new Map<string, Permission[]>();
  for (const p of (perms ?? []) as Permission[]) {
    modules.set(p.module, [...(modules.get(p.module) ?? []), p]);
  }

  return (
    <>
      <PageHeader
        eyebrow="Perfis de acesso"
        title={role.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {role.is_system && <Badge>Perfil padrão</Badge>}
            <span>{people ?? 0} {people === 1 ? "pessoa usa" : "pessoas usam"} este perfil</span>
          </span>
        }
        actions={
          !role.is_system && (
            <ActionButton action={deleteRole} hidden={{ id: role.id }} label="Excluir perfil" variant="danger" confirm confirmLabel="Excluir" confirmText="O perfil de acesso será apagado. Só é possível se ninguém estiver usando." />
          )
        }
      />
      {aviso === "criado" && <PageNotice message="Perfil criado. Agora escolha as permissões e salve." />}
      {isAdminRole && <Alert tone="brand">O Administrador tem sempre todas as permissões, para que a plataforma nunca fique sem quem a administre.</Alert>}
      {!isAdminRole && isOwnRole && locked && (
        <Alert tone="warn">Este é o seu perfil. Por segurança, só um administrador pode alterar as permissões dele.</Alert>
      )}

      <Card>
        <ActionForm action={saveRole}>
          <FormBar info={<Link href="/perfis" className="font-medium text-accent hover:underline">← Voltar aos perfis</Link>}>
            <SubmitButton>Salvar perfil</SubmitButton>
          </FormBar>
          <input type="hidden" name="id" value={role.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" htmlFor="name">
              <Input id="name" name="name" defaultValue={role.name} required minLength={2} maxLength={60} />
            </Field>
            <Field label="Descrição" htmlFor="description">
              <RichTextarea id="description" name="description" rows={2} defaultValue={role.description ?? ""} maxLength={600} />
            </Field>
          </div>

          <div className="grid gap-5 border-t border-line pt-5">
            <h2 className="text-base font-semibold">Permissões</h2>
            {[...modules.entries()].map(([module, list]) => (
              <fieldset key={module} className="grid gap-2">
                <legend className="mb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{module}</legend>
                {list.map((p) => {
                  const restricted = p.key === P.perfisGerenciar && me.profile.role.key !== "admin";
                  return (
                    <label
                      key={p.key}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3.5 py-3 has-[:checked]:border-brand has-[:checked]:bg-accent-soft/60 has-[:disabled]:cursor-not-allowed"
                    >
                      <input
                        type="checkbox"
                        name="permissions"
                        value={p.key}
                        defaultChecked={isAdminRole || granted.has(p.key)}
                        disabled={locked || restricted}
                        className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]"
                      />
                      <span className="grid gap-0.5">
                        <span className="text-[14px] font-medium">{p.name}</span>
                        {p.description && <span className="text-[12.5px] text-muted">{p.description}</span>}
                        {restricted && <span className="text-[12px] text-warn">Só administradores concedem esta permissão.</span>}
                      </span>
                      {restricted && granted.has(p.key) && <input type="hidden" name="permissions" value={p.key} />}
                    </label>
                  );
                })}
              </fieldset>
            ))}
            <p className="text-[12.5px] text-muted">As permissões das próximas etapas (trilhas, avaliações, PDI) aparecem aqui quando cada módulo for entregue.</p>
          </div>

        </ActionForm>
      </Card>
    </>
  );
}
