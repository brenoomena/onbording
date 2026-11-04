import { History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Select, Table, buttonVariants, formatDateTime } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Auditoria" };

const TABLE_LABEL: Record<string, string> = {
  profiles: "Colaborador",
  areas: "Área",
  positions: "Cargo",
  position_levels: "Nível do cargo",
  levels: "Nível",
  roles: "Perfil de acesso",
  role_permissions: "Permissão do perfil",
  user_permissions: "Permissão individual",
  app_settings: "Configurações visuais",
  tracks: "Trilha",
  contents: "Conteúdo",
  modules: "Módulo",
  module_items: "Item de módulo",
  enrollments: "Matrícula",
};
const ACTION_LABEL: Record<string, string> = { insert: "Criou", update: "Alterou", delete: "Excluiu" };
const FIELD_LABEL: Record<string, string> = {
  full_name: "nome",
  name: "nome",
  description: "descrição",
  active: "ativo",
  status: "status",
  role_id: "perfil",
  area_id: "área",
  position_id: "cargo",
  level_id: "nível",
  supervisor_id: "supervisor",
  admission_date: "admissão",
  onboarding_start_date: "início do onboarding",
  rank: "ordem",
  allowed: "permitido",
  permission_key: "permissão",
  theme: "cores",
  logo_path: "logomarca",
  logo_dark_path: "logomarca (fundo escuro)",
  symbol_path: "símbolo",
  symbol_dark_path: "símbolo (fundo escuro)",
  favicon_path: "favicon",
  logo_sizes: "tamanho das logos",
  track_id: "trilha",
  avatar_path: "foto",
};
const IGNORED = new Set(["updated_at", "created_at", "last_access_at", "id", "updated_by"]);
const PAGE_SIZE = 50;

interface LogRow {
  id: number;
  actor_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

function describe(row: LogRow): string {
  const rec = row.new_data ?? row.old_data ?? {};
  const label = (rec.full_name ?? rec.name ?? rec.permission_key ?? "") as string;
  if (row.action !== "update" || !row.old_data || !row.new_data) return label;
  const changed = Object.keys(row.new_data).filter(
    (k) => !IGNORED.has(k) && JSON.stringify(row.new_data![k]) !== JSON.stringify(row.old_data![k]),
  );
  const fields = changed.map((k) => FIELD_LABEL[k] ?? k).join(", ");
  return fields ? `${label} · ${fields}` : label;
}

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<{ tabela?: string; dias?: string; pagina?: string }> }) {
  await requirePermission(P.auditoriaVer);
  const sp = await searchParams;
  const days = [7, 30, 90, 365].includes(Number(sp.dias)) ? Number(sp.dias) : 30;
  const page = Math.max(1, Number(sp.pagina) || 1);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const supabase = await createClient();
  let query = supabase.from("audit_log").select("*", { count: "exact" }).gte("created_at", since);
  if (sp.tabela && sp.tabela in TABLE_LABEL) query = query.eq("table_name", sp.tabela);
  const { data, count } = await query.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = (data ?? []) as LogRow[];

  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => !!x))];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.full_name]));
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const href = (n: number) => `/auditoria?${new URLSearchParams({ ...(sp.tabela ? { tabela: sp.tabela } : {}), dias: String(days), pagina: String(n) })}`;

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        icon={History}
        title="Auditoria"
        description="Toda alteração em colaboradores, estrutura e perfis fica registrada aqui com autor e horário. O registro não pode ser editado nem apagado pela plataforma."
      />
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4">
        <div className="grid gap-1">
          <label htmlFor="tabela" className="text-[12px] font-medium text-muted">Tipo de registro</label>
          <Select id="tabela" name="tabela" defaultValue={sp.tabela ?? ""}>
            <option value="">Todos</option>
            {Object.entries(TABLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div className="grid gap-1">
          <label htmlFor="dias" className="text-[12px] font-medium text-muted">Período</label>
          <Select id="dias" name="dias" defaultValue={String(days)}>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Últimos 12 meses</option>
          </Select>
        </div>
        <button type="submit" className={buttonVariants.primary}>Filtrar</button>
        <span className="ml-auto text-[12.5px] tabular-nums text-muted">{count ?? 0} registros</span>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="Nenhuma alteração no período" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Quem</th>
              <th>Ação</th>
              <th>Registro</th>
              <th>Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-[13px] tabular-nums">{formatDateTime(r.created_at)}</td>
                <td className="text-[13px]">{r.actor_id ? actorName.get(r.actor_id) ?? "Usuário removido" : <span className="text-muted">Sistema</span>}</td>
                <td className="text-[13px]">{ACTION_LABEL[r.action] ?? r.action}</td>
                <td className="text-[13px]">{TABLE_LABEL[r.table_name] ?? r.table_name}</td>
                <td className="text-[13px]">{describe(r)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {pages > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-between text-[13px]">
          {page > 1 ? <Link href={href(page - 1)} className={buttonVariants.secondary}>Anterior</Link> : <span />}
          <span className="tabular-nums text-muted">Página {page} de {pages}</span>
          {page < pages ? <Link href={href(page + 1)} className={buttonVariants.secondary}>Próxima</Link> : <span />}
        </nav>
      )}
    </>
  );
}
